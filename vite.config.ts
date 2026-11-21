import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const MES = 60 * 60 * 24 * 30;

export default defineConfig({
  // Rutas relativas: funciona igual en GitHub Pages (/AppRutas/) que en un dominio propio.
  base: './',
  build: {
    target: 'es2022',
    // MapLibre pesa ~1 MB y ya va en su propio archivo, cargado después de la lista.
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'AppRutas · Rutas de Celaya',
        short_name: 'AppRutas',
        description: 'Consulta los recorridos de las rutas de camión urbano de Celaya, Guanajuato.',
        lang: 'es-MX',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F1EA',
        theme_color: '#0F4C5C',
        categories: ['navigation', 'travel'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Estilo y descripción de teselas: preferir lo más nuevo, usar copia si no hay red.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(styles\/|planet$)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'mapa-estilo', networkTimeoutSeconds: 4, expiration: { maxEntries: 10, maxAgeSeconds: MES } },
          },
          {
            // Teselas, fuentes e iconos del mapa: no cambian para una misma URL.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet\/|fonts\/|sprites\/)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-teselas',
              expiration: { maxEntries: 2000, maxAgeSeconds: MES, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
