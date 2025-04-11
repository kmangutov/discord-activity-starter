/**
 * Simple WebSocket connection manager
 */

// WebSocket instance
let socket = null;
let connected = false;
let userInfo = null;
let reconnectTimer = null;

// Event handlers
let onMessageHandlers = [];
let onUserJoinedHandlers = [];
let onUserLeftHandlers = [];
let onConnectHandlers = [];
let onDisconnectHandlers = [];
let onErrorHandlers = [];

/**
 * Get the WebSocket URL based on environment
 * @returns {string} WebSocket URL
 */
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  return `${protocol}//${host}`;
};

/**
 * Initialize WebSocket connection
 * @param {Object} user - User information to send on connection
 */
export function connect(user) {
  // Store user info for reconnect
  userInfo = user;
  
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Create WebSocket connection
  socket = new WebSocket(getWebSocketUrl());
  
  // Set up event handlers
  socket.onopen = () => {
    console.log('WebSocket connected');
    connected = true;
    
    // Send join message with user info
    if (userInfo) {
      send('join', userInfo);
    }
    
    // Notify connect handlers
    onConnectHandlers.forEach(handler => handler());
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          onMessageHandlers.forEach(handler => handler(data.userId, data.message));
          break;
        case 'user_joined':
          onUserJoinedHandlers.forEach(handler => handler(data.userId));
          break;
        case 'user_left':
          onUserLeftHandlers.forEach(handler => handler(data.userId));
          break;
        case 'error':
          onErrorHandlers.forEach(handler => handler(data.message));
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('WebSocket disconnected');
    connected = false;
    socket = null;
    
    // Notify disconnect handlers
    onDisconnectHandlers.forEach(handler => handler());
    
    // Reconnect after delay
    if (userInfo) {
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect(userInfo);
      }, 5000);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    onErrorHandlers.forEach(handler => handler('Connection error'));
  };
}

/**
 * Disconnect WebSocket
 */
export function disconnect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close();
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  socket = null;
  connected = false;
}

/**
 * Register event callback
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
export function on(event, callback) {
  switch (event) {
    case 'message':
      onMessageHandlers.push(callback);
      break;
    case 'userJoined':
      onUserJoinedHandlers.push(callback);
      break;
    case 'userLeft':
      onUserLeftHandlers.push(callback);
      break;
    case 'connect':
      onConnectHandlers.push(callback);
      break;
    case 'disconnect':
      onDisconnectHandlers.push(callback);
      break;
    case 'error':
      onErrorHandlers.push(callback);
      break;
  }
}

/**
 * Remove event callback
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
export function off(event, callback) {
  switch (event) {
    case 'message':
      onMessageHandlers = onMessageHandlers.filter(handler => handler !== callback);
      break;
    case 'userJoined':
      onUserJoinedHandlers = onUserJoinedHandlers.filter(handler => handler !== callback);
      break;
    case 'userLeft':
      onUserLeftHandlers = onUserLeftHandlers.filter(handler => handler !== callback);
      break;
    case 'connect':
      onConnectHandlers = onConnectHandlers.filter(handler => handler !== callback);
      break;
    case 'disconnect':
      onDisconnectHandlers = onDisconnectHandlers.filter(handler => handler !== callback);
      break;
    case 'error':
      onErrorHandlers = onErrorHandlers.filter(handler => handler !== callback);
      break;
  }
}

/**
 * Send message to server
 * @param {string} type - Message type
 * @param {Object} data - Message data
 * @returns {boolean} Whether message was sent
 */
export function send(type, data = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  socket.send(JSON.stringify({
    type,
    ...data
  }));
  
  return true;
}

/**
 * Send chat message
 * @param {string} message - Message text
 * @returns {boolean} Whether message was sent
 */
export function sendMessage(message) {
  return send('message', { message });
}

/**
 * Check if connected to WebSocket
 * @returns {boolean} Connection status
 */
export function isConnected() {
  return connected;
} 