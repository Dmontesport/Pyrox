// Funciona sin conexión: primero red (para recibir actualizaciones), si no hay, caché.
// Solo se guardan respuestas correctas: si la web deja de estar publicada (404),
// la app instalada sigue funcionando con la última copia buena.
const CACHE = 'pyrox-v3';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(m => {
    if (m) return m;
    if (req.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (!res.ok) return fromCache(req);
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => fromCache(req))
  );
});
