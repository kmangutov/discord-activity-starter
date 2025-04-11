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

// Allow express to parse JSON bodies
app.use(express.json());

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Initialize WebSocket server with our HTTP server
const wss = initWebSocketServer(server);

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
