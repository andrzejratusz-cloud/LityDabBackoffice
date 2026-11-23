const cacheName='litydab-v0.1.24';
const assets=["index.html","app.js","pwa.js","improvements.js","business.js","install.js","sharing.js","sharing-config.js","polkurier.js","files.js","style.css","manifest.json","icon.svg","logo.png","favicon.ico","app-icon-180.png","app-icon-192.png","app-icon-512.png","menu-icons.jpg","CHANGELOG.md"];
const scope=self.registration.scope;
const assetURLs=assets.map(name=>new URL(name,scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(cacheName);
 await cache.addAll(assetURLs.map(url=>new Request(url,{cache:'reload'})));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(/^litydab-v/.test(name)&&name!==cacheName)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==new URL(scope).origin)return;
 const canonical=new URL(url.pathname,url.origin).href;
 const isNavigation=request.mode==='navigate'&&(canonical===scope||canonical===new URL('index.html',scope).href);
 if(!isNavigation&&!assetURLs.includes(canonical))return;
 event.respondWith((async()=>{
  if(/\/app-icon-(180|192|512)\.png$/.test(url.pathname)){
   const branding=await caches.open('litydab-branding'),custom=await branding.match(canonical);
   if(custom)return custom;
  }
  const cache=await caches.open(cacheName);
  const cached=await cache.match(isNavigation?new URL('index.html',scope).href:canonical);
  return cached||fetch(request);
 })());
});
