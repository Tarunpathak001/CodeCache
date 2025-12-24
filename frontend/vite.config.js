import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/codeCachePro/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild'
  },
  server: {
    host: '0.0.0.0', // Allow access from other devices
    port: 5173,
    // Proxy API requests to the backend during development
    proxy: {
      '/stats': {
        target: process.env.VITE_API_URL || 'http://localhost:5050',
        changeOrigin: true
      },
      '/packet-stats': {
        target: process.env.VITE_API_URL || 'http://localhost:5050',
        changeOrigin: true
      },
      '/packages': {
        target: process.env.VITE_API_URL || 'http://localhost:5050',
        changeOrigin: true
      },
      '/clear-cache': {
        target: process.env.VITE_API_URL || 'http://localhost:5050',
        changeOrigin: true
      }
    }
  }
})