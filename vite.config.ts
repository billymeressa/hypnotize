import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * BASE_PATH lets the same build serve from a domain root ("/") or a GitHub Pages
 * project subpath ("/hypnotize/"). The deploy workflow sets it; local dev uses "/".
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',            // never swap the app out mid-session; ask first
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/?app=hypnotize',
        name: 'Hypnotize',
        short_name: 'Hypnotize',
        description: 'Guided hypnosis sessions, private and on-device.',
        theme_color: '#0c0c10',
        background_color: '#0c0c10',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the launcher icon for the three things worth reaching in one tap.
        shortcuts: [
          { name: 'Morning session', short_name: 'Morning', url: '#/today' },
          { name: 'Change Coach', short_name: 'Coach', url: '#/coach' },
          { name: 'I want to scroll', short_name: 'Scroll', url: '#/today?swap=1' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5175, host: true },
});
