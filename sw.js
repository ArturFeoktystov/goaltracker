// Сначала сеть, чтобы новая версия появлялась при следующем запуске (GitHub Pages разрешает
// телефонам кешировать страницы на 10 минут). Последняя удачная копия хранится для запуска офлайн.

const CACHE = "goaltracker";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-cache" }); // перепроверить, минуя 10-минутный кеш
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
      if (cached) return cached;
      throw error;
    }
  })());
});
