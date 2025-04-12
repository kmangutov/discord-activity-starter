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
import { WebSocket } from 'ws';
import { initWebSocketServer } from './websocket/index.js';

// Config
dotenv.config({ path: "../.env" });

const app = express();
const port = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Needed to get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve client dist path - go up from server/dist or server directory to the root
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');

// Allow express to parse JSON bodies
app.use(express.json());

// Serve static files from Vite build
app.use(express.static(clientDistPath));

// Initialize WebSocket server with our HTTP server
const wss = initWebSocketServer(server);

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Define types for the token request
interface TokenRequest {
  code: string;
}

interface TokenResponse {
  access_token: string;
}

interface TokenError {
  error: string;
}

// API endpoint to exchange Discord auth code for token
(app as any).post("/api/token", async (req, res) => {
  try {
    const { code } = req.body as TokenRequest;

    // Exchange the code for an access_token
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: "authorization_code",
        code,
      }),
    });

    const data = await response.json() as any;
    
    if (!response.ok) {
      console.error("Discord token exchange error:", data);
      return res.status(response.status).json({ 
        error: data.error_description || "Failed to exchange token" 
      } as TokenError);
    }

    // Return the access_token to our client
    res.json({ 
      access_token: data.access_token 
    } as TokenResponse);
  } catch (error) {
    console.error("Error in token exchange:", error);
    res.status(500).json({ 
      error: "Internal server error" 
    } as TokenError);
  }
});

// Fallback to index.html for SPA routing
(app as any).get('*', (req, res) => {
  // Don't redirect API requests
  if (req.path.startsWith('/api')) return;
  
  // Don't redirect WebSocket endpoint
  if (req.path === '/ws') return;
  
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Use the HTTP server instead of the Express app
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`WebSocket server available at ws://localhost:${port}/ws`);
}); 