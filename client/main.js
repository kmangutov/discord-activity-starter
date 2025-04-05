import { DiscordSDK, Events } from "@discord/embedded-app-sdk";
import GameCanvas from './GameCanvas.js';
import rocketLogo from '/rocket.png';
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

// Debug logger function
function logDebug(message, type = 'info') {
  const debugConsole = document.getElementById('debug-console-content');
  if (!debugConsole) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-message">${message}</span>`;
  
  debugConsole.appendChild(logEntry);
  // Auto-scroll to bottom
  debugConsole.scrollTop = debugConsole.scrollHeight;
  
  // Limit entries to prevent overflow
  if (debugConsole.children.length > 50) {
    debugConsole.removeChild(debugConsole.children[0]);
  }
}

// Override console methods to also log to our debug console
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
};

console.error = function(...args) {
  originalConsoleError.apply(console, args);
  logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'error');
};

console.warn = function(...args) {
  originalConsoleWarn.apply(console, args);
  logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'warning');
};

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Set up the app container
  document.querySelector('#app').innerHTML = `
    <div id="app-content">
      <div id="debug-console">
        <div id="debug-console-header">Debug Console <button id="toggle-debug">Toggle</button></div>
        <div id="debug-console-content"></div>
      </div>
    </div>
  `;
  
  // Add toggle functionality for debug console
  document.getElementById('toggle-debug').addEventListener('click', () => {
    const consoleContent = document.getElementById('debug-console-content');
    consoleContent.style.display = consoleContent.style.display === 'none' ? 'block' : 'none';
  });
  
  appContainer = document.getElementById('app-content');
  
  setupDiscordSdk().then(() => {
    logDebug("Discord SDK is authenticated");
    
    // Fetch initial participants
    fetchParticipants();
    
    // Fetch available games
    fetchAvailableGames();
    
    // Subscribe to participant updates
    discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
    
    // Show the lobby
    showLobby();
  }).catch(error => {
    logDebug(`Failed to setup Discord SDK: ${error.message}`, 'error');
  });
});

async function setupDiscordSdk() {
  await discordSdk.ready();
  logDebug("Discord SDK is ready");

  // Authorize with Discord Client
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

  // Retrieve an access_token from your activity's server
  const response = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

// Fetch participants in the activity
async function fetchParticipants() {
  try {
    const response = await discordSdk.commands.getInstanceConnectedParticipants();
    
    // Handle different response structures
    if (Array.isArray(response)) {
      participants = response;
    } else if (response && typeof response === 'object') {
      // If it's an object, try to find the participants array
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
    renderParticipants();
  } catch (error) {
    logDebug(`Failed to fetch participants: ${error.message}`, 'error');
    logDebug(`Error stack: ${error.stack}`, 'error');
    participants = [];
    renderParticipants();
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
  renderParticipants();
}

// Render participants in the UI
function renderParticipants() {
  const participantsList = document.getElementById('participants-list');
  if (!participantsList) return;
  
  participantsList.innerHTML = '';
  
  // Guard against non-array participants
  if (!Array.isArray(participants)) {
    logDebug('Participants is not an array in renderParticipants', 'error');
    return;
  }
  
  if (participants.length === 0) {
    participantsList.innerHTML = '<div class="no-participants">No participants found</div>';
    return;
  }
  
  participants.forEach(user => {
    try {
      // Guard against invalid user objects
      if (!user || typeof user !== 'object') {
        logDebug(`Invalid user object: ${JSON.stringify(user)}`, 'warning');
        return;
      }
      
      const participantElement = document.createElement('div');
      participantElement.className = 'participant-item';
      
      // Display user avatar if available
      if (user.avatar) {
        const avatarElement = document.createElement('img');
        avatarElement.className = 'participant-avatar';
        avatarElement.src = user.avatar;
        avatarElement.alt = user.username || 'User';
        participantElement.appendChild(avatarElement);
      } else {
        // Fallback avatar
        const avatarFallback = document.createElement('div');
        avatarFallback.className = 'participant-avatar-fallback';
        avatarFallback.textContent = (user.username || 'User').charAt(0).toUpperCase();
        participantElement.appendChild(avatarFallback);
      }
      
      // Display user name
      const nameElement = document.createElement('span');
      nameElement.className = 'participant-name';
      nameElement.textContent = user.username || `User ${user.id || 'Unknown'}`;
      participantElement.appendChild(nameElement);
      
      participantsList.appendChild(participantElement);
    } catch (error) {
      logDebug(`Error rendering participant: ${error.message}`, 'error');
    }
  });
}

// Fetch available games from the server
async function fetchAvailableGames() {
  try {
    const response = await fetch('/.proxy/api/games');
    availableGames = await response.json();
    logDebug(`Fetched ${availableGames.length} available games`);
  } catch (error) {
    logDebug(`Failed to fetch available games: ${error.message}`, 'error');
    // Set default available games if fetch fails
    availableGames = [
      { id: 'canvas', name: 'Simple Canvas', description: 'A collaborative drawing canvas' },
      { id: 'lobby', name: 'Lobby', description: 'The default lobby' }
    ];
  }
}

// Show the lobby UI
function showLobby() {
  // Clean up any existing game
  if (currentGame && currentGame.destroy) {
    currentGame.destroy();
    currentGame = null;
  }
  
  // Clear the app container
  appContainer.innerHTML = '';
  
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
  
  availableGames.forEach(game => {
    if (game.id === 'lobby') return; // Skip the lobby as a game option
    
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
  renderParticipants();
}

// Start a game
function startGame(gameId) {
  logDebug(`Starting game: ${gameId}`);
  
  // Clean up any existing game
  if (currentGame && currentGame.destroy) {
    currentGame.destroy();
    currentGame = null;
  }
  
  // Clear the app container
  appContainer.innerHTML = '';
  
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
  
  // Initialize the appropriate game
  if (gameId === 'canvas') {
    // Get current user ID from auth
    const userId = auth?.user?.id || 'anonymous';
    
    // Create the GameCanvas instance
    currentGame = new GameCanvas(
      gameContainer, 
      discordSdk.instanceId, 
      userId, 
      () => showLobby() // Callback to return to lobby
    );
  } else {
    // Handle unknown game type
    gameContainer.innerHTML = `<div class="error-message">Unknown game type: ${gameId}</div>`;
    
    // Add a button to return to lobby
    const backButton = document.createElement('button');
    backButton.textContent = 'Back to Lobby';
    backButton.className = 'canvas-button';
    backButton.addEventListener('click', showLobby);
    gameContainer.appendChild(backButton);
  }
  
  // Render participants in the sidebar
  renderParticipants();
}

// Initial render of participants
renderParticipants();

// Debug console toggle
document.getElementById('toggle-debug').addEventListener('click', () => {
  const debugConsole = document.getElementById('debug-console');
  debugConsole.classList.toggle('minimized');
  
  const toggleButton = document.getElementById('toggle-debug');
  toggleButton.textContent = debugConsole.classList.contains('minimized') ? '□' : '_';
});

// Initial log
logDebug('Debug console initialized');
logDebug(`Discord instanceId: ${discordSdk.instanceId}`);
