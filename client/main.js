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
      <div id="debug-console" class="debug-console">
        <div class="debug-header">
          <span>Debug Console</span>
          <button id="toggle-debug" class="toggle-debug">_</button>
        </div>
        <div id="debug-console-content" class="debug-console-content"></div>
      </div>
    </div>
  `;
  
  // Add toggle functionality for debug console
  document.getElementById('toggle-debug').addEventListener('click', () => {
    document.getElementById('debug-console').classList.toggle('minimized');
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
      
      // Create avatar URL
      let avatarSrc = '';
      if (user.avatar) {
        avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
      } else {
        // Safely handle potential BigInt conversion issues
        try {
          const defaultAvatarIndex = Number(BigInt(user.id) >> 22n % 6n);
          avatarSrc = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
        } catch (error) {
          // Fallback to avatar 0 if we can't calculate
          avatarSrc = `https://cdn.discordapp.com/embed/avatars/0.png`;
          logDebug(`Avatar calculation error: ${error.message}`, 'warning');
        }
      }
      
      // Create username with fallbacks
      const username = user.global_name || user.username || 
                       (user.user ? (user.user.global_name || user.user.username) : 'Unknown User');
      
      // Create participant element
      const participantElement = document.createElement('div');
      participantElement.className = 'participant-item';
      participantElement.innerHTML = `
        <img src="${avatarSrc}" alt="Avatar" class="participant-avatar">
        <span class="participant-name">${username}</span>
      `;
      
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
      { id: 'dotgame', name: 'Dot Game', description: 'Simple multiplayer dot visualization' },
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
  
  // Re-add debug console
  const debugConsole = document.getElementById('debug-console');
  if (debugConsole) {
    appContainer.appendChild(debugConsole);
  }
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
  } else if (gameId === 'dotgame') {
    // Get current user ID from auth
    const userId = auth?.user?.id || 'anonymous';
    
    // Initialize the dot game
    initDotGame(gameContainer, userId);
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
  
  // Re-add debug console
  const debugConsole = document.getElementById('debug-console');
  if (debugConsole) {
    appContainer.appendChild(debugConsole);
  }
}

// Simple Dot Game
function initDotGame(container, userId) {
  // Create game elements
  container.innerHTML = `
    <div class="dot-game">
      <div class="dot-game-display"></div>
      <div class="dot-game-controls">
        <button id="leave-dot-game" class="canvas-button leave-button">Leave Game</button>
      </div>
      <div class="dot-game-status"></div>
    </div>
  `;
  
  const dotDisplay = container.querySelector('.dot-game-display');
  const statusDisplay = container.querySelector('.dot-game-status');
  
  // Styling for the dot display
  dotDisplay.style.width = '600px';
  dotDisplay.style.height = '400px';
  dotDisplay.style.backgroundColor = '#333';
  dotDisplay.style.position = 'relative';
  dotDisplay.style.borderRadius = '8px';
  dotDisplay.style.margin = '0 auto';
  
  // Add leave button functionality
  container.querySelector('#leave-dot-game').addEventListener('click', () => {
    if (socket) {
      socket.close();
    }
    showLobby();
  });
  
  // Set initial status
  statusDisplay.textContent = 'Connecting to dot game...';
  
  // Create WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  const socket = new WebSocket(wsUrl);
  
  // Store participant dots
  const dots = new Map();
  
  // Random color for the current user
  const userColor = getRandomColor();
  
  // WebSocket event handlers
  socket.onopen = () => {
    statusDisplay.textContent = 'Connected! Joining dot game...';
    
    // Join the room with dotgame type
    socket.send(JSON.stringify({
      type: 'join_room',
      instanceId: discordSdk.instanceId,
      userId: userId,
      gameType: 'dotgame'
    }));
    
    // Also send our initial position
    sendPosition(Math.random() * 500, Math.random() * 300);
  };
  
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'state_sync':
          // Sync existing dots
          if (message.state && message.state.positions) {
            for (const [participantId, position] of Object.entries(message.state.positions)) {
              updateDot(participantId, position.x, position.y, position.color);
            }
          }
          statusDisplay.textContent = 'Connected to dot game';
          break;
          
        case 'dot_update':
          // Update a dot position
          updateDot(
            message.userId,
            message.position.x,
            message.position.y,
            message.position.color
          );
          break;
          
        case 'user_joined':
          statusDisplay.textContent = `User joined! (${message.participantCount} total)`;
          break;
          
        case 'user_left':
          // Remove the dot for this user
          if (dots.has(message.userId)) {
            dotDisplay.removeChild(dots.get(message.userId));
            dots.delete(message.userId);
          }
          statusDisplay.textContent = `User left. (${message.participantCount} remaining)`;
          break;
      }
    } catch (error) {
      console.error('Error handling dot game message:', error);
    }
  };
  
  socket.onclose = () => {
    statusDisplay.textContent = 'Disconnected from dot game';
  };
  
  // Handle click on the dot display to move your dot
  dotDisplay.addEventListener('click', (event) => {
    const rect = dotDisplay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Send new position to server
    sendPosition(x, y);
    
    // Also update locally
    updateDot(userId, x, y, userColor);
  });
  
  // Send position update to server
  function sendPosition(x, y) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'update_position',
        position: {
          x: x,
          y: y,
          color: userColor
        }
      }));
    }
  }
  
  // Update or create a dot for a participant
  function updateDot(participantId, x, y, color) {
    let dot;
    
    if (dots.has(participantId)) {
      // Update existing dot
      dot = dots.get(participantId);
    } else {
      // Create new dot
      dot = document.createElement('div');
      dot.className = 'user-dot';
      dot.style.position = 'absolute';
      dot.style.width = '20px';
      dot.style.height = '20px';
      dot.style.borderRadius = '50%';
      dot.style.transition = 'all 0.3s ease';
      
      // Add username tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'dot-tooltip';
      tooltip.textContent = participantId;
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '25px';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '3px 8px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '12px';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.style.opacity = '0';
      tooltip.style.transition = 'opacity 0.2s';
      
      dot.appendChild(tooltip);
      
      // Show tooltip on hover
      dot.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
      });
      
      dot.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
      
      dotDisplay.appendChild(dot);
      dots.set(participantId, dot);
    }
    
    // Update position and color
    dot.style.backgroundColor = color || '#00ff00';
    dot.style.left = `${x - 10}px`; // Center the dot
    dot.style.top = `${y - 10}px`;
    
    // Highlight if it's the current user
    if (participantId === userId) {
      dot.style.border = '2px solid white';
    }
  }
  
  // Generate a random color
  function getRandomColor() {
    const colors = [
      '#FF5733', // Red
      '#33FF57', // Green
      '#3357FF', // Blue
      '#FF33F5', // Pink
      '#F5FF33', // Yellow
      '#33FFF5'  // Cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Store WebSocket for cleanup
  currentGame = {
    socket: socket,
    destroy: function() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
    }
  };
}

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
