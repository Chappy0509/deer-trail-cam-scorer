// =====================================================================
// Service worker for Deer Trail Cam Scorer.
// It lets the app open with no signal by keeping a copy of the app's
// files on the phone, and it keeps those copies up to date.
// =====================================================================

// Name of the saved-copies box. CHANGE THIS NUMBER (v4 -> v5 -> ...) every time
// you upload a new index.html, so phones throw away the old copy and fetch the new one.
const CACHE = "deer-cam-v7";

// The files that make up the app itself; saved as soon as the worker installs
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./apple-touch-icon.png"
];

// INSTALL: runs once when a new version of this file is first seen
self.addEventListener("install", function(event) {
    event.waitUntil(
        // open (or create) the box for this version and save the app files in it
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(APP_SHELL);
        })
    );
    // don't wait for old tabs to close before starting to use this version
    self.skipWaiting();
});

// ACTIVATE: runs when this version takes over
self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            // delete every saved-copies box except the current one (cleans out old versions)
            return Promise.all(
                keys
                    .filter(function(key) { return key !== CACHE; })
                    .map(function(key) { return caches.delete(key); })
            );
        }).then(function() {
            // start controlling already-open pages right away
            return self.clients.claim();
        })
    );
});

// FETCH: runs for every request the app makes (page, scripts, images, ...)
self.addEventListener("fetch", function(event) {

    const request = event.request;

    // only reads can be saved; leave uploads and other methods alone
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Never touch Google sign-in / Google Drive traffic or the satellite map tiles:
    // they must always go straight to the internet
    if (
        url.hostname.endsWith("google.com") ||
        url.hostname.endsWith("googleapis.com") ||
        url.hostname.endsWith("gstatic.com") ||
        url.hostname.endsWith("arcgisonline.com")
    ) {
        return;
    }

    // The page itself: try the internet first so new versions show up immediately;
    // if there's no signal, use the saved copy
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(function(response) {
                    // keep a fresh copy of the page for next time
                    const copy = response.clone();
                    caches.open(CACHE).then(function(cache) {
                        cache.put("./index.html", copy);
                    });
                    return response;
                })
                .catch(function() {
                    // offline: fall back to the saved page
                    return caches.match("./index.html");
                })
        );
        return;
    }

    // Everything else from this site, plus React and Leaflet from unpkg:
    // answer instantly from the saved copy, and refresh the copy in the background
    if (url.origin === self.location.origin || url.hostname === "unpkg.com") {
        event.respondWith(
            caches.match(request).then(function(cached) {

                // go to the internet too, so the saved copy stays current
                const fetching = fetch(request)
                    .then(function(response) {
                        // only save good replies
                        if (response && response.status === 200) {
                            const copy = response.clone();
                            caches.open(CACHE).then(function(cache) {
                                cache.put(request, copy);
                            });
                        }
                        return response;
                    })
                    .catch(function() {
                        // no signal: use whatever we had saved
                        return cached;
                    });

                // saved copy if we have one, otherwise wait for the internet
                return cached || fetching;
            })
        );
    }
});
