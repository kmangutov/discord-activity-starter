import { defineConfig, loadEnv } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the project root
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');
  const ablyApiKey = env.ABLY_API_KEY || 'wJCxmg.MM9QRw:YCEe19Xuz85-vFqXmcHwSHavTTDYAX542v7tiSCSR9o';
  const discordClientId = env.VITE_DISCORD_CLIENT_ID || env.DISCORD_CLIENT_ID;

  // Removed API key logging for security
  console.log('Using DISCORD_CLIENT_ID:', discordClientId);

  return {
    // Make environment variables available to the client
    define: {
      'import.meta.env.ABLY_API_KEY': JSON.stringify(ablyApiKey),
      'import.meta.env.DISCORD_CLIENT_ID': JSON.stringify(discordClientId),
      // Also define process.env for compatibility
      'process.env.ABLY_API_KEY': JSON.stringify(ablyApiKey),
      'process.env.DISCORD_CLIENT_ID': JSON.stringify(discordClientId)
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
        }
      }
    }
  };
});
