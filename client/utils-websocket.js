/**
 * WebSocket utility functions for Discord Activity app
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
    // Extract more information from error event
    const errorInfo = extractErrorInfo(event);
    logDebug(`${prefix}WebSocket error: ${errorInfo}`, 'error');
    if (originalOnError) originalOnError.call(socket, event);
  };
 
  return socket;
}

// Extract useful information from error objects
function extractErrorInfo(error) {
  try {
    // If it's an Event object with an error property (common in WebSocket errors)
    if (error && error.error) {
      return extractErrorInfo(error.error);
    }
    
    // Handle the simple {type:"error"} case
    if (error && error.type === "error" && Object.keys(error).length === 1) {
      // Enhanced error info for this specific case
      let enhancedInfo = {
        type: "error",
        context: "WebSocket connection failed"
      };
      
      // Try to get WebSocket details if available
      if (error.target instanceof WebSocket) {
        enhancedInfo.url = error.target.url;
        enhancedInfo.readyState = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][error.target.readyState];
        
        // Check for common issues based on the URL
        const wsUrl = error.target.url;
        if (wsUrl) {
          if (window.location.protocol === 'https:' && wsUrl.startsWith('ws:')) {
            enhancedInfo.mixedContent = "Mixed content: HTTPS page trying to connect to insecure WS endpoint";
          }
          
          // Check if using Discord URL mapping correctly
          if (isInDiscordEnvironment() && !wsUrl.endsWith('/ws')) {
            enhancedInfo.mappingIssue = "Possible Discord URL mapping issue - URL should end with /ws";
          }
        }
      }
      
      // Add navigator info for network troubleshooting
      enhancedInfo.online = navigator.onLine;
      
      return JSON.stringify(enhancedInfo);
    }
    
    // Try to get standard error properties
    const errorProps = ["message", "name", "code", "type", "status", "statusText", "cause"];
    const extractedInfo = {};
    
    // Copy enumerable and non-enumerable properties
    errorProps.forEach(prop => {
      if (error[prop] !== undefined) {
        extractedInfo[prop] = error[prop];
      }
    });
    
    // Add stack if available but trimmed
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      extractedInfo.stack = stackLines.length > 3 ? 
        stackLines.slice(0, 3).join('\n') + '...' : 
        error.stack;
    }
    
    // If we have no properties but it's an object with a toString method
    if (Object.keys(extractedInfo).length === 0 && typeof error === 'object' && error !== null) {
      // For Event objects, try to get more info
      if (error instanceof Event) {
        extractedInfo.type = error.type;
        extractedInfo.target = error.target ? 
          (error.target.url || error.target.constructor.name) : 
          'unknown';
        extractedInfo.isTrusted = error.isTrusted;
        
        // For WebSocket specific errors
        if (error.target instanceof WebSocket) {
          extractedInfo.readyState = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][error.target.readyState];
          extractedInfo.url = error.target.url;
          
          // Try to extract network info
          if (window.navigator) {
            extractedInfo.online = navigator.onLine;
          }
        }
      } else {
        // Last resort - use toString()
        return error.toString();
      }
    }
    
    return JSON.stringify(extractedInfo);
  } catch (e) {
    // If all else fails, return a basic message
    return `Error: ${error && error.message ? error.message : 'Unknown error'}`;
  }
}

// Check if environment variables are properly loaded
export function getEnvVariable(key, fallback = null) {
  // For Vite, use import.meta.env
  if (import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }

  // For Vite with define in vite.config.js, use process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
 
  // Try window.env for runtime injected env vars
  if (window.env && window.env[key]) {
    return window.env[key];
  }
 
  // Log for debugging
  console.log(`Using fallback value for ${key}`, fallback);
 
  // Return fallback value if not found
  return fallback;
}

// Check if running in Discord environment
export function isInDiscordEnvironment() {
  return typeof window !== 'undefined' &&
         window.discordSdk &&
         window.discordSdk.isInDiscord;
}

// ----- WebSocket Connection Management -----

// WebSocket connection singleton
let wsInstance = null;
let wsChannels = {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // Start with 1s delay
const CONNECTION_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

// WebSocket connection status
let connectionState = CONNECTION_STATES.DISCONNECTED;
let connectionStateListeners = [];

// Add connection state listener
export function addConnectionStateListener(callback) {
  connectionStateListeners.push(callback);
}

// Remove connection state listener
export function removeConnectionStateListener(callback) {
  connectionStateListeners = connectionStateListeners.filter(cb => cb !== callback);
}

// Notify all listeners of state change
function notifyStateChange(newState) {
  connectionState = newState;
  connectionStateListeners.forEach(callback => {
    try {
      callback(newState);
    } catch (error) {
      logDebug(`Error in connection state listener: ${error.message}`, 'error');
    }
  });
}

// Initialize and get WebSocket singleton
export function getWebSocketInstance() {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    return wsInstance;
  }
 
  // Get WebSocket URL from environment
  const wsUrl = getEnvVariable('WS_SERVER_URL', 'wss://brebiskingactivity-production.up.railway.app/ws');
 
  try {
    // Check if we're in Discord to use the mapped URLs
    const isInDiscord = isInDiscordEnvironment();
   
    // Use different URL construction if in Discord environment
    let finalWsUrl;
    if (isInDiscord) {
      // For Discord, we have two options:
      // 1. Use the current hostname with /ws path (works if URL mapping is set up correctly)
      // 2. Try the special Discord WebSocket format (may be needed in some environments)
      
      // Check if we're on the discordsays.com domain, which indicates we're in the Discord sandbox
      const isDiscordSays = window.location.hostname.includes('discordsays.com');
      
      if (isDiscordSays) {
        // If we're on discordsays.com, we need to use the full hostname
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        finalWsUrl = `${protocol}//${window.location.host}/ws`;
        logDebug(`Using Discord sandbox WebSocket URL: ${finalWsUrl}`);
      } else {
        // For Discord production, we use the plain /ws path which Discord maps
        finalWsUrl = '/ws';
        logDebug(`Using Discord production WebSocket URL: ${finalWsUrl}`);
      }
    } else {
      finalWsUrl = wsUrl;
      logDebug(`Using direct WebSocket URL: ${finalWsUrl}`);
    }
   
    notifyStateChange(CONNECTION_STATES.CONNECTING);
    logDebug(`Connecting to WebSocket: ${finalWsUrl}`);
    logDebug(`Connection details: Discord environment=${isInDiscord}, Network online=${navigator.onLine}, Protocol=${window.location.protocol}, Location=${window.location.href}`);
   
    // Create new WebSocket instance
    wsInstance = new WebSocket(finalWsUrl);
   
    // Setup enhanced logging
    setupWebSocketLogging(wsInstance, 'Main: ');
   
    // Setup event handlers
    wsInstance.onopen = () => {
      logDebug('WebSocket connected successfully', 'info');
      notifyStateChange(CONNECTION_STATES.CONNECTED);
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
     
      // Resubscribe to all channels
      Object.entries(wsChannels).forEach(([channelId, channel]) => {
        // Send subscription message for this channel
        wsInstance.send(JSON.stringify({
          type: 'subscribe',
          channel: channelId
        }));
       
        logDebug(`Resubscribed to channel: ${channelId}`);
      });
    };
   
    wsInstance.onclose = (event) => {
      const wasClean = event.code === 1000;
      logDebug(`WebSocket closed: ${event.code} - ${event.reason}`, wasClean ? 'info' : 'warning');
      
      // Log more details about the closure
      if (!wasClean) {
        logDebug(`Abnormal closure details: code=${event.code}, reason="${event.reason || 'none'}", wasClean=${wasClean}`, 'warning');
        
        // Interpret common close codes
        const closeCodeMeanings = {
          1001: "Endpoint going away (server shutdown)",
          1002: "Protocol error",
          1003: "Unsupported data",
          1005: "No status code (abnormal)",
          1006: "Abnormal closure (connection failed)",
          1007: "Invalid frame payload data",
          1008: "Policy violation",
          1009: "Message too big",
          1010: "Extension negotiation failed",
          1011: "Unexpected server error",
          1012: "Service restart",
          1013: "Try again later",
          1014: "Bad gateway",
          1015: "TLS handshake failure"
        };
        
        const explanation = closeCodeMeanings[event.code] || "Unknown reason";
        logDebug(`Close code explanation: ${explanation}`, 'warning');
        
        if (event.code === 1006) {
          logDebug('Code 1006 typically indicates a network issue or CORS problem', 'warning');
          if (isInDiscordEnvironment()) {
            logDebug('In Discord: check URL mappings in Developer Portal', 'warning');
          } else {
            logDebug('Check that server is running and WebSocket URL is correct', 'warning');
          }
        }
      }
      
      notifyStateChange(CONNECTION_STATES.DISCONNECTED);
     
      // Only attempt to reconnect if not cleanly closed
      if (!wasClean) {
        attemptReconnect();
      }
    };
   
    wsInstance.onerror = (error) => {
      const errorInfo = extractErrorInfo(error);
      logDebug(`WebSocket error: ${errorInfo}`, 'error');
      notifyStateChange(CONNECTION_STATES.FAILED);
      
      // Check if the error might be related to security or CORS
      if (errorInfo.includes('security') || errorInfo.includes('CORS') || 
          errorInfo.includes('certificate') || errorInfo.includes('Mixed Content')) {
        logDebug('This appears to be a security-related error. Check HTTPS/WSS configuration.', 'error');
      }
      
      // Check for network errors
      if (errorInfo.includes('network') || errorInfo.includes('connect') || 
          errorInfo.includes('ECONNREFUSED') || errorInfo.includes('timeout')) {
        logDebug('This appears to be a network connectivity issue. Check your internet connection and server status.', 'error');
      }
      
      // Check if in Discord and possibly URL mapping issues
      if (isInDiscordEnvironment()) {
        logDebug('Since this is running in Discord, check that your URL mappings are correctly configured in the Discord Developer Portal.', 'warning');
        logDebug('The URL mapping should be: "/" → "brebiskingactivity-production.up.railway.app" (no protocol, no path)', 'warning');
      }
    };
   
    wsInstance.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
       
        // Handle different message types
        if (message.type === 'message' && message.channel && message.event) {
          // Find channel and dispatch message to subscribers
          const channel = wsChannels[message.channel];
          if (channel) {
            channel.dispatchEvent(message.event, message.data);
          }
        } else if (message.type === 'system') {
          // Handle system messages
          logDebug(`System message: ${message.message}`);
        }
      } catch (error) {
        logDebug(`Error processing WebSocket message: ${error.message}`, 'error');
      }
    };
   
    return wsInstance;
  } catch (error) {
    const errorDetails = extractErrorInfo(error);
    logDebug(`Failed to initialize WebSocket: ${errorDetails}`, 'error');
    logDebug(`URL attempted: ${wsUrl}`, 'error');
    
    if (isInDiscordEnvironment()) {
      logDebug('In Discord, WebSocket URL should be "/ws" and URL mappings must be configured correctly', 'warning');
    }
    
    notifyStateChange(CONNECTION_STATES.FAILED);
    throw error;
  }
}

// Attempt to reconnect with exponential backoff
function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logDebug(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`, 'error');
    notifyStateChange(CONNECTION_STATES.FAILED);
    return;
  }
 
  // Calculate delay with exponential backoff (with jitter)
  const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectAttempts) * (0.9 + Math.random() * 0.2);
  reconnectAttempts++;
 
  logDebug(`Attempting to reconnect in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'info');
 
  setTimeout(() => {
    if (wsInstance?.readyState !== WebSocket.OPEN) {
      // Close existing socket if it exists
      if (wsInstance) {
        try {
          wsInstance.close();
        } catch (e) {
          // Ignore errors when closing
        }
      }
     
      // Create new instance
      getWebSocketInstance();
    }
  }, delay);
}

// WebSocket Channel Class
class WebSocketChannel {
  constructor(channelId) {
    this.name = channelId;
    this.eventHandlers = new Map();
   
    // Register channel
    wsChannels[channelId] = this;
   
    // Subscribe to channel on server
    const ws = getWebSocketInstance();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: channelId
      }));
      logDebug(`Subscribed to channel: ${channelId}`);
    }
  }
 
  // Subscribe to events on this channel
  subscribe(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
   
    this.eventHandlers.get(eventName).add(callback);
    logDebug(`Added subscription to event '${eventName}' on channel '${this.name}'`);
   
    return Promise.resolve();
  }
 
  // Unsubscribe from events
  unsubscribe(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) return;
   
    if (callback) {
      this.eventHandlers.get(eventName).delete(callback);
    } else {
      this.eventHandlers.delete(eventName);
    }
   
    logDebug(`Removed subscription to event '${eventName}' on channel '${this.name}'`);
  }
 
  // Publish event to this channel
  publish(eventName, data) {
    const ws = getWebSocketInstance();
   
    if (ws.readyState !== WebSocket.OPEN) {
      logDebug(`Cannot publish - WebSocket not connected`, 'error');
      return Promise.reject(new Error('WebSocket not connected'));
    }
   
    try {
      ws.send(JSON.stringify({
        type: 'publish',
        channel: this.name,
        event: eventName,
        data: data
      }));
     
      logDebug(`Published '${eventName}' to channel '${this.name}'`);
      return Promise.resolve();
    } catch (error) {
      logDebug(`Error publishing to channel: ${error.message}`, 'error');
      return Promise.reject(error);
    }
  }
 
  // Dispatch event to subscribers (called by WebSocket manager)
  dispatchEvent(eventName, data) {
    if (!this.eventHandlers.has(eventName)) return;
   
    this.eventHandlers.get(eventName).forEach(callback => {
      try {
        callback({ data }); // Format to match expected message format
      } catch (error) {
        logDebug(`Error in event handler for '${eventName}': ${error.message}`, 'error');
      }
    });
  }
}

// Get WebSocket channel
export function getWebSocketChannel(channelId) {
  try {
    // Check if channel already exists
    if (wsChannels[channelId]) {
      return wsChannels[channelId];
    }
    
    // Otherwise create new channel
    logDebug(`Creating new WebSocket channel: ${channelId}`);
    return new WebSocketChannel(channelId);
  } catch (error) {
    logDebug(`Failed to get WebSocket channel ${channelId}: ${error.message}`, 'error');
    throw error;
  }
}

// Monitor network for WebSocket connectivity
export function setupXHRErrorMonitoring() {
  if (typeof window === 'undefined') return;
  
  // Simple version that monitors network connectivity
  logDebug('WebSocket monitoring enabled', 'info');
  
  // Watch for network issues that might affect WebSockets
  window.addEventListener('offline', () => {
    logDebug('Network connection lost - WebSocket connections may be affected', 'warning');
  });
  
  window.addEventListener('online', () => {
    logDebug('Network connection restored - attempting to reconnect WebSockets', 'info');
    // Try to reconnect WebSocket
    reconnectWebSocket();
  });
}

// Subscribe to a WebSocket channel with error handling
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

// Publish to a WebSocket channel with error handling
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

// Close WebSocket connection
export function closeWebSocketConnection() {
  if (wsInstance && wsInstance.readyState !== WebSocket.CLOSED) {
    wsInstance.close(1000, 'Normal closure');
    wsInstance = null;
    wsChannels = {};
    logDebug('WebSocket connection closed');
  }
}

// Force reconnection to WebSocket
export function reconnectWebSocket() {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    logDebug('Forcing WebSocket reconnection', 'info');
    wsInstance.close(1000, 'Reconnect requested');
    wsInstance = null;
  }
 
  return getWebSocketInstance();
} 