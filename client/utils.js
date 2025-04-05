/**
 * Utility functions for Discord Activity app
 */

// Debug logger function
export function logDebug(message, type = 'info') {
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

// Setup console overrides to log to debug console
export function setupConsoleOverrides() {
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
}

// Render participants in the UI
export function renderParticipants(participants, containerId = 'participants-list') {
  const participantsList = document.getElementById(containerId);
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

// Setup debug console toggle
export function setupDebugConsole() {
  const toggleButton = document.getElementById('toggle-debug');
  if (!toggleButton) return;
  
  toggleButton.addEventListener('click', () => {
    const debugConsole = document.getElementById('debug-console');
    debugConsole.classList.toggle('minimized');
    
    toggleButton.textContent = debugConsole.classList.contains('minimized') ? '□' : '_';
  });
  
  // Initial log
  logDebug('Debug console initialized');
}

// Create and add debug console to the DOM
export function createDebugConsole(container) {
  const debugConsole = document.createElement('div');
  debugConsole.id = 'debug-console';
  debugConsole.className = 'debug-console';
  debugConsole.innerHTML = `
    <div class="debug-header">
      <span>Debug Console</span>
      <button id="toggle-debug" class="toggle-debug">_</button>
    </div>
    <div id="debug-console-content" class="debug-console-content"></div>
  `;
  
  container.appendChild(debugConsole);
  setupDebugConsole();
}

// Generate a random color
export function getRandomColor() {
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

// Check WebSocket connectivity
export async function checkWebSocketConnectivity(url) {
  return new Promise((resolve, reject) => {
    try {
      logDebug(`Testing WebSocket connectivity to ${url}`);
      const testSocket = new WebSocket(url);
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        testSocket.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      testSocket.onopen = () => {
        clearTimeout(timeout);
        logDebug('WebSocket connection test successful');
        
        // Send a test message
        testSocket.send(JSON.stringify({
          type: 'connectivity_test'
        }));
        
        // Close after successful check
        setTimeout(() => {
          testSocket.close();
          resolve(true);
        }, 500);
      };
      
      testSocket.onerror = (error) => {
        clearTimeout(timeout);
        logDebug(`WebSocket connection test failed: ${JSON.stringify(error)}`, 'error');
        reject(error);
      };
      
    } catch (error) {
      logDebug(`Failed to create test WebSocket: ${error.message}`, 'error');
      reject(error);
    }
  });
}

// Enhanced logging for WebSocket events
export function setupWebSocketLogging(socket, prefix = '') {
  if (!socket) return;
  
  // Store original handlers if they exist
  const originalOnOpen = socket.onopen;
  const originalOnMessage = socket.onmessage;
  const originalOnClose = socket.onclose;
  const originalOnError = socket.onerror;
  
  // Enhance onopen
  socket.onopen = (event) => {
    logDebug(`${prefix}WebSocket connected`);
    if (originalOnOpen) originalOnOpen.call(socket, event);
  };
  
  // Enhance onmessage
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      logDebug(`${prefix}WebSocket received: ${data.type}`);
    } catch (e) {
      logDebug(`${prefix}WebSocket received non-JSON message`);
    }
    if (originalOnMessage) originalOnMessage.call(socket, event);
  };
  
  // Enhance onclose
  socket.onclose = (event) => {
    logDebug(`${prefix}WebSocket closed: ${event.code} - ${event.reason}`, 
      event.code === 1000 ? 'info' : 'warning');
    if (originalOnClose) originalOnClose.call(socket, event);
  };
  
  // Enhance onerror
  socket.onerror = (event) => {
    logDebug(`${prefix}WebSocket error`, 'error');
    if (originalOnError) originalOnError.call(socket, event);
  };
  
  return socket;
}

// Check if environment variables are properly loaded
export function getEnvVariable(key, fallback = null) {
  // First try import.meta.env for Vite
  if (import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  
  // Try window.env for runtime injected env vars
  if (window.env && window.env[key]) {
    return window.env[key];
  }
  
  // Try process.env for Node.js environment
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  
  // Return fallback value if not found
  logDebug(`Environment variable ${key} not found, using fallback value`, 'warning');
  return fallback;
}

// Ably connection singleton
let ablyInstance = null;

// Initialize and get Ably singleton
export function getAblyInstance() {
  if (ablyInstance) {
    return ablyInstance;
  }
  
  const Ably = require('ably');
  const apiKey = getEnvVariable('ABLY_API_KEY', 'wJCxmg.MM9QRw:YCEe19Xuz85-vFqXmcHwSHavTTDYAX542v7tiSCSR9o');
  
  logDebug(`Initializing Ably with API key: ${apiKey.split(':')[0]}...`);
  
  try {
    ablyInstance = new Ably.Realtime({
      key: apiKey,
      clientId: `user-${Date.now()}`, // Generate unique client ID
      echoMessages: false
    });
    
    // Add connection state change listener
    ablyInstance.connection.on('connected', () => {
      logDebug('Ably connected successfully', 'info');
    });
    
    ablyInstance.connection.on('disconnected', () => {
      logDebug('Ably disconnected', 'warning');
    });
    
    ablyInstance.connection.on('failed', (err) => {
      logDebug(`Ably connection failed: ${err?.message || 'Unknown error'}`, 'error');
    });
    
    // Handle connection errors
    ablyInstance.connection.on('error', (err) => {
      logDebug(`Ably error: ${err?.message || 'Unknown error'}`, 'error');
    });
    
    return ablyInstance;
  } catch (error) {
    logDebug(`Failed to initialize Ably: ${error.message}`, 'error');
    throw error;
  }
}

// Get Ably channel with proper error handling
export function getAblyChannel(channelId) {
  try {
    const ably = getAblyInstance();
    logDebug(`Getting Ably channel: ${channelId}`);
    return ably.channels.get(channelId);
  } catch (error) {
    logDebug(`Failed to get Ably channel ${channelId}: ${error.message}`, 'error');
    throw error;
  }
}

// Subscribe to an Ably channel with error handling
export async function subscribeToChannel(channel, eventName, callback) {
  try {
    logDebug(`Subscribing to event '${eventName}' on channel '${channel.name}'`);
    await channel.subscribe(eventName, (message) => {
      logDebug(`Received '${eventName}' message: ${JSON.stringify(message.data)}`);
      callback(message);
    });
    return true;
  } catch (error) {
    logDebug(`Failed to subscribe to ${eventName} on ${channel.name}: ${error.message}`, 'error');
    return false;
  }
}

// Publish to an Ably channel with error handling
export async function publishToChannel(channel, eventName, data) {
  try {
    logDebug(`Publishing '${eventName}' message: ${JSON.stringify(data)}`);
    await channel.publish(eventName, data);
    return true;
  } catch (error) {
    logDebug(`Failed to publish to ${eventName} on ${channel.name}: ${error.message}`, 'error');
    return false;
  }
}

// Close Ably connection
export function closeAblyConnection() {
  if (ablyInstance) {
    ablyInstance.connection.close();
    ablyInstance = null;
    logDebug('Ably connection closed');
  }
} 