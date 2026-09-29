// Bump this number whenever you upload a new index.html so phones pick it up.
const CACHE = "deer-cam-v1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./apple-touch-icon.png"
];

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys
                    .filter(function(key) { return key !== CACHE; })
                    .map(function(key) { return caches.delete(key); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function(event) {

    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Never touch Google sign-in / Drive traffic or map tiles
    if (
        url.hostname.endsWith("google.com") ||
        url.hostname.endsWith("googleapis.com") ||
        url.hostname.endsWith("gstatic.com") ||
        url.hostname.endsWith("arcgisonline.com")
    ) {
        return;
    }

    // Pages: try the network first so updates show up, fall back to cache offline
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(function(response) {
                    const copy = response.clone();
                    caches.open(CACHE).then(function(cache) {
                        cache.put("./index.html", copy);
                    });
                    return response;
                })
                .catch(function() {
                    return caches.match("./index.html");
                })
        );
        return;
    }

    // Everything else (your files, React, Leaflet): cache first, refresh in background
    if (url.origin === self.location.origin || url.hostname === "unpkg.com") {
        event.respondWith(
            caches.match(request).then(function(cached) {

                const fetching = fetch(request)
                    .then(function(response) {
                        if (response && response.status === 200) {
                            const copy = response.clone();
                            caches.open(CACHE).then(function(cache) {
                                cache.put(request, copy);
                            });
                        }
                        return response;
                    })
                    .catch(function() {
                        return cached;
                    });

                return cached || fetching;
            })
        );
    }
});
