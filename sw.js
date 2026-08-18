const VERSION='0.4.3.2';
const CACHE=`kinosis-shell-${VERSION}`;
const CORE=[
  './','./index.html',
  `./assets/css/app.css?v=${VERSION}`,
  `./assets/js/app.js?v=${VERSION}`,
  `./assets/js/config.js?v=${VERSION}`,
  `./assets/js/art-classifier.js?v=${VERSION}`,
  `./assets/js/cloud.js?v=${VERSION}`,
  `./assets/js/ui.js?v=${VERSION}`,
  `./assets/js/recommender.js?v=${VERSION}`,
  `./assets/js/importers.js?v=${VERSION}`,
  `./data/catalog.js?v=${VERSION}`,
  `./data/curations.js?v=${VERSION}`,
  `./assets/js/curations.js?v=${VERSION}`,
  './icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./assets/branding/tmdb-logo.svg'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kinosis-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);
  if(url.origin===self.location.origin&&url.pathname.startsWith('/api/'))return;
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request)));
});
