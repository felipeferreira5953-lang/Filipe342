
// Service Worker - aumenta capacidade 3x no Vercel grátis
// Cacheia produtos.json por 1 hora no navegador, não bate no Vercel de novo
const CACHE = 'achadinhos-v3';
const ASSETS = ['/', '/produtos.json'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('fetch', e=>{
  // Cache first para produtos.json
  if(e.request.url.includes('produtos.json')){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        if(cached) return cached;
        return fetch(e.request).then(res=>{
          const clone = res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }
  // Network first para HTML
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
