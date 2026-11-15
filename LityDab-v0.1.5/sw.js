const cacheName = 'litydab-v0.1.5';
const assets = ['./index.html','./app.js','./style.css','./manifest.json','./icon.svg','./logo.png','./CHANGELOG.md'];
self.addEventListener('install', e => e.waitUntil(caches.open(cacheName).then(c => c.addAll(assets))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('litydab-') && k !== cacheName).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !assets.some(path => new URL(path, self.registration.scope).href === e.request.url) && e.request.url !== self.registration.scope) return;
  e.respondWith(caches.match(e.request.url === self.registration.scope ? './index.html' : e.request).then(hit => hit || fetch(e.request)));
});






