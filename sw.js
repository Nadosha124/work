/* Service Worker — كاش كامل عشان يشتغل أوفلاين + استقبال ملف الشات من "مشاركة" */
const VERSION = 'v14';
const CACHE = 'invoices-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './style.css', './template-data.js', './version.js', './places-extra.js',
  './app.js', './egypt.js', './chat.js', './xlsx-core.js', './render.js',
  './jszip.min.js',
  './noto-sans-arabic-arabic-400-normal.woff2', './noto-sans-arabic-arabic-700-normal.woff2',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  // أي نسخة جديدة تشتغل فورًا من غير ما نستنى قفل التطبيق
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => fetch(new Request(u, { cache: 'reload' })).then((r) => { if (r && r.ok) return c.put(u, r); }).catch(() => null)))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // نمسح كل الكاشات القديمة (ما عدا ملف الشات المشارَك)
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k !== CACHE && k !== 'shared-files').map((k) => caches.delete(k)));
    await self.clients.claim();
    const cl = await self.clients.matchAll({ type: 'window' });
    cl.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED', version: VERSION }));
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('chat');
        if (file) {
          const cache = await caches.open('shared-files');
          await cache.put('shared-chat', new Response(file, { headers: { 'x-filename': encodeURIComponent(file.name || 'chat.zip') } }));
        }
      } catch (err) { /* ignore */ }
      return Response.redirect('./index.html?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // الشبكة أولاً (دايمًا آخر نسخة) ولو مفيش نت نرجع للكاش — فيشتغل أوفلاين برضه
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      return hit || (req.mode === 'navigate' ? (await cache.match('./index.html')) || Response.error() : Response.error());
    }
  })());
});
