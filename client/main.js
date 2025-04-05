import { DiscordSDK, Events, patchUrlMappings } from "@discord/embedded-app-sdk";
import CanvasGameFrontend from './game_frontends/CanvasGameFrontend.js';
import DotGameFrontend from './game_frontends/DotGameFrontend.js';
import rocketLogo from '/rocket.png';
import { 
  logDebug, 
  setupConsoleOverrides, 
  renderParticipants, 
  createDebugConsole,
  getWebSocketInstance,
  isInDiscordEnvironment,
  setupXHRErrorMonitoring,
  getWebSocketChannel,
  closeWebSocketConnection,
  reconnectWebSocket
} from './utils-websocket.js';
import "./style.css";

// https://discord.com/developers/docs/activities/development-guides#instance-participants

// Will eventually store the authenticated user's access_token
let auth;
// Store participants data
let participants = [];
// Store the current active game
let currentGame = null;
// Store available games
let availableGames = [];
// Store the main app container
let appContainer;

// Store WebSocket server URL for consistency
const getWebSocketUrl = () => {
  // Always use Discord URL format since we only run in Discord
  return '/ws';
};

// Initialize the SDK with the client ID
const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  // Set up the app container
  document.querySelector('#app').innerHTML = `
    <div id="app-content"></div>
  `;
  
  appContainer = document.getElementById('app-content');
  
  // Create debug console
  createDebugConsole(appContainer);
  
  // Setup console overrides
  setupConsoleOverrides();
  
  // Set up XHR error monitoring
  setupXHRErrorMonitoring();
  
  // Log initial info
  logDebug('Application initialized');
  logDebug(`Discord instanceId: ${discordSdk.instanceId}`);
  
  // Apply URL mappings for Discord sandbox - MUST be done before any WebSocket connections
  try {
    // Hard-code isProd to true since app only runs in Discord
    const isProd = true;
    
    logDebug('Running in Discord - applying URL mappings');
    logDebug('Current URL before mapping: ' + window.location.href);
    
    // Use the patchUrlMappings API to route requests through Discord's proxy
    await patchUrlMappings([
      // Single root mapping that handles all paths including WebSockets
      { prefix: '/', target: 'brebiskingactivity-production.up.railway.app' }
    ]);
    
    logDebug('URL mappings applied successfully');
    logDebug('URL after mapping: ' + window.location.href);
    
    // IMPORTANT: Force a very short delay to allow mappings to take effect
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    logDebug(`Failed to apply URL mappings: ${error.message}`, 'error');
    if (error.stack) {
      logDebug(`Error stack: ${error.stack}`, 'error');
    }
  }
  
  // Initialize WebSocket connection only after mappings are applied
  try {
    logDebug('Initializing WebSocket connection...', 'info');
    
    // Log environment for troubleshooting
    const envDetails = {
      isInDiscord: isInDiscordEnvironment(),
      clientId: discordSdk?.instanceId,
      protocol: window.location.protocol,
      host: window.location.host,
      userAgent: navigator.userAgent,
      wsUrl: getWebSocketUrl()
    };
    logDebug(`Environment details: ${JSON.stringify(envDetails)}`, 'info');
    
    const ws = getWebSocketInstance();
    if (ws) {
      logDebug('WebSocket initialized successfully');
    } else {
      logDebug('Failed to initialize WebSocket - instance is null', 'error');
    }
    
    // Add fallback for persistent connection issues
    let connectionAttempts = 0;
    const checkConnectionState = () => {
      connectionAttempts++;
      const state = ws ? ws.readyState : -1;
      const stateStr = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][state] || 'UNKNOWN';
      
      if (state === WebSocket.OPEN) {
        logDebug('WebSocket connection verified as connected');
        return; // Success
      } else if (connectionAttempts > 3) {
        logDebug(`WebSocket still not connected after ${connectionAttempts} checks, state: ${stateStr}`, 'warning');
        logDebug('WebSocket connection issues detected', 'warning');
        
        // Try to reconnect one last time
        try {
          logDebug('Attempting emergency WebSocket reconnection...', 'warning');
          getWebSocketInstance();
        } catch (error) {
          logDebug(`Failed emergency reconnection: ${error.message}`, 'error');
        }
      } else {
        // Try again after a delay
        setTimeout(checkConnectionState, 5000);
      }
    };
    
    // Check connection status after a delay
    setTimeout(checkConnectionState, 5000);
  } catch (error) {
    logDebug(`Failed to initialize WebSocket: ${error.message}`, 'error');
    logDebug(`Error stack: ${error.stack || 'No stack trace available'}`, 'error');
  }
  
  setupDiscordSdk().then(() => {
    logDebug("Discord SDK is authenticated");
    logDebug(`Using instance ID: ${discordSdk.instanceId}`);
    
    // Fetch initial participants
    fetchParticipants();
    
    // Fetch available games and show the lobby once they're loaded
    fetchAvailableGames()
      .then(() => {
        // Shows the lobby only after games are fetched
        showLobby();
      })
      .catch(error => {
        logDebug(`Error loading games: ${error.message}`, 'error');
        // Still show the lobby with fallback games
        showLobby();
      });
    
    // Subscribe to participant updates
    discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
  }).catch(error => {
    logDebug(`Failed to setup Discord SDK: ${error.message}`, 'error');
  });
});

