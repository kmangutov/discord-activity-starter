import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // Proxy WebSocket requests to the server during development
    proxy: {
      '/': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  },
  // Define environment variables for the client
  define: {
    'import.meta.env.VITE_WS_HOST': JSON.stringify(process.env.VITE_WS_HOST || 'localhost:3001')
  }
}); 