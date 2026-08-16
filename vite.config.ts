import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** Set `PAGES_BASE=/Idle-/` for GitHub Pages project site builds. */
const base = process.env.PAGES_BASE || '/'
const previewBuild = base.includes('/pr-preview/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Hiveworks',
        short_name: 'Hiveworks',
        description:
          'Orbital foundry idle. USI-style ship combat, player-launched sorties, industrial systems.',
        theme_color: '#12100e',
        background_color: '#12100e',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        lang: 'en',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Dock',
            short_name: 'Dock',
            description: 'Open Hiveworks',
            url: './',
            icons: [{ src: 'pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Production SW scope is /Idle-/ and would otherwise serve the
        // production shell for PR preview URLs under /Idle-/pr-preview/.
        ...(previewBuild ? {} : { navigateFallbackDenylist: [/\/pr-preview\//] }),
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
