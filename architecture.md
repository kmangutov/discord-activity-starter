# Discord Activities Architecture

This document outlines the core architecture for building a Discord Activity with WebSocket communication.

## 1. Setting up Discord Activity with SDK and Environment Variables

The application uses environment variables to configure Discord integration:

```javascript
// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

// Environment variables used for Discord
const DISCORD_CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
```

These environment variables are used during the OAuth2 token exchange with Discord:

```javascript
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

  // Return the access_token to our client
  res.send({access_token});
});
```

## 2. Running in Discord Activity Mode or Locally

The application can operate in different modes based on the context:

```javascript
// Client-side code
const isDiscordActivity = window.location.search.includes('activityId');

// Connect to WebSocket
const connectToWebSocket = () => {
  const ws = new WebSocket(getWebSocketUrl());
  
  // Extract parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const instanceId = urlParams.get('instanceId') || generateLocalInstanceId();
  const activityId = urlParams.get('activityId'); // Will be null when running locally
  
  // On connection, join with appropriate parameters
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'join',
      instanceId: instanceId,
      userId: getUserId(),
      // activityId is only present in Discord mode
      ...(activityId && { activityId })
    }));
  };
  
  return ws;
};
```

The server handles both Discord activity and local sessions through the same WebSocket interface, differentiating them by the presence of an `activityId`.

## 3. WebSocket Connection and Coordination

The application uses WebSockets for real-time communication between clients:

```javascript
// Server-side code
import express from "express";
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  
  // Add a ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Send ping every 30 seconds
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Store connection info on the socket
      if (data.type === 'join') {
        ws.userId = data.userId;
        ws.instanceId = data.instanceId;
        
        // Optional: track if this is a Discord activity
        if (data.activityId) {
          ws.activityId = data.activityId;
          console.log(`User ${ws.userId} joined Discord activity ${ws.activityId}`);
        } else {
          console.log(`User ${ws.userId} joined local session ${ws.instanceId}`);
        }
        
        // Broadcast to other clients in this instance
        broadcastToInstance(ws.instanceId, {
          type: 'user_joined',
          userId: ws.userId
        }, ws);
      }
      
      // Handle other message types
      else if (ws.instanceId) {
        // Relay message to other clients in the same instance
        broadcastToInstance(ws.instanceId, data, ws);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    clearInterval(pingInterval);
    
    if (ws.instanceId) {
      // Notify others that user disconnected
      broadcastToInstance(ws.instanceId, {
        type: 'user_left',
        userId: ws.userId
      });
    }
  });
});

// Helper function to broadcast to all clients in an instance except sender
function broadcastToInstance(instanceId, data, excludeSocket) {
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN && 
      client.instanceId === instanceId &&
      client !== excludeSocket
    ) {
      client.send(JSON.stringify(data));
    }
  });
}

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
```

## 4. Discord URL Patching

Discord Activity URLs are managed through the SPA (Single Page Application) routing system:

```javascript
// Server-side: Serve static files and handle SPA routing
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  // Don't redirect API requests
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

When Discord loads the activity in an iframe, it appends query parameters to the URL:

```
https://your-app.com/?instanceId=123456&activityId=789012
```

Client-side code extracts these parameters to establish the WebSocket connection:

```javascript
// Client-side URL parameter extraction
function getDiscordParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    instanceId: urlParams.get('instanceId'),
    activityId: urlParams.get('activityId'),
    guildId: urlParams.get('guildId'),
    channelId: urlParams.get('channelId'),
    // Other potential Discord parameters
  };
}

// Use these parameters when connecting via WebSocket
function initializeConnection() {
  const params = getDiscordParameters();
  const isDiscordMode = !!params.activityId;
  
  console.log(`Running in ${isDiscordMode ? 'Discord' : 'local'} mode`);
  
  // Connect to WebSocket with appropriate parameters
  // ...
}
```

## 5. Development Workflow

When developing your Discord activity, follow this workflow:

1. **Local Development**:
   - Run your app locally first without Discord integration
   - Use a generated instanceId for local testing
   - Connect to your WebSocket server running locally

2. **Discord Integration Testing**:
   - Create a Discord application in the Developer Portal
   - Configure your Activity settings with redirect URLs
   - Test the activity in a Discord server with appropriate permissions

3. **Production Deployment**:
   - Deploy your application to a hosting service
   - Update your Discord application with production URLs
   - Test the deployed activity in Discord 