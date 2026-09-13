// Moduł aparatu: dostarcza zdjęcie licznika (świeże albo z galerii) i
// zmniejsza je przed dalszym użyciem. Funkcje przyjmują `medium` jako
// parametr (zgodnie z CLAUDE.md), choć na razie go nie używają — przyda
// się, gdy w punkcie 6 dojdzie wywołanie modelu wizyjnego z podpowiedzią
// dobraną do konkretnego licznika.

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
          const blob = await zmniejszZdjecie(plik);
          rozwiaz({ medium, blob, url: URL.createObjectURL(blob) });
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