async function setupDiscordSdk() {
  try {
    logDebug("Waiting for Discord SDK to be ready...");
    await discordSdk.ready();
    logDebug("Discord SDK is ready");
    
    // Log Discord environment info
    logDebug(`Current location: protocol=${window.location.protocol}, host=${window.location.host}, pathname=${window.location.pathname}`);

    // Authorize with Discord Client
    logDebug("Authorizing with Discord client...");
    const { code } = await discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: [
        "identify",
        "guilds",
        "applications.commands"
      ],
    });
    logDebug("Authorization successful, received code");

    // Retrieve an access_token from your activity's server
    logDebug("Retrieving access token...");
    const response = await fetch("/.proxy/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token fetch failed with status ${response.status}: ${errorText}`);
    }
    
    const tokenData = await response.json();
    logDebug("Access token retrieved successfully");
    
    if (!tokenData.access_token) {
      throw new Error("No access_token in response: " + JSON.stringify(tokenData));
    }
    
    const { access_token } = tokenData;

    // Authenticate with Discord client (using the access_token)
    logDebug("Authenticating with Discord...");
    auth = await discordSdk.commands.authenticate({
      access_token,
    });

    if (auth == null) {
      throw new Error("Authenticate command failed with null response");
    }
    
    logDebug("Authentication successful");
    
    // Reconnect WebSocket after authentication to ensure proper connectivity
    logDebug("Reconnecting WebSocket after Discord auth...");
    reconnectWebSocket();
    
    return auth;
  } catch (error) {
    logDebug(`Discord SDK setup error: ${error.message}`, 'error');
    if (error.stack) {
      logDebug(`Error stack: ${error.stack}`, 'error');
    }
    throw error;
  }
}

// Fetch participants in the activity
async function fetchParticipants() {
  try {
    const response = await discordSdk.commands.getInstanceConnectedParticipants();
    // Check what structure we're getting back
    logDebug(`Participants response structure: ${JSON.stringify(response)}`);
    
    // Handle different response structures
    if (Array.isArray(response)) {
      participants = response;
    } else if (response && typeof response === 'object') {
      // If it's an object, try to find the participants array
      // It might be in a property like 'users', 'participants', etc.
      if (response.users) {
        participants = response.users;
      } else if (response.participants) {
        participants = response.participants;
      } else {
        // Just log the keys we have
        const keys = Object.keys(response);
        logDebug(`Available keys in response: ${keys.join(', ')}`, 'warning');
        participants = [];
      }
    } else {
      // Fallback to empty array if we can't determine the structure
      logDebug('Unable to parse participants response', 'error');
      participants = [];
    }
    
    logDebug(`Fetched ${participants.length} participants`);
    renderParticipants(participants);
  } catch (error) {
    logDebug(`Failed to fetch participants: ${error.message}`, 'error');
    logDebug(`Error stack: ${error.stack}`, 'error');
    participants = [];
    renderParticipants(participants);
  }
}

