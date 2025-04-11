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
 * Initialize WebSocket server
 * @param server - HTTP server instance
 * @returns WebSocket server instance
 */
export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  
  // Log WebSocket server events
  wss.on('listening', () => {
    console.log('WebSocket server is listening for connections');
  });

  wss.on('error', (error: Error) => {
    console.error('WebSocket server error:', error);
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
  console.log('WebSocket client connected from:', req.socket.remoteAddress);
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);
  
  ws.on('message', (message: Buffer) => handleMessage(ws, message));
  
  // Handle WebSocket-specific errors
  ws.on('error', (error: Error) => {
    console.error('WebSocket client error:', error);
    clearInterval(pingInterval);
    clients.delete(ws);
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`WebSocket client disconnected - User: ${ws.userId || 'Unknown'}`);
    
    clearInterval(pingInterval);
    
    const clientInfo = clients.get(ws);
    clients.delete(ws);
    
    if (clientInfo) {
      broadcastToInstance(clientInfo.instanceId, {
        type: 'user_left',
        userId: clientInfo.userId
      });
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
    console.log('WebSocket message received:', message.toString().substring(0, 200));
    const data = JSON.parse(message.toString()) as WebSocketMessage;
    
    // Handle initial connection message with userId
    if (data.type === 'join') {
      const { userId, instanceId, activityId } = data;
      
      if (!userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Missing userId' }));
        return;
      }
      
      // Store user info on the socket
      ws.userId = userId;
      ws.instanceId = instanceId;
      if (activityId) {
        ws.activityId = activityId;
        console.log(`User ${userId} joined Discord activity ${activityId}`);
      } else {
        console.log(`User ${userId} joined local session ${instanceId}`);
      }
      
      // Add to clients map
      clients.set(ws, { userId, instanceId });
      
      // Notify all clients in the same instance about the new user
      broadcastToInstance(instanceId, {
        type: 'user_joined',
        userId: userId
      }, ws);
    } 
    // Handle message broadcasting
    else if (data.type === 'message' && ws.instanceId && 'message' in data) {
      // Broadcast the message to all clients in the same instance
      broadcastToInstance(ws.instanceId, {
        type: 'message',
        userId: ws.userId || '',
        message: data.message
      });
    }
  } catch (error) {
    console.error('Error processing WebSocket message:', error);
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
  clients.forEach((clientInfo, client) => {
    if (client !== excludeSocket && 
        client.readyState === WebSocket.OPEN && 
        clientInfo.instanceId === instanceId) {
      client.send(JSON.stringify(data));
    }
  });
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