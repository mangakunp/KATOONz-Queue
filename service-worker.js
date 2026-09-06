const CACHE="katoonz-tomo-v5-9-8-3-replacemodaltextfix";
const ASSETS=[
  "./",
  "./index.html",
  "./style.css?v=5.9.8.3",
  "./app.js?v=5.9.8.3",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response && response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone());
    }
    return response;
  }catch(err){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==="navigate")return caches.match("./index.html");
    throw err;
  }
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);
  const isCore=
    event.request.mode==="navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/style.css") ||
    url.pathname.endsWith("/service-worker.js");

  if(isCore){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(response=>{
        const clone=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,clone));
        return response;
      });
    })
  );
});
