const VERSION='0.4.0';
const CACHE=`kinosis-shell-${VERSION}`;
const CORE=[
  './',
  './index.html',
  `./assets/css/app.css?v=${VERSION}`,
  `./assets/js/app.js?v=${VERSION}`,
  `./data/catalog.js?v=${VERSION}`,
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/branding/tmdb-logo.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('kinosis-')&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);

  // Live API responses must never be replaced by an old PWA cache entry.
  if(url.origin===self.location.origin && url.pathname.startsWith('/api/')) return;
  // Let the browser/CDN handle TMDB images.
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request,{cache:'no-store'})
        .then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;})
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request,{cache:'no-store'})
      .then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})
      .catch(()=>caches.match(request))
  );
});
