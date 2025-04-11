import * as discord from './js/discord.js';
import * as websocket from './js/websocket.js';
import * as ui from './js/ui.js';
import { getOrCreateLocalUserId } from './js/utils.js';

// Application state
let userId = null;
let username = null;
let params = null;

/**
 * Initialize the application
 */
async function initApp() {
  // Initialize UI
  ui.initialize();
  
  // Add form submit handler
  ui.onSubmit(handleMessageSubmit);
  
  // Get URL parameters
  params = discord.getUrlParams();
  
  // Check if running in Discord
  if (discord.isDiscordActivity()) {
    await initDiscord();
  } else {
    initLocal();
  }
  
  // Set up WebSocket event handlers
  setupWebSocketHandlers();
}

/**
 * Initialize Discord mode
 */
async function initDiscord() {
  ui.updateStatus('connecting', 'Initializing Discord...');
  
  try {
    // Authenticate with Discord
    const user = await discord.authenticate(import.meta.env.VITE_DISCORD_CLIENT_ID);
    
    // Store user info
    userId = user.userId;
    username = user.username;
    
    // Connect to WebSocket
    connectWebSocket();
  } catch (error) {
    console.error('Discord initialization error:', error);
    ui.updateStatus('disconnected', 'Discord initialization failed');
  }
}

/**
 * Initialize local mode
 */
function initLocal() {
  // Generate or get local user ID
  userId = getOrCreateLocalUserId();
  username = `User-${userId.substring(0, 6)}`;
  
  // Connect to WebSocket
  connectWebSocket();
}

/**
 * Connect to WebSocket
 */
function connectWebSocket() {
  ui.updateStatus('connecting', 'Connecting to server...');
  
  // Connect with user info
  websocket.connect({
    userId,
    username,
    instanceId: params.instanceId,
    activityId: params.activityId
  });
}

/**
 * Set up WebSocket event handlers
 */
function setupWebSocketHandlers() {
  // Message handler
  websocket.on('message', (senderId, message) => {
    ui.displayMessage(senderId, message, senderId === userId);
  });
  
  // User joined handler
  websocket.on('userJoined', (joinedUserId) => {
    ui.displaySystemMessage(`User ${joinedUserId} joined the chat`);
  });
  
  // User left handler
  websocket.on('userLeft', (leftUserId) => {
    ui.displaySystemMessage(`User ${leftUserId} left the chat`);
  });
  
  // Connect handler
  websocket.on('connect', () => {
    ui.updateStatus('connected', 'Connected');
  });
  
  // Disconnect handler
  websocket.on('disconnect', () => {
    ui.updateStatus('disconnected', 'Disconnected');
  });
  
  // Error handler
  websocket.on('error', (message) => {
    ui.updateStatus('disconnected', 'Connection error');
    ui.displaySystemMessage(`Error: ${message}`);
  });
}

/**
 * Handle message form submission
 * @param {string} message - Message text
 */
function handleMessageSubmit(message) {
  // Send message via WebSocket
  if (websocket.isConnected()) {
    websocket.sendMessage(message);
    
    // Display own message immediately
    ui.displayMessage(userId, message, true);
    
    // Clear input
    ui.clearInput();
  }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
