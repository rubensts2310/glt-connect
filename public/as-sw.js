// Service worker del autoshow: la app abre sin señal y las fotos del catálogo quedan guardadas.
const SHELL = "as-shell-v1";
const MEDIA = "as-media-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/autoshow", "/as-icon-192.png"]).catch(() => {}))); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // páginas de la app: red primero, si no hay señal la versión guardada
  if (req.mode === "navigate" && url.origin === location.origin && url.pathname.startsWith("/autoshow")) {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(SHELL).then((s) => s.put("/autoshow", c)); return r; }).catch(() => caches.match("/autoshow")));
    return;
  }
  // archivos del build (con hash): caché primero
  if (url.origin === location.origin && url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(SHELL).then((s) => s.put(req, c)); return r; })));
    return;
  }
  // fotos públicas del catálogo (no videos): caché primero
  if (url.pathname.includes("/storage/v1/object/public/assets/") && !/\.mp4$/i.test(url.pathname)) {
    e.respondWith(caches.open(MEDIA).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  // tipografías
  if (url.host.includes("fonts.g")) {
    e.respondWith(caches.open(SHELL).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { c.put(req, r.clone()); return r; }))));
  }
});
