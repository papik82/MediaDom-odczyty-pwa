// Moduł aparatu: dostarcza zdjęcie licznika (świeże albo z galerii) i
// zmniejsza je przed dalszym użyciem. Funkcje przyjmują `medium` jako
// parametr (zgodnie z CLAUDE.md), choć na razie go nie używają — przyda
// się, gdy w punkcie 6 dojdzie wywołanie modelu wizyjnego z podpowiedzią
// dobraną do konkretnego licznika.

import { odczytajCzasZdjecia } from './exif.js';

// Zdjęcie z telefonu bywa wielkości kilku megabajtów — za duże, żeby wysłać
// je jako base64 w treści żądania do Apps Script. Zmniejszamy dłuższy bok do
// maksymalnie 1000 px i kompresujemy do JPEG jakości 0.8.
async function zmniejszZdjecie(plik, maksymalnyBok = 1000, jakosc = 0.8) {
  const bitmapa = await createImageBitmap(plik);
  const skala = Math.min(1, maksymalnyBok / Math.max(bitmapa.width, bitmapa.height));
  const szerokosc = Math.round(bitmapa.width * skala);
  const wysokosc = Math.round(bitmapa.height * skala);

  const platno = document.createElement('canvas');
  platno.width = szerokosc;
  platno.height = wysokosc;
  platno.getContext('2d').drawImage(bitmapa, 0, 0, szerokosc, wysokosc);

  return new Promise((rozwiaz) => {
    platno.toBlob((blob) => rozwiaz(blob), 'image/jpeg', jakosc);
  });
}

// Ustala, kiedy zrobiono zdjęcie wybrane z galerii — moment odczytu licznika
// (BACKLOG pkt 3: rzeczywisty czas, nie moment wpisywania). Kolejność źródeł:
// 1) EXIF (DateTimeOriginal) — dokładne; 2) data modyfikacji pliku — przybliżona
// (zdjęcia po przesłaniu komunikatorem czy zrzuty ekranu nie mają EXIF-a);
// 3) nic — wtedy ekran potwierdzenia zostaje przy czasie telefonu, ale mówi
// o tym wprost. Ważne: EXIF czytamy z ORYGINALNEGO pliku, zanim zmniejszymy
// zdjęcie — przerysowanie przez canvas (zmniejszZdjecie) gubi metadane.
async function ustalCzasZdjecia(plik) {
  const zExif = await odczytajCzasZdjecia(plik);
  if (zExif) return { data: zExif, zrodlo: 'exif' };

  const zmodyfikowano = plik.lastModified; // ms; 0 albo bzdura, gdy przeglądarka nie zna
  if (zmodyfikowano > Date.UTC(2000, 0, 1) && zmodyfikowano <= Date.now() + 24 * 3600 * 1000) {
    return { data: new Date(zmodyfikowano), zrodlo: 'plik' };
  }
  return { data: null, zrodlo: 'brak' };
}

// Wspólna logika dla "zrób zdjęcie" i "wybierz z galerii" — różni je tylko
// atrybut `capture` na wejściu pliku. Bez niego przeglądarka pokazuje pełny
// wybór (aparat albo galeria/pliki), z nim od razu otwiera tylną kamerę.
function otworzWyborZdjecia(medium, uzyjAparatu) {
  return new Promise((rozwiaz, odrzuc) => {
    const wejscie = document.createElement('input');
    wejscie.type = 'file';
    wejscie.accept = 'image/*';
    if (uzyjAparatu) {
      wejscie.capture = 'environment';
    }
    wejscie.style.display = 'none';

    wejscie.addEventListener(
      'change',
      async () => {
        const plik = wejscie.files[0];
        wejscie.remove();
        if (!plik) {
          odrzuc(new Error('Nie wybrano zdjęcia.'));
          return;
        }
        try {
          // Zdjęcie zrobione aparatem w aplikacji powstaje "teraz" — czas
          // telefonu jest wtedy równoważny EXIF-owi, więc go nie szukamy.
          const czasZdjecia = uzyjAparatu ? null : await ustalCzasZdjecia(plik);
          const blob = await zmniejszZdjecie(plik);
          rozwiaz({ medium, blob, url: URL.createObjectURL(blob), czasZdjecia });
        } catch (blad) {
          odrzuc(blad);
        }
      },
      { once: true }
    );

    document.body.appendChild(wejscie);
    wejscie.click();
  });
}

// Otwiera aparat telefonu (tylna kamera), zwraca zmniejszone zdjęcie jako
// Blob i jako URL do podglądu w <img>. Odrzuca obietnicę, gdy użytkownik
// zamknie aparat bez zrobienia zdjęcia.
export function zrobZdjecie(medium) {
  return otworzWyborZdjecia(medium, true);
}

// Otwiera galerię/pliki telefonu zamiast aparatu — do przepisania odczytu
// ze zdjęcia zrobionego wcześniej (np. gdy ktoś inny sfotografował licznik).
export function wybierzZGalerii(medium) {
  return otworzWyborZdjecia(medium, false);
}

// Zamienia zdjęcie na base64 do wysłania w treści JSON do Apps Script
// (akcja "odczytaj_foto"). FileReader.readAsDataURL daje ciąg w postaci
// "data:image/jpeg;base64,XXXX" — odcinamy nagłówek przed przecinkiem,
// bo backend oczekuje samego base64.
export function blobDoBase64(blob) {
  return new Promise((rozwiaz, odrzuc) => {
    const czytnik = new FileReader();
    czytnik.onload = () => rozwiaz(czytnik.result.split(',')[1]);
    czytnik.onerror = () => odrzuc(czytnik.error);
    czytnik.readAsDataURL(blob);
  });
}
