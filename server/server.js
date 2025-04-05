import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';
import { getOrCreateRoom, leaveRoom, getAvailableGames } from './rooms.js';
import { CanvasGame } from './game-example.js';
import { DotGame } from './games/DotGame.js';

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
  console.log('Connection headers:', req.headers);
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Send ping every 30 seconds
  
  // Wait for the client to send instanceId and userId
  ws.on('message', (message) => {
    try {
      console.log('WebSocket message received:', message.toString());
      const data = JSON.parse(message);
      
      // Handle initial connection message with instanceId
      if (data.type === 'join_room') {
        const { instanceId, userId, gameType = 'lobby' } = data;
        
        if (!instanceId || !userId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Missing instanceId or userId' 
          }));
          return;
        }
        
        // Get or create the appropriate room
        let room;
        if (gameType === 'canvas') {
          // Create a canvas game room if it doesn't exist
          if (!getOrCreateRoom(instanceId)) {
            room = new CanvasGame(instanceId);
          } else {
            room = getOrCreateRoom(instanceId);
          }
        } else if (gameType === 'dotgame') {
          // Create a dot game room if it doesn't exist
          if (!getOrCreateRoom(instanceId)) {
            room = new DotGame(instanceId);
          } else {
            room = getOrCreateRoom(instanceId);
          }
        } else {
          // Default to lobby
          room = getOrCreateRoom(instanceId, gameType);
        }
        
        // Add the participant to the room
        room.addParticipant(ws, userId);
        
        console.log(`User ${userId} joined room ${instanceId} (${gameType})`);
      } 
      // Handle other message types in the game room
      else if (ws.instanceId) {
        const room = getOrCreateRoom(ws.instanceId);
        if (room) {
          room.onMessage(ws, data);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });
  
  // Handle WebSocket-specific errors
  ws.on('error', (error) => {
    console.error('WebSocket client error:', error);
    
    // Try to gracefully close the connection on error
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, `Error: ${error.message}`);
      }
    } catch (closeError) {
      console.error('Error while closing WebSocket:', closeError);
    }
    
    // Clean up resources
    clearInterval(pingInterval);
    
    // Handle room cleanup if needed
    if (ws.instanceId) {
      leaveRoom(ws);
    }
  });
  
  // Handle disconnection
  ws.on('close', (code, reason) => {
    console.log(`WebSocket client disconnected - Code: ${code}, Reason: ${reason || 'None provided'}`);
    
    // Clear the ping interval
    clearInterval(pingInterval);
    
    if (ws.instanceId) {
      leaveRoom(ws);
    }
  });
});

// API to get available games
app.get('/api/games', (req, res) => {
  res.json(getAvailableGames());
});

app.post("/api/token", async (req, res) => {
  
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

  // Retrieve the access_token from the response
  const { access_token } = await response.json();

  // Return the access_token to our client as { access_token: "..."}
  res.send({access_token});
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
