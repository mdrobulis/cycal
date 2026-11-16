import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The page CSP is injected only into production builds, so Vite's HMR
 * websocket keeps working in development. `connect-src 'none'` is the
 * product claim: the UI itself cannot send data anywhere.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

// GitHub Pages project sites live under /<repo>/. Local dev and the default
// build stay at the root; the Pages workflow sets VITE_BASE=/cycal/.
const base = (process.env.VITE_BASE ?? '/').replace(/\/?$/, '/');

function cspPlugin(): Plugin {
  return {
    name: 'cycal-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const meta = `    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n`;
      return html.replace('</head>', `${meta}  </head>`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    svelte(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'apple-touch-icon-180x180.png',
      ],
      manifest: {
        name: 'Cycal',
        short_name: 'Cycal',
        id: base,
        lang: 'lt',
        description: 'Privatus ciklo sekimas. Duomenys lieka telefone.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FAF9F7',
        theme_color: '#FAF9F7',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
});
