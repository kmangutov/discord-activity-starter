/**
 * Discord Activities API server - Simplified
 * Handles API endpoints and WebSocket connections
 */

import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// Config
dotenv.config({ path: "../.env" });

const app = express();
const port = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Needed to get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow express to parse JSON bodies
app.use(express.json());

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Create a WebSocket server
const wss = new WebSocketServer({ server });

// Track all connected clients
const clients = new Map();

// Log WebSocket server events
wss.on('listening', () => {
  console.log('WebSocket server is listening for connections');
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected from:', req.socket.remoteAddress);
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Send ping every 30 seconds
  
  ws.on('message', (message) => {
    try {
      console.log('WebSocket message received:', message.toString().substring(0, 200));
      const data = JSON.parse(message);
      
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
      else if (data.type === 'message' && ws.instanceId && data.message) {
        // Broadcast the message to all clients in the same instance
        broadcastToInstance(ws.instanceId, {
          type: 'message',
          userId: ws.userId,
          message: data.message
        });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or processing error' }));
    }
  });
  
  // Handle WebSocket-specific errors
  ws.on('error', (error) => {
    console.error('WebSocket client error:', error);
    clearInterval(pingInterval);
    clients.delete(ws);
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`WebSocket client disconnected - User: ${ws.userId || 'Unknown'}`);
    
    // Clear the ping interval
    clearInterval(pingInterval);
    
    // Remove from clients map
    const clientInfo = clients.get(ws);
    clients.delete(ws);
    
    // Notify others about the disconnect
    if (clientInfo) {
      broadcastToInstance(clientInfo.instanceId, {
        type: 'user_left',
        userId: clientInfo.userId
      });
    }
  });
});

// Helper function to broadcast to all clients in an instance
function broadcastToInstance(instanceId, data, excludeSocket = null) {
  clients.forEach((clientInfo, client) => {
    if (client !== excludeSocket && 
        client.readyState === WebSocket.OPEN && 
        clientInfo.instanceId === instanceId) {
      client.send(JSON.stringify(data));
    }
  });
}

// API endpoint to exchange Discord auth code for token
app.post("/api/token", async (req, res) => {
  try {
    // Exchange the code for an access_token
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.body.code,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Discord token exchange error:", data);
      return res.status(response.status).json({ error: data.error_description || "Failed to exchange token" });
    }

    // Return the access_token to our client
    res.json({ access_token: data.access_token });
  } catch (error) {
    console.error("Error in token exchange:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  // Don't redirect API requests
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Use the HTTP server instead of the Express app
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
