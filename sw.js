const name='mesh-field-lab-shell-v2';
const scope=new URL(self.registration.scope);
const shell=['./','./index.html','./style.css','./app.js','./db.js','./domain.js','./guide.js','./map.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const assets=new Set(shell.map(path=>new URL(path,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(name).then(cache=>cache.addAll([...assets].map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('mesh-field-lab-shell-')&&key!==name)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(event.request.mode==='navigate'){
  if(url.pathname!==scope.pathname&&url.pathname!==scope.pathname+'index.html')return;
  event.respondWith(caches.open(name).then(c=>c.match(new URL('./',scope).href)).then(r=>r||fetch(event.request)));
 }else if(assets.has(url.href))event.respondWith(caches.open(name).then(c=>c.match(event.request)).then(r=>r||fetch(event.request)));
});