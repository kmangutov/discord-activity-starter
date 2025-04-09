/**
 * Discord Activities API server
 * Handles API endpoints and WebSocket connections for games
 */

import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getOrCreateRoom, leaveRoom } from './rooms.js';
import { registerGame, getRegisteredGames, getGameInstance } from '../shared/game_registry.js';

// Import game implementations
import { CanvasGame } from './games/CanvasGame.js';
import { DotGame } from './games/DotGame.js';

// Config
dotenv.config({ path: "../.env" });

// Register available games
registerGame(CanvasGame);
registerGame(DotGame);

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
  // console.log('Connection headers:', req.headers); // Reduce noise
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Send ping every 30 seconds
  
  ws.on('message', (message) => {
    try {
      console.log('WebSocket message received:', message.toString().substring(0, 200)); // Log start of message
      const data = JSON.parse(message);
      
      // Handle initial connection message with instanceId
      if (data.type === 'join_room') {
        const { instanceId, userId, gameType = 'lobby', activityId } = data;
        
        if (!instanceId || !userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing instanceId or userId' }));
          console.error(`Join room failed: Missing instanceId or userId for data:`, data);
          return;
        }
        
        try {
          let room = getOrCreateRoom(instanceId);
          
          // If room doesn't exist, or if it's a basic room and we need a game room
          if (!room || (room.constructor.name === 'Room' && gameType !== 'lobby')) {
            console.log(`Room [${instanceId}]: Needs creation or upgrade for gameType: ${gameType}`);
            let gameInstance = null;
            if (gameType !== 'lobby') {
              gameInstance = getGameInstance(gameType, instanceId, activityId);
              if (gameInstance) {
                console.log(`Room [${instanceId}]: Created specific game instance: ${gameType}`);
              } else {
                console.warn(`Room [${instanceId}]: Failed to create game instance for ${gameType}, will use default room.`);
              }
            }
            // Create/replace the room with the correct type (gameInstance or new Room)
            room = getOrCreateRoom(instanceId, gameType, gameInstance);
          } else {
            console.log(`Room [${instanceId}]: Found existing room of type ${room.constructor.name}`);
          }
          
          // Add the participant to the obtained room
          room.addParticipant(ws, userId);
          console.log(`User ${userId} added to room ${instanceId} (${room.constructor.name})`);

        } catch (error) {
          console.error(`Error joining room ${instanceId} for user ${userId}:`, error);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to join room: ' + error.message }));
        }
      } 
      // Handle other message types (like publish) only *after* the socket is associated with a room/instance
      else if (ws.instanceId) {
        const room = getOrCreateRoom(ws.instanceId);
        if (room) {
          // Delegate message handling to the specific room instance
          room.onMessage(ws, data);
        } else {
          console.warn(`Message received for unknown room ${ws.instanceId} from user ${ws.userId}`);
        }
      } else {
        // Message received before join_room?
        console.warn(`Message received from socket without instanceId: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or processing error' }));
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
  // Convert from game registry format to API format
  const games = getRegisteredGames().map(game => ({
    id: game.id,
    name: game.name,
    description: game.description,
    minPlayers: game.minPlayers || 1,
    maxPlayers: game.maxPlayers || 10,
    thumbnail: game.thumbnail || null
  }));
  
  res.json({ games });
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
  console.log(`Available games: ${getRegisteredGames().map(g => g.name).join(', ')}`);
});
