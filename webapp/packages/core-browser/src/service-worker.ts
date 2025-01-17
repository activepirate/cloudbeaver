/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;
const manifest = self.__WB_MANIFEST;

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(manifest);

addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
