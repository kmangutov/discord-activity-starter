import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';

// Define types for client info
interface ClientInfo {
  userId: string;
  instanceId: string;
}

// Define types for WebSocket messages
interface BaseMessage {
  type: string;
}

interface JoinMessage extends BaseMessage {
  type: 'join';
  userId: string;
  instanceId: string;
  activityId?: string;
}

interface ChatMessage extends BaseMessage {
  type: 'message';
  message: string;
}

interface UserJoinedMessage extends BaseMessage {
  type: 'user_joined';
  userId: string;
}

interface UserLeftMessage extends BaseMessage {
  type: 'user_left';
  userId: string;
}

interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

type WebSocketMessage = JoinMessage | ChatMessage | UserJoinedMessage | UserLeftMessage | ErrorMessage;

// Extend WebSocket to include user properties
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  instanceId?: string;
  activityId?: string;
}

// Track all connected clients
const clients = new Map<ExtendedWebSocket, ClientInfo>();

/**
 * Enhanced logging function
 * @param level - Log level
 * @param message - Log message
 * @param data - Optional data to log
 */
function serverLog(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [WebSocket] [${level.toUpperCase()}]`;
  
  if (data) {
    if (typeof data === 'object') {
      console[level](`${logPrefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console[level](`${logPrefix} ${message}`, data);
    }
  } else {
    console[level](`${logPrefix} ${message}`);
  }
}

/**
 * Initialize WebSocket server
 * @param server - HTTP server instance
 * @returns WebSocket server instance
 */
export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  
  // Log WebSocket server events
  wss.on('listening', () => {
    serverLog('info', 'WebSocket server is listening for connections');
  });

  wss.on('error', (error: Error) => {
    serverLog('error', 'WebSocket server error:', error);
  });

  // WebSocket connection handler
  wss.on('connection', handleConnection);
  
  return wss;
}

/**
 * Handle new WebSocket connection
 * @param ws - WebSocket connection
 * @param req - HTTP request
 */
function handleConnection(ws: ExtendedWebSocket, req: IncomingMessage): void {
  const clientIp = req.socket.remoteAddress;
  serverLog('info', `New client connected from: ${clientIp}`);
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      serverLog('info', `Ping sent to client ${ws.userId || 'Unknown'}`);
    }
  }, 30000);
  
  ws.on('message', (message: Buffer) => handleMessage(ws, message));
  
  // Handle WebSocket-specific errors
  ws.on('error', (error: Error) => {
    serverLog('error', `Client error for user ${ws.userId || 'Unknown'}:`, error);
    clearInterval(pingInterval);
    clients.delete(ws);
  });
  
  // Handle disconnection
  ws.on('close', () => {
    serverLog('info', `Client disconnected - User: ${ws.userId || 'Unknown'}`);
    
    clearInterval(pingInterval);
    
    const clientInfo = clients.get(ws);
    clients.delete(ws);
    
    if (clientInfo) {
      const eventData = {
        type: 'user_left',
        userId: clientInfo.userId
      };
      serverLog('info', `Broadcasting user_left event:`, eventData);
      broadcastToInstance(clientInfo.instanceId, eventData);
    }
  });
}

/**
 * Handle incoming WebSocket message
 * @param ws - WebSocket connection
 * @param message - Incoming message
 */
function handleMessage(ws: ExtendedWebSocket, message: Buffer): void {
  try {
    const messageStr = message.toString();
    serverLog('info', `Message received from ${ws.userId || 'Unknown'}: ${messageStr}`);
    
    const data = JSON.parse(messageStr) as WebSocketMessage;
    
    // Handle initial connection message with userId
    if (data.type === 'join') {
      const { userId, instanceId, activityId } = data;
      
      if (!userId) {
        const errorData = { type: 'error', message: 'Missing userId' };
        serverLog('error', 'Join attempt without userId', data);
        ws.send(JSON.stringify(errorData));
        return;
      }
      
      // Store user info on the socket
      ws.userId = userId;
      ws.instanceId = instanceId;
      if (activityId) {
        serverLog('info', `User ${userId} joined Discord activity ${activityId} in instance ${instanceId}`);
      } else {
        serverLog('info', `User ${userId} joined local session in instance ${instanceId}`);
      }
      
      // Add to clients map
      clients.set(ws, { userId, instanceId });
      
      // Notify all clients in the same instance about the new user
      const eventData = {
        type: 'user_joined',
        userId: userId
      };
      serverLog('info', `Broadcasting user_joined event:`, eventData);
      broadcastToInstance(instanceId, eventData, ws);
    } 
    // Handle message broadcasting
    else if (data.type === 'message' && ws.instanceId && 'message' in data) {
      // Broadcast the message to all clients in the same instance
      const messageData = {
        type: 'message',
        userId: ws.userId || '',
        message: data.message
      };
      serverLog('info', `Broadcasting message event:`, messageData);
      broadcastToInstance(ws.instanceId, messageData);
    }
  } catch (error) {
    serverLog('error', `Error processing message:`, error);
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
  }
}

/**
 * Broadcast a message to all clients in a specific instance
 * @param instanceId - Instance ID to broadcast to
 * @param data - Data to broadcast
 * @param excludeSocket - Optional socket to exclude from broadcast
 */
export function broadcastToInstance(instanceId: string, data: object, excludeSocket: ExtendedWebSocket | null = null): void {
  const clientCount = Array.from(clients.entries())
    .filter(([client, info]) => info.instanceId === instanceId)
    .length;
  
  serverLog('info', `Broadcasting to instance ${instanceId} (${clientCount} clients)`);
  
  let sentCount = 0;
  clients.forEach((clientInfo, client) => {
    if (client !== excludeSocket && 
        client.readyState === WebSocket.OPEN && 
        clientInfo.instanceId === instanceId) {
      client.send(JSON.stringify(data));
      sentCount++;
    }
  });
  
  serverLog('info', `Broadcast complete - sent to ${sentCount} clients`);
}

/**
 * Get all active WebSocket connections
 * @returns The clients map
 */
export function getActiveConnections(): Map<ExtendedWebSocket, ClientInfo> {
  return clients;
}

/**
 * Get all connections for a specific instance
 * @param instanceId - Instance ID
 * @returns Array of WebSocket connections
 */
export function getInstanceConnections(instanceId: string): Array<{
  socket: ExtendedWebSocket,
  userId: string,
  instanceId: string,
  activityId?: string
}> {
  const instanceConnections: Array<{
    socket: ExtendedWebSocket,
    userId: string,
    instanceId: string,
    activityId?: string
  }> = [];
  
  clients.forEach((clientInfo, client) => {
    if (clientInfo.instanceId === instanceId) {
      instanceConnections.push({
        socket: client,
        userId: clientInfo.userId,
        instanceId: clientInfo.instanceId,
        activityId: client.activityId
      });
    }
  });
  
  return instanceConnections;
}

/**
 * Disconnect all clients
 */
export function closeAllConnections(): void {
  clients.forEach((clientInfo, client) => {
    try {
      client.close();
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  });
  
  clients.clear();
} 