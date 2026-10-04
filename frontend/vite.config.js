import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Docker exposes the API and exercise media through the web service on :8080.
const backend = process.env.API_TARGET || 'http://127.0.0.1:8080'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
})
