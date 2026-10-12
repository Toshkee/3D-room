import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset paths relative so the built `dist/` works when
// served from a sub-path (GitHub Pages project sites, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // `npm run dev` only: the lounge server (server/index.mjs) runs the repo
    // agents; the app talks to it through /api/* on its own origin.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    // Three.js is inherently large (~370 kB gzip) and the whole scene is needed
    // on first paint, so route-level code-splitting wouldn't help — and the app
    // is served from this Mac, so bundle size costs nothing over the network.
    // Raise the warning threshold rather than chase a split that doesn't help.
    chunkSizeWarningLimit: 2500,
  },
})
