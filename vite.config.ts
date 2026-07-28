import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset paths relative so the built `dist/` works when
// served from a sub-path (GitHub Pages project sites, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // The Claude proxy (server/index.mjs) holds the API key; the frontend only
    // ever talks to /api/* on its own origin.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    // Three.js is inherently large (~370 kB gzip) and the whole scene is needed
    // on first paint, so route-level code-splitting wouldn't help. Raise the
    // warning threshold rather than chase a split that doesn't reduce the load.
    chunkSizeWarningLimit: 1500,
  },
})
