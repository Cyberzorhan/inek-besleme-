// Çevrimdışı çalışma: uygulama dosyaları ilk açılışta önbelleğe alınır.
// Dosyalar değiştiğinde SURUM artırılmalıdır.
const SURUM = 'sutrasyon-v1';
const DOSYALAR = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/feeds.js',
  'js/nutrition.js',
  'js/optimizer.js',
  'js/simplex.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(anahtarlar => Promise.all(anahtarlar.filter(k => k !== SURUM).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Önce ağ, ağ yoksa önbellek: internet varken güncel sürüm, yokken son kaydedilen sürüm açılır.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(yanit => {
        const kopya = yanit.clone();
        caches.open(SURUM).then(c => c.put(e.request, kopya));
        return yanit;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
