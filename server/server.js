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
import { WebSocketServer } from 'ws';
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
        const { instanceId, userId, gameType = 'lobby', activityId } = data;
        
        if (!instanceId || !userId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Missing instanceId or userId' 
          }));
          return;
        }
        
        try {
          // Get the room for this instance
          let room = getOrCreateRoom(instanceId);
          
          // If we have a specific game type and the room is a basic room,
          // try to create a game-specific room
          if (gameType !== 'lobby' && room.constructor.name === 'Room') {
            // Create a game instance using the registry
            const gameInstance = getGameInstance(gameType, instanceId, activityId);
            
            if (gameInstance) {
              // Replace the basic room with a game-specific one
              room = getOrCreateRoom(instanceId, null, gameInstance);
              console.log(`Created ${gameType} instance for room ${instanceId}`);
            } else {
              console.warn(`Failed to create game instance for ${gameType}, using default room`);
            }
          }
          
          // Add the participant to the room
          room.addParticipant(ws, userId);
          
          console.log(`User ${userId} joined room ${instanceId} (${gameType})`);
        } catch (error) {
          console.error('Error joining room:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Failed to join room: ' + error.message 
          }));
        }
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
