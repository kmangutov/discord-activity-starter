# Discord URL Patching for WebSockets and REST Endpoints

Discord Activities run inside a sandboxed iframe environment where all network requests (WebSockets, fetch, XHR) must go through Discord's proxy system. This document explains how our application handles URL patching to work seamlessly in both local development and Discord's sandboxed environment.

> **Note**: Discord provides an official way to handle URL mapping with the `patchUrlMappings` function, but we found issues with it in certain scenarios. You can read more about the official approach in [Discord's documentation](https://github.com/discord/embedded-app-sdk/blob/main/patch-url-mappings.md).

## How Discord's Proxy System Works

When running inside Discord, all network requests must follow a specific URL pattern:

```
https://<CLIENT_ID>.discordsays.com/.proxy/<PATH>
```

Where:
- `<CLIENT_ID>` is your Discord application's client ID
- `/.proxy/` is Discord's proxy path prefix
- `<PATH>` is your original endpoint path

This proxy system provides security by:
1. Hiding users' IP addresses from your application
2. Blocking known malicious endpoints
3. Providing content sandboxing

## Client-Side Implementation

We use Discord's `patchUrlMappings` function from the Embedded App SDK to automatically transform all network requests:

```typescript
// client/js/discord.ts
import { patchUrlMappings } from '@discord/embedded-app-sdk';

export function initDiscordProxy(): void {
  // Only patch in Discord environment
  if (isDiscordActivity()) {
    // Get server host from env or fallback to default
    const serverHost = import.meta.env.VITE_API_HOST || window.location.host;
    
    // Patch all URLs to use Discord's proxy
    patchUrlMappings([
      // WebSocket endpoint
      { prefix: '/ws', target: serverHost },
      // API endpoints
      { prefix: '/api', target: serverHost }
    ]);
  }
}
```

This function is called early in the application initialization process:

```typescript
// client/main.ts
async function initApp(): Promise<void> {
  // Initialize UI
  ui.initialize();
  
  // Get URL parameters
  params = discord.getUrlParams();
  
  // Initialize Discord proxy for WebSocket and API connections
  // Must happen before any network requests
  discord.initDiscordProxy();
  
  // ... rest of initialization
}
```

When `patchUrlMappings` is called, it automatically patches these global browser functions:
- `fetch` for HTTP requests 
- `WebSocket` constructor for WebSocket connections
- `XMLHttpRequest.prototype.open` for XHR requests

### WebSockets Path Transformation

| Original WebSocket URL | Patched URL in Discord |
|------------------------|------------------------|
| `wss://example.com/ws` | `wss://123456789.discordsays.com/.proxy/ws` |

### REST API Path Transformation

| Original API URL | Patched URL in Discord |
|------------------|------------------------|
| `https://example.com/api/token` | `https://123456789.discordsays.com/.proxy/api/token` |

### How Client Code Connects

Our client code uses simple, unmodified URLs that work in both environments:

```typescript
// client/js/websocket.ts
const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  return `${protocol}//${host}/ws`;
};
```

The above code generates a standard WebSocket URL like `wss://example.com/ws`. When running in Discord, the `patchUrlMappings` function intercepts this and transforms it to `wss://123456789.discordsays.com/.proxy/ws`.

For API calls:

```typescript
// Example of a client-side API call
const response = await fetch('/api/token', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

In Discord, this gets transformed to: `https://123456789.discordsays.com/.proxy/api/token`

## Server-Side Handling

On the server side, we need to handle both the original paths and the proxy paths. Our Express server is configured to correctly handle paths with or without the proxy prefix:

```typescript
// server/server.ts
// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  // Don't redirect API requests
  if (req.path.startsWith('/api')) return;
  
  // Don't redirect WebSocket endpoint
  if (req.path === '/ws') return;
  
  // Don't redirect proxy path for WebSockets
  if (req.path.startsWith('/.proxy/ws')) return;
  
  res.sendFile(path.join(clientDistPath, 'index.html'));
});
```

The WebSocket server is initialized to listen on the `/ws` path:

```typescript
// server/websocket/index.ts
export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws' // Specify path to match client and Discord URL mappings
  });
  
  // Log WebSocket server events
  wss.on('listening', () => {
    serverLog('info', 'WebSocket server is listening for connections on path /ws');
  });

  // ...
}
```

## Configuration in Discord Developer Portal

For this to work, you must add URL mappings in the Discord Developer Portal:

1. Go to your application in the [Discord Developer Portal](https://discord.com/developers/applications)
2. Navigate to "Rich Presence" → "Linked Content" → "URL Mappings"
3. Add the following mappings:

| FROM | TO |
|------|-------|
| `/ws` | `your-server-domain.com` |
| `/api` | `your-server-domain.com` |

## Request Flow Examples

### Local Development Environment

1. **WebSocket Connection**:
   - Client attempts to connect to: `ws://localhost:3001/ws`
   - Server receives connection at: `/ws`

2. **API Request**:
   - Client sends request to: `http://localhost:3001/api/token`
   - Server receives request at: `/api/token`

### Discord Production Environment

1. **WebSocket Connection**:
   - Client attempts to connect to: `wss://example.com/ws`
   - Discord SDK transforms to: `wss://123456789.discordsays.com/.proxy/ws`
   - Server receives connection at: `/.proxy/ws`

2. **API Request**:
   - Client sends request to: `https://example.com/api/token`
   - Discord SDK transforms to: `https://123456789.discordsays.com/.proxy/api/token`
   - Server receives request at: `/.proxy/api/token`

## Debugging URL Patching Issues

If you encounter issues with URL patching:

1. Check browser console for network errors
2. Ensure URL mappings are correctly set in Discord Developer Portal
3. Verify the `patchUrlMappings` function is called early in initialization
4. Test with the debug command that runs connection tests: type `/debug` in chat
5. Check server logs for incoming requests at both original and proxy paths

## Important Notes

1. The `patchUrlMappings` function modifies global browser APIs:
   - `fetch`
   - `WebSocket` constructor
   - `XMLHttpRequest.prototype.open`

2. All patch operations happen transparently - your application code can use standard URLs without worrying about the proxy.

3. Discord's proxy system is required for security and privacy - there's no way to bypass it for activities running in Discord. 