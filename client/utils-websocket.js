/**
 * WebSocket utility functions for Discord Activity app
 */

// Debug logger function - simplified version
export function logDebug(message, type = 'info') {
  // Check if debug console exists
  const debugConsole = document.getElementById('debug-console-content');
  if (!debugConsole) {
    // When no debug console exists, just use regular console
    if (type === 'error') console.error(message);
    else if (type === 'warning') console.warn(message);
    else console.log(message);
    return;
  }
 
  // Create simplified log entry
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString().split(' ')[0]}] ${message}`;
 
  // Add to console
  debugConsole.appendChild(logEntry);
  debugConsole.scrollTop = debugConsole.scrollHeight;
 
  // Limit entries (reduced from 50 to 30)
  if (debugConsole.children.length > 30) {
    debugConsole.removeChild(debugConsole.children[0]);
  }
}

// Simplified console overrides
export function setupConsoleOverrides() {
  // Store original methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  // Simplified method to convert args to string
  const argsToString = args => args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 0) : arg
  ).join(' ');

  // Override methods with more efficient versions
  console.log = function(...args) {
    originalLog.apply(console, args);
    logDebug(argsToString(args));
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    logDebug(argsToString(args), 'error');
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    logDebug(argsToString(args), 'warning');
  };
}

// Simplified participant rendering
export function renderParticipants(participants, containerId = 'participants-list') {
  const list = document.getElementById(containerId);
  if (!list || !Array.isArray(participants)) return;
 
  list.innerHTML = '';
 
  if (participants.length === 0) {
    list.innerHTML = '<div class="no-participants">No participants found</div>';
    return;
  }
 
  for (const user of participants) {
    if (!user || typeof user !== 'object') continue;
    
    // Simplified avatar logic
    let avatarSrc;
    try {
      avatarSrc = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id || '0') % 6n)}.png`;
    } catch (error) {
      avatarSrc = 'https://cdn.discordapp.com/embed/avatars/0.png';
    }
    
    // Get username
    const username = user.global_name || user.username || 
                    (user.user?.global_name || user.user?.username) || 'Unknown User';
    
    // Create participant element
    const el = document.createElement('div');
    el.className = 'participant-item';
    el.innerHTML = `
      <img src="${avatarSrc}" alt="Avatar" class="participant-avatar">
      <span class="participant-name">${username}</span>
    `;
    
    list.appendChild(el);
  }
}

// Simplified debug console
export function setupDebugConsole() {
  const toggleButton = document.getElementById('toggle-debug');
  if (!toggleButton) return;
 
  toggleButton.addEventListener('click', () => {
    const debugConsole = document.getElementById('debug-console');
    if (debugConsole) {
      debugConsole.classList.toggle('minimized');
      toggleButton.textContent = debugConsole.classList.contains('minimized') ? '□' : '_';
    }
  });
 
  logDebug('Debug console ready');
}

// Simplified debug console creation
export function createDebugConsole(container) {
  if (!container) return;
  
  const debugConsole = document.createElement('div');
  debugConsole.id = 'debug-console';
  debugConsole.className = 'debug-console minimized'; // Start minimized
  debugConsole.innerHTML = `
    <div class="debug-header">
      <span>Debug</span>
      <button id="toggle-debug" class="toggle-debug">□</button>
    </div>
    <div id="debug-console-content" class="debug-console-content"></div>
  `;
 
  container.appendChild(debugConsole);
  setupDebugConsole();
}

