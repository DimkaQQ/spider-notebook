import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

  // https://vitejs.dev/config/
  export default defineConfig({
    plugins: [react()],

  // macOS 11.7 ships Safari 12.x by default; build to a JS target it can run.
  build: {
    target: 'es2019'
  },
  
  // Configuration to change the host and port
  server: {
    // Change the port to 8000
    port: 8000, 
    // Set the host to 'localhost'
    host: 'localhost', 
    
    // ADDED: This is the fix!
    // This tells Vite to accept requests from your domain.
    allowedHosts: [
      'm4spider.com',
      'www.m4spider.com'
    ],

    // In local dev the Pages Functions don't run, so proxy /api to the
    // standalone Node relay. In production Cloudflare serves /api directly.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7788',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  }
});