// Update participants when they change
function updateParticipants(newParticipants) {
  logDebug(`Participants update received: ${JSON.stringify(newParticipants)}`);
  
  // Similar handling as in fetchParticipants
  if (Array.isArray(newParticipants)) {
    participants = newParticipants;
  } else if (newParticipants && typeof newParticipants === 'object') {
    if (newParticipants.users) {
      participants = newParticipants.users;
    } else if (newParticipants.participants) {
      participants = newParticipants.participants;
    } else {
      const keys = Object.keys(newParticipants);
      logDebug(`Available keys in update: ${keys.join(', ')}`, 'warning');
      // Don't update participants if we can't determine the structure
      return;
    }
  } else {
    logDebug('Unable to parse participants update', 'error');
    return;
  }
  
  logDebug(`Participants updated: ${participants.length} users in activity`);
  renderParticipants(participants);
}

// Fetch available games from the server
async function fetchAvailableGames() {
  try {
    const response = await fetch('/.proxy/api/games');
    const data = await response.json();
    
    // Handle both old format (array) and new format ({ games: array })
    if (data.games && Array.isArray(data.games)) {
      availableGames = data.games;
      logDebug(`Fetched ${availableGames.length} available games from games property`);
    } else if (Array.isArray(data)) {
      availableGames = data;
      logDebug(`Fetched ${availableGames.length} available games from direct array`);
    } else {
      throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
    }
    
    logDebug(`Available games: ${JSON.stringify(availableGames)}`);
  } catch (error) {
    logDebug(`Failed to fetch available games: ${error.message}`, 'error');
    // Set default available games if fetch fails
    availableGames = [
      { id: 'canvas', name: 'Simple Canvas', description: 'A collaborative drawing canvas' },
      { id: 'dotgame', name: 'Dot Game', description: 'Simple multiplayer dot visualization' },
      { id: 'lobby', name: 'Lobby', description: 'The default lobby' }
    ];
    // Log what we're using as fallback
    logDebug(`Using ${availableGames.length} fallback games instead`);
  }
  
  // Return available games for promise chaining
  return availableGames;
}

// Show the lobby UI
function showLobby() {
  // Clean up any existing game
  if (currentGame && currentGame.destroy) {
    currentGame.destroy();
    currentGame = null;
  }
  
  // Clear the app container and preserve the debug console
  const debugConsole = document.getElementById('debug-console');
  appContainer.innerHTML = '';
  if (debugConsole) {
    appContainer.appendChild(debugConsole);
  }
  
  // Create lobby header
  const header = document.createElement('div');
  header.className = 'lobby-header';
  
  const title = document.createElement('h1');
  title.textContent = 'Discord Activity Lobby';
  header.appendChild(title);
  
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Select a game to play:';
  header.appendChild(subtitle);
  
  appContainer.appendChild(header);
  
  // Create game selection
  const gameSelector = document.createElement('div');
  gameSelector.className = 'game-selector';
  
  // Log what games are available before rendering
  logDebug(`Rendering ${availableGames.length} games in the lobby`);
  logDebug(`Available games: ${JSON.stringify(availableGames)}`);
  
  // Check if we have any displayable games
  const displayableGames = availableGames.filter(game => game.id !== 'lobby');
  
  // Display message if no games are available to select
  if (displayableGames.length === 0) {
    const noGamesMessage = document.createElement('div');
    noGamesMessage.className = 'no-games-message';
    noGamesMessage.textContent = 'No games are currently available to play.';
    gameSelector.appendChild(noGamesMessage);
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Loading Games';
    retryButton.className = 'canvas-button';
    retryButton.addEventListener('click', () => {
      fetchAvailableGames()
        .then(() => {
          showLobby();
        });
    });
    gameSelector.appendChild(retryButton);
  } else {
    // Render game cards for each game
    displayableGames.forEach(game => {
      const gameCard = document.createElement('div');
      gameCard.className = 'game-card';
      gameCard.addEventListener('click', () => startGame(game.id));
      
      const gameTitle = document.createElement('h2');
      gameTitle.textContent = game.name;
      gameCard.appendChild(gameTitle);
      
      const gameDescription = document.createElement('p');
      gameDescription.textContent = game.description;
      gameCard.appendChild(gameDescription);
      
      gameSelector.appendChild(gameCard);
    });
  }
  
  appContainer.appendChild(gameSelector);
  
  // Create the participants sidebar
  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'sidebar-container';
  
  const participantsHeader = document.createElement('h2');
  participantsHeader.textContent = 'Participants';
  sidebarContainer.appendChild(participantsHeader);
  
  const participantsList = document.createElement('div');
  participantsList.id = 'participants-list';
  participantsList.className = 'participants-list';
  sidebarContainer.appendChild(participantsList);
  
  appContainer.appendChild(sidebarContainer);
  
  // Render participants in the sidebar
  renderParticipants(participants);
}

