import { defineConfig, loadEnv } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the project root
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');
  const wsServerUrl = env.WS_SERVER_URL || 'ws://localhost:3001/ws';
  const discordClientId = env.VITE_DISCORD_CLIENT_ID;

  // Removed API key logging for security
  console.log('Using VITE_DISCORD_CLIENT_ID:', discordClientId);

  return {
    // Make environment variables available to the client
    define: {
      'import.meta.env.WS_SERVER_URL': JSON.stringify(wsServerUrl),
      'import.meta.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(discordClientId),
      // Also define process.env for compatibility
      'process.env.WS_SERVER_URL': JSON.stringify(wsServerUrl),
      'process.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(discordClientId)
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Forward API requests to the backend
        '/.proxy': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/\.proxy/, ''),
        },
        // Forward WebSocket requests to the backend during development
        '/ws': {
          target: 'ws://localhost:3001',
          ws: true,
        }
      }
    }
  };
});
