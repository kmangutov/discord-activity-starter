# Discord Activity Chat

A simplified Discord Activity implementation that demonstrates the core functionality needed to run an app both as a Discord Activity and locally with WebSocket communication.

## Features

- Discord Activity integration using Discord's Embedded App SDK
- Real-time messaging via WebSockets
- Works both in Discord and as a standalone web app
- Simple, clean architecture with no game-specific logic
- TypeScript throughout for better type safety and developer experience

## Architecture

This project follows the architecture outlined in the [architecture.md](./architecture.md) file, focusing on the core Discord Activity functionality:

1. Setting up Discord Activity with SDK and environment variables
2. Running in Discord Activity mode or locally
3. WebSocket connection and coordination
4. Discord URL patching

## Project Structure

```
├── client/                 # Frontend code
│   ├── js/                 # Client-side modules
│   │   ├── discord.ts      # Discord SDK integration
│   │   ├── ui.ts           # UI handling functions
│   │   ├── utils.ts        # Utility functions
│   │   └── websocket.ts    # WebSocket client implementation
│   ├── index.html          # Basic HTML structure
│   ├── main.ts             # Main client-side TypeScript with Discord SDK integration
│   ├── tsconfig.json       # TypeScript configuration for client
│   ├── vite.config.ts      # Vite build configuration
│   ├── env.d.ts            # TypeScript definitions for environment variables
│   └── package.json        # Client dependencies
│
├── server/                 # Backend code
│   ├── websocket/          # WebSocket server modules
│   │   └── index.ts        # WebSocket connection handling
│   ├── server.ts           # Express server with WebSocket handling
│   ├── tsconfig.json       # TypeScript configuration for server
│   └── package.json        # Server dependencies
│
├── .env.example            # Example environment variables
├── package.json            # Root package.json with scripts
└── architecture.md         # Architecture documentation
```

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your Discord credentials
3. Install dependencies:
   ```
   npm run install:deps
   ```

4. Create a Discord Application at https://discord.com/developers/applications
5. Configure an Activity for your application

## Development

To run the application in development mode:

```
npm run dev
```

This will start both the server and client in development mode. The client will be available at http://localhost:5173 and will connect to the WebSocket server at http://localhost:3001.

## Building for Production

To build the application for production:

```
npm run build
```

To start the production server:

```
npm start
```

## Discord Integration

To test the Discord integration, you'll need to:

1. Configure a Discord Application with an Activity
2. Set the proper environment variables in `.env`
3. Host the application on a public domain
4. Configure the Activity URL in the Discord Developer Portal

For local testing of the Discord integration, you can use ngrok to create a public URL for your local server.

## License

ISC