# WebSocket Implementation Guide for Discord Activities

This guide explains how to implement WebSockets in your Discord Activity to enable real-time communication between connected users.

## Project Structure

```
discord-activity/
├── .env                 # Environment variables
├── client/              # Frontend code
│   ├── main.js          # Discord SDK implementation and UI logic
│   ├── style.css        # Styling for the activity
│   └── package.json     # Frontend dependencies
├── server/              # Backend code
│   ├── server.js        # Express server and token exchange
│   └── package.json     # Backend dependencies
└── v0-networking.md     # This guide
```

## Key Concepts

### 1. Activity Instance ID

The `instanceId` from the Discord SDK is the **critical link** for WebSocket connections. It uniquely identifies the shared experience that multiple users are participating in:

```javascript
const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
// Available immediately, no need to wait for ready()
const instanceId = discordSdk.instanceId;
```

When a user joins an activity, you can use this `instanceId` as a WebSocket room identifier to ensure all users in the same activity instance connect to the same "room".