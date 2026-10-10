// ALTA PD: network-first navigation; no offline cache of private academy data.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
