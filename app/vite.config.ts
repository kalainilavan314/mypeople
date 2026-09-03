import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (not generateSW): our SW is bundled by Vite, so workbox module
      // paths are never inlined as strings. This avoids the apostrophe in the project
      // folder name ("People's Movement") breaking the generated service worker.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'logo.png', 'offline.html'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'என் மக்கள் · My People',
        short_name: 'My People',
        description: 'இலக்கு ஒன்று தான் இனத்தின் விடிவு · The target is one, the liberation of the race.',
        lang: 'ta',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7FAFD',
        theme_color: '#043074',
        categories: ['social', 'government', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // Allow any host so tunnels (e.g. *.trycloudflare.com) can reach the dev server.
    allowedHosts: true,
    // Proxy API calls to the membership backend so the same origin (incl. the
    // public tunnel) serves both the app and the API.
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
