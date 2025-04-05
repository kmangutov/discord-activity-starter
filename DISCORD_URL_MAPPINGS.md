# Discord Activity URL Mappings for Railway

This document outlines the URL mappings required for the Discord Activity to work with our WebSocket-based architecture hosted on Railway.

## Background

When running an activity within Discord, there are security restrictions on which domains the activity can connect to. Discord provides URL mappings to redirect requests from your activity to external domains. This is necessary for WebSockets and API calls.

## Required URL Mappings

Add the following URL mappings in the Discord Developer Portal under your Activity's settings:

| From               | To                                    | Description                               |
|--------------------|---------------------------------------|-------------------------------------------|
| `/ws`              | `wss://your-railway-app.up.railway.app/ws` | WebSocket connection for real-time updates |
| `/api/games`       | `https://your-railway-app.up.railway.app/api/games` | API endpoint to get available games |
| `/api/token`       | `https://your-railway-app.up.railway.app/api/token` | API endpoint for token exchange |

## How to Set Up the URL Mappings

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to the "Activities" tab
4. In the "Activity URL Mappings" section, add each of the mappings above
5. Save your changes

## Environment Variables

Make sure to set the following environment variables in your Railway project:

- `PORT`: The port your server will run on (Railway sets this automatically)
- `VITE_DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_CLIENT_SECRET`: Your Discord application client secret
- `WS_SERVER_URL`: WebSocket server URL (format: `wss://your-railway-app.up.railway.app/ws`)

## Notes for Development

- For local development, you can use `localhost` or `ngrok` in the "To" field of your URL mappings
- WebSocket connections might be initially blocked by Discord, but with proper URL mappings, they will work
- Make sure your Railway deployment is using HTTPS, as Discord requires secure connections
- Always use ES modules syntax (`import`/`export`) rather than CommonJS (`require`/`module.exports`) for Discord compatibility
- Ensure all code is bundled correctly for the Discord client environment

## Verifying URL Mappings

After setting up URL mappings, you can verify they're working by:

1. Opening your activity in Discord
2. Opening developer tools (Ctrl+Shift+I in the Discord client)
3. Checking the Network tab for WebSocket connections to `/ws`
4. Confirming there are no CORS errors in the Console tab 