// Custom service worker (injectManifest strategy). Bundled by Vite, so no absolute
// node_modules paths get inlined — safe with the apostrophe in the project folder name.

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// injectManifest replaces self.__WB_MANIFEST with the precache list at build time.
declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
  skipWaiting: () => Promise<void>;
  addEventListener: (type: string, listener: (event: { data?: { type?: string } }) => void) => void;
};

precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback → serve the app shell offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Google Fonts stylesheets
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);

// Google Fonts webfont files
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// OpenStreetMap tiles for the Events map — cache what has been seen
registerRoute(
  /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Do NOT skipWaiting unconditionally — that silently swaps the app under an open
// session and is why members saw stale/half-updated builds. Instead the new SW
// waits; the page shows an "Update now" prompt (components/UpdatePrompt) and,
// when accepted, posts SKIP_WAITING. clientsClaim() then lets the freshly
// activated SW control the page so the single reload serves the new assets.
clientsClaim();
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
