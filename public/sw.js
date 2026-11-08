const CACHE_PREFIX = "dr-ovi-pwa";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v1`;
const PAGE_CACHE = `${CACHE_PREFIX}-public-pages-v1`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-v1`;
const SHELL_URLS = ["/offline", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];
const PUBLIC_PAGES = new Set(["/", "/public_website"]);

// On localhost (development, or a local production test) a cache-first worker serves stale chunks
// after every rebuild and breaks module loading. Remove the worker and its caches there.
const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  if (IS_LOCAL) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  if (IS_LOCAL) {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: "window" }))
        .then((clients) => clients.forEach((client) => client.navigate(client.url))),
    );
    return;
  }
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, PAGE_CACHE, STATIC_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (IS_LOCAL || request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png"
  ) {
    event.respondWith(cacheStaticAsset(request));
  }
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (
      response.ok &&
      url.search === "" &&
      PUBLIC_PAGES.has(url.pathname) &&
      !response.headers.get("Cache-Control")?.includes("no-store")
    ) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedPage = url.search === "" && PUBLIC_PAGES.has(url.pathname)
      ? await caches.match(request)
      : null;
    return cachedPage || await caches.match("/offline", { cacheName: SHELL_CACHE });
  }
}

async function cacheStaticAsset(request) {
  const cachedAsset = await caches.match(request);
  if (cachedAsset) return cachedAsset;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
