// Service worker — cache powłoki aplikacji, żeby PWA dało się otworzyć offline.
// Wersję trzeba podbić przy każdej zmianie plików z listy PLIKI_POWLOKI,
// inaczej przeglądarka będzie serwować starą wersję z cache.
const WERSJA_CACHE = 'odczyty-v26';

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
  './js/kolejka.js',
  './js/bufor.js',
  './js/exif.js',
  './ikony/ikona.svg',
  './ikony/gaz.svg',
  './ikony/woda.svg',
  './ikony/prad.svg',
  './ikony/home.svg',
  './ikony/ustawienia.svg',
  './ikony/aparat.svg',
  './ikony/galeria.svg',
  './ikony/recznie.svg',
  './ikony/kociol.svg',
  './ikony/podglad.svg'
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

// Żądania: czysty cache-first, bez dopisywania świeżych odpowiedzi do
// cache w locie. Poprzednia wersja aktualizowała każdy plik osobno w tle,
// więc telefon mógł dostać mieszankę: nowy index.html z odwołaniami do
// nowych ikon, ale stary css/styl.css sprzed reguły ich rozmiaru — stąd
// "olbrzymie ikony" mimo widocznych nowych kształtów. Cache ma się
// zmieniać wyłącznie całością, przy instalacji nowej wersji (WERSJA_CACHE
// wyżej) — nigdy pojedynczymi plikami przy okazji zwykłego żądania.
self.addEventListener('fetch', (zdarzenie) => {
  if (zdarzenie.request.method !== 'GET') return;

  zdarzenie.respondWith(
    caches.match(zdarzenie.request).then(
      (odpowiedzCache) => odpowiedzCache || fetch(zdarzenie.request)
    )
  );
});