// Generate a random color - moved to top as shared utility
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
    // --- DEBUG LOGGING --- 
    console.log("Client WebSocket received raw data:", event.data);
    // --- END DEBUG LOGGING --- 
    try {
      const data = JSON.parse(event.data);
      // --- DEBUG LOGGING --- 
      console.log("Client WebSocket parsed message:", data);
      // --- END DEBUG LOGGING --- 
      // Add more detailed logging for debugging
      if (data.type === 'publish') {
        logDebug(`${prefix}WebSocket received: ${data.type}, channel: ${data.channel}, event: ${data.event}`);
      } else {
        logDebug(`${prefix}WebSocket received: ${data.type}`);
      }
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
    
    // Simple error extraction - just get the message
    if (error && error.message) {
      return error.message;
    }
    
    // If nothing else works, convert to string
    return String(error);
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
  // Hard-coded to true since we only run in Discord
  return true;
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
 
  try {
    // Always use Discord WebSocket URL format
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const finalWsUrl = `${protocol}//${window.location.host}/ws`;
   
    notifyStateChange(CONNECTION_STATES.CONNECTING);
    logDebug(`Connecting to WebSocket: ${finalWsUrl}`);
    logDebug(`Connection details: Network online=${navigator.onLine}, Protocol=${window.location.protocol}, Location=${window.location.href}`);
   
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
      
      // Log more details about the closure if not clean
      if (!wasClean) {
        // Common close codes and their meaning
        const closeCodeMeanings = {
          1006: "Connection closed abnormally",
          1011: "Server error",
          1012: "Service restart",
          1013: "Try again later"
        };
        
        const explanation = closeCodeMeanings[event.code] || "Unknown reason";
        logDebug(`Close reason: ${explanation}`, 'warning');
      }
      
      notifyStateChange(CONNECTION_STATES.DISCONNECTED);
     
      // Only attempt to reconnect if not cleanly closed
      if (!wasClean) {
        attemptReconnect();
      }
    };
   
    wsInstance.onerror = (error) => {
      logDebug(`WebSocket error: ${extractErrorInfo(error)}`, 'error');
      notifyStateChange(CONNECTION_STATES.FAILED);
      
      // Log URL mapping hint for Discord
      logDebug('Check that your URL mappings are correctly configured in the Discord Developer Portal.', 'warning');
    };
   
    wsInstance.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
       
        // Handle different message types
        if (message.type === 'publish' && message.channel && message.event) {
          // Find channel and dispatch message to subscribers
          const channel = wsChannels[message.channel];
          if (channel) {
            channel.dispatchEvent(message.event, message.data);
          }
        } else if (message.type === 'message' && message.channel && message.event) {
          // Handle legacy message format
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
    logDebug(`Failed to initialize WebSocket: ${error.message}`, 'error');
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

// WebSocket Channel Class - Streamlined version
class WebSocketChannel {
  constructor(channelId) {
    this.name = channelId;
    this.eventHandlers = new Map();
   
    // Register channel
    wsChannels[channelId] = this;
   
    // Subscribe to channel on server
    const ws = getWebSocketInstance();
    if (ws.readyState === WebSocket.OPEN) {
      this.sendSubscription();
    }
  }
  
  // Send subscription to server
  sendSubscription() {
    const ws = getWebSocketInstance();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: this.name
      }));
      logDebug(`Subscribed to channel: ${this.name}`);
    }
  }
 
  // Subscribe to events on this channel
  subscribe(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
   
    this.eventHandlers.get(eventName).add(callback);
    logDebug(`Subscribed to '${eventName}' on channel '${this.name}'`);
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
  }
 
  // Publish event to this channel
  publish(eventName, data) {
    const ws = getWebSocketInstance();
   
    if (ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'));
    }
   
    try {
      ws.send(JSON.stringify({
        type: 'publish',
        channel: this.name,
        event: eventName,
        data: data
      }));
      return Promise.resolve();
    } catch (error) {
      logDebug(`Error publishing to channel: ${error.message}`, 'error');
      return Promise.reject(error);
    }
  }
 
  // Dispatch event to subscribers (called by WebSocket manager)
  dispatchEvent(eventName, data) {
    if (!this.eventHandlers.has(eventName)) return;
   
    // --- DEBUG LOGGING ---
    console.log(`WebSocketChannel [${this.name}]: Dispatching event '${eventName}' with data:`, data);
    // --- END DEBUG LOGGING ---

    this.eventHandlers.get(eventName).forEach(callback => {
      try {
        // Pass the data payload DIRECTLY to the callback
        callback(data); 
      } catch (error) {
        logDebug(`Error in event handler for '${eventName}': ${error.message}`, 'error');
      }
    });
  }
}

// Get WebSocket channel - simplified
export function getWebSocketChannel(channelId) {
  return wsChannels[channelId] || new WebSocketChannel(channelId);
}

// Simplified subscribe to channel
export async function subscribeToChannel(channel, eventName, callback) {
  if (!channel) return false;
  await channel.subscribe(eventName, callback);
  return true;
}

// Simplified publish to channel
export async function publishToChannel(channel, eventName, data) {
  if (!channel) return false;
  await channel.publish(eventName, data);
  return true;
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

// Join a game room via WebSocket
export function joinGameRoom(instanceId, userId, gameType = 'lobby') {
  const ws = getWebSocketInstance();
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    const joinMessage = {
      type: 'join_room',
      instanceId,
      userId,
      gameType
    };
    
    logDebug(`Joining game room: ${gameType} in instance ${instanceId} as user ${userId}`);
    ws.send(JSON.stringify(joinMessage));
    return true;
  } else {
    logDebug('Cannot join room: WebSocket not connected', 'error');
    return false;
  }
} 