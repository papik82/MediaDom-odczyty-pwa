// Service worker — cache powłoki aplikacji, żeby PWA dało się otworzyć offline.
// Wersję trzeba podbić przy każdej zmianie plików z listy PLIKI_POWLOKI,
// inaczej przeglądarka będzie serwować starą wersję z cache.
const WERSJA_CACHE = 'odczyty-v11';

const PLIKI_POWLOKI = [
  './',
  './index.html',
  './manifest.json',
  './css/styl.css',
  './js/app.js',
  './js/ustawienia.js',
  './js/wersja.js',
  './js/media.js',
  './js/webhook.js',
  './js/aparat.js',
  './ikony/ikona.svg'
];

// Instalacja — pobieramy i zapisujemy w cache wszystkie pliki powłoki od razu.
self.addEventListener('install', (zdarzenie) => {
  zdarzenie.waitUntil(
    caches.open(WERSJA_CACHE).then((cache) => cache.addAll(PLIKI_POWLOKI))
  );
  self.skipWaiting();
});

// Aktywacja — usuwamy stare wersje cache z poprzednich wdrożeń.
self.addEventListener('activate', (zdarzenie) => {
  zdarzenie.waitUntil(
    caches.keys().then((klucze) =>
      Promise.all(
        klucze
          .filter((klucz) => klucz !== WERSJA_CACHE)
          .map((klucz) => caches.delete(klucz))
      )
    )
  );
  self.clients.claim();
});

// Żądania: najpierw cache (offline ma działać natychmiast), w tle spróbuj sieci
// i zaktualizuj cache, gdyby coś się zmieniło.
self.addEventListener('fetch', (zdarzenie) => {
  if (zdarzenie.request.method !== 'GET') return;

  zdarzenie.respondWith(
    caches.match(zdarzenie.request).then((odpowiedzCache) => {
      const zSieci = fetch(zdarzenie.request)
        .then((odpowiedzSieci) => {
          caches.open(WERSJA_CACHE).then((cache) => {
            cache.put(zdarzenie.request, odpowiedzSieci.clone());
          });
          return odpowiedzSieci;
        })
        .catch(() => odpowiedzCache);

      return odpowiedzCache || zSieci;
    })
  );
});