// Start a game
function startGame(gameId) {
  logDebug(`Starting game: ${gameId}`);
  
  // Clean up any existing game
  if (currentGame && currentGame.destroy) {
    currentGame.destroy();
    currentGame = null;
  }
  
  // Clear the app container and preserve the debug console
  const debugConsole = document.getElementById('debug-console');
  appContainer.innerHTML = '';
  if (debugConsole) {
    appContainer.appendChild(debugConsole);
  }
  
  // Create game container
  const gameContainer = document.createElement('div');
  gameContainer.className = 'game-container';
  appContainer.appendChild(gameContainer);
  
  // Create sidebar (will include participants)
  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'sidebar-container game-sidebar';
  
  const participantsHeader = document.createElement('h2');
  participantsHeader.textContent = 'Participants';
  sidebarContainer.appendChild(participantsHeader);
  
  const participantsList = document.createElement('div');
  participantsList.id = 'participants-list';
  participantsList.className = 'participants-list';
  sidebarContainer.appendChild(participantsList);
  
  appContainer.appendChild(sidebarContainer);
  
  // Get current user ID from auth
  const userId = auth?.user?.id || 'anonymous';
  
  // Log important information for multiplayer
  logDebug(`Starting ${gameId} for user ${userId} in instance ${discordSdk.instanceId}`);
  
  // Initialize the appropriate game
  if (gameId === 'canvas') {
    try {
      // Create the GameCanvas instance
      currentGame = new CanvasGameFrontend(
        gameContainer, 
        discordSdk.instanceId, 
        userId, 
        () => showLobby() // Callback to return to lobby
      );
    } catch (error) {
      logDebug(`Error initializing Canvas game: ${error.message}`, 'error');
      showGameError(gameContainer, error, gameId);
    }
  } else if (gameId === 'dotgame') {
    try {
      // Initialize the dot game using our new DotGame class
      currentGame = new DotGameFrontend(
        gameContainer,
        discordSdk.instanceId,
        userId,
        () => showLobby() // Callback to return to lobby
      );
    } catch (error) {
      logDebug(`Error initializing Dot game: ${error.message}`, 'error');
      showGameError(gameContainer, error, gameId);
    }
  } else {
    // Handle unknown game type
    showGameError(gameContainer, new Error(`Unknown game type: ${gameId}`), gameId);
  }
  
  // Render participants in the sidebar
  renderParticipants(participants);
}

// Helper function to show game errors
function showGameError(container, error, gameId) {
  container.innerHTML = `
    <div class="error-message">
      <h3>Error starting ${gameId}</h3>
      <p>${error.message}</p>
      <div class="error-details">
        <p>Please check the following:</p>
        <ul>
          <li>Your network connection is working</li>
          <li>The WebSocket server is running at ${getWebSocketUrl()}</li>
          <li>You have permissions to access this activity</li>
        </ul>
      </div>
    </div>
  `;
  
  // Add a button to return to lobby
  const backButton = document.createElement('button');
  backButton.textContent = 'Back to Lobby';
  backButton.className = 'canvas-button';
  backButton.addEventListener('click', showLobby);
  container.appendChild(backButton);
  
  // Add a retry button
  const retryButton = document.createElement('button');
  retryButton.textContent = 'Retry';
  retryButton.className = 'canvas-button';
  retryButton.addEventListener('click', () => startGame(gameId));
  container.appendChild(retryButton);
}
