"use strict";
const PREFIX = "spd-copilot-";
const CACHE = PREFIX + "v4";
const ASSETS = ["./", "./index.html", "./home.html", "./identify.html", "./spd-data.js", "./manifest.webmanifest",
  "./public/Rep_Database.html", "./public/ocr/tesseract.min.js", "./public/ocr/worker.min.js",
  "./public/ocr/core/tesseract-core-lstm.wasm.js", "./public/ocr/core/tesseract-core-lstm.wasm", "./public/ocr/lang/eng.traineddata.gz"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const asset = ASSETS.some(path => new URL(path, scope).pathname === url.pathname);
  if (!asset) return;
  event.respondWith(caches.match(event.request, {ignoreSearch:true}).then(hit => hit || fetch(event.request)));
});
