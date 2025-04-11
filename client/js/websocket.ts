/**
 * Simple WebSocket connection manager
 */

// Define types for user info
interface UserInfo {
  userId: string;
  username: string;
  instanceId?: string;
  activityId?: string;
}

// Define types for event handlers
type MessageHandler = (userId: string, message: string) => void;
type UserJoinedHandler = (userId: string) => void;
type UserLeftHandler = (userId: string) => void;
type ConnectHandler = () => void;
type DisconnectHandler = () => void;
type ErrorHandler = (message: string) => void;

// WebSocket instance
let socket: WebSocket | null = null;
let connected: boolean = false;
let userInfo: UserInfo | null = null;
let reconnectTimer: number | null = null;

// Event handlers
let onMessageHandlers: MessageHandler[] = [];
let onUserJoinedHandlers: UserJoinedHandler[] = [];
let onUserLeftHandlers: UserLeftHandler[] = [];
let onConnectHandlers: ConnectHandler[] = [];
let onDisconnectHandlers: DisconnectHandler[] = [];
let onErrorHandlers: ErrorHandler[] = [];

/**
 * Get the WebSocket URL based on environment
 * @returns WebSocket URL
 */
const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  return `${protocol}//${host}`;
};

/**
 * Initialize WebSocket connection
 * @param user - User information to send on connection
 */
export function connect(user: UserInfo): void {
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
  
  socket.onmessage = (event: MessageEvent) => {
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
      reconnectTimer = window.setTimeout(() => {
        console.log('Attempting to reconnect...');
        if (userInfo) {
          connect(userInfo);
        }
      }, 5000);
    }
  };
  
  socket.onerror = (error: Event) => {
    console.error('WebSocket error:', error);
    onErrorHandlers.forEach(handler => handler('Connection error'));
  };
}

/**
 * Disconnect WebSocket
 */
export function disconnect(): void {
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
 * @param event - Event name
 * @param callback - Callback function
 */
export function on(
  event: 'message' | 'userJoined' | 'userLeft' | 'connect' | 'disconnect' | 'error', 
  callback: MessageHandler | UserJoinedHandler | UserLeftHandler | ConnectHandler | DisconnectHandler | ErrorHandler
): void {
  switch (event) {
    case 'message':
      onMessageHandlers.push(callback as MessageHandler);
      break;
    case 'userJoined':
      onUserJoinedHandlers.push(callback as UserJoinedHandler);
      break;
    case 'userLeft':
      onUserLeftHandlers.push(callback as UserLeftHandler);
      break;
    case 'connect':
      onConnectHandlers.push(callback as ConnectHandler);
      break;
    case 'disconnect':
      onDisconnectHandlers.push(callback as DisconnectHandler);
      break;
    case 'error':
      onErrorHandlers.push(callback as ErrorHandler);
      break;
  }
}

/**
 * Remove event callback
 * @param event - Event name
 * @param callback - Callback function
 */
export function off(
  event: 'message' | 'userJoined' | 'userLeft' | 'connect' | 'disconnect' | 'error', 
  callback: MessageHandler | UserJoinedHandler | UserLeftHandler | ConnectHandler | DisconnectHandler | ErrorHandler
): void {
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
 * @param type - Message type
 * @param data - Message data
 * @returns Whether message was sent
 */
export function send(type: string, data: Record<string, any> = {}): boolean {
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
 * @param message - Message text
 * @returns Whether message was sent
 */
export function sendMessage(message: string): boolean {
  return send('message', { message });
}

/**
 * Check if connected to WebSocket
 * @returns Connection status
 */
export function isConnected(): boolean {
  return connected;
} 