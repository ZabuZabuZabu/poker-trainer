// オフライン用キャッシュ。ファイルを更新したら VERSION を上げる
const VERSION = "yk-v2-2";
const FILES = [
    "./", "./index.html", "./css/style.css",
    "./js/data.js", "./js/engine.js", "./js/storage.js", "./js/ui.js", "./js/app.js",
    "./icon.svg", "./manifest.webmanifest"
];

self.addEventListener("install", e => {
    e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// ネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュを使う
self.addEventListener("fetch", e => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        fetch(e.request)
            .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
            .catch(() => caches.match(e.request))
    );
});
