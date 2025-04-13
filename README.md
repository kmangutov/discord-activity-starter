# Discord Activity Starter

A minimal starter template for Discord Activities with WebSocket support.

## Features

- Discord Activity integration
- Real-time WebSocket communication
- Works both in Discord and as standalone web app

## Architecture

This project uses a client-server architecture:
- **Client**: Discord SDK integration with UI components
- **Server**: Express server providing RPC endpoints, WebSocket communication, and static file serving

For details, see [architecture.md](./architecture.md).

## Setup

1. Clone the repository
2. Configure your `.env` file (see `.env.example`)
3. Create a Discord Application with Activity at https://discord.com/developers/applications
4. Set up Activity URL mappings in the Discord Developer Portal (map root '/' to your application root)

## Development

```
npm run install:deps
npm run dev
```

## Production

```
npm run build && npm run start
```

## Discord URL Mapping

Due to issues with Discord's standard `patchUrlMapping` SDK function, this project implements a custom URL mapping approach. See [urlpatching.md](./urlpatching.md) for details.