// Wspólne pomocniki ekranów: budowanie DOM, formatowanie dat, status bloku
// i wczytywanie bloku „pokaż stare, odśwież w tle”. Nic tu nie zna
// konkretnego ekranu — moduły ekranów importują stąd, nie odwrotnie.

import { zapiszBufor, odczytajBufor, opiszWiek } from './bufor.js';

// Nie pytaj webhooka częściej niż raz na minutę (Apps Script przy serii
// szybkich żądań bywa kapryśny). Używają: nastawy kotła i pasek alarmów.
export const MIN_ODSTEP_POBRANIA_MS = 60 * 1000;

// Mały pomocnik do budowania DOM: tekst przez textContent, nie innerHTML —
// cyrkulacja to dowolny tekst z arkusza, więc nie wstawiamy go jako HTML.
export function element(znacznik, klasa, tekst) {
  const el = document.createElement(znacznik);
  if (klasa) el.className = klasa;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

// Liczba po polsku (przecinek dziesiętny) — 0.5 → "0,5".
export function liczbaPL(wartosc) {
  return String(wartosc).replace('.', ',');
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(znacznik, atrybuty = {}, tekst) {
  const el = document.createElementNS(SVG_NS, znacznik);
  for (const [k, v] of Object.entries(atrybuty)) el.setAttribute(k, v);
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

// Format wymagany przez <input type="datetime-local">: "RRRR-MM-DDTGG:MM",
// czas lokalny — inaczej niż toISOString(), które liczy w UTC.
export function sformatujDataGodzinaLokalnie(data) {
  const dwieCyfry = (liczba) => String(liczba).padStart(2, '0');
  const rok = data.getFullYear();
  const miesiac = dwieCyfry(data.getMonth() + 1);
  const dzien = dwieCyfry(data.getDate());
  const godzina = dwieCyfry(data.getHours());
  const minuta = dwieCyfry(data.getMinutes());
  return `${rok}-${miesiac}-${dzien}T${godzina}:${minuta}`;
}

export function formatujDataGodzinePodgladu(tekstIso) {
  const data = tekstIso ? new Date(tekstIso) : null;
  if (!data || Number.isNaN(data.getTime())) return tekstIso || '—';
  const dwieCyfry = (l) => String(l).padStart(2, '0');
  return `${dwieCyfry(data.getDate())}.${dwieCyfry(data.getMonth() + 1)}.${data.getFullYear()} `
    + `${dwieCyfry(data.getHours())}:${dwieCyfry(data.getMinutes())}`;
}

// Źródło wartości odczytu (kolumna `zrodlo` w `odczyty`, od 1.5.0):
//   'ocr'        — zapisana dokładnie wartość z rozpoznania zdjęcia,
//   'ze_zdjecia' — było zdjęcie, ale wartość wpisana / poprawiona ręcznie,
//   'reczny'     — bez zdjęcia.
// Odczyty z OCR mają inny profil błędu niż przepisane — przyda się przy
// przyszłej analizie wartości odstających (BACKLOG pkt 21, 27).
export function zrodloOdczytu(maZdjecie, zOcr, wartosc) {
  if (!maZdjecie) return 'reczny';
  return zOcr !== null && Math.abs(wartosc - zOcr) < 1e-9 ? 'ocr' : 'ze_zdjecia';
}

// Informacja pod polem daty: skąd wzięła się wpisana godzina. Tylko dla zdjęcia
// z galerii — przy ręcznym wpisie i zdjęciu z aparatu godzina to po prostu
// czas telefonu i nie ma o czym mówić. Pole zawsze zostaje edytowalne.
const UWAGI_CZASU = {
  exif: { tekst: 'Godzina ze zdjęcia (EXIF) — sprawdź, czy się zgadza.', przyblizona: false },
  plik: { tekst: 'Zdjęcie nie ma daty zrobienia — wpisana data pliku (przybliżona). Popraw, jeśli odczyt był o innej porze.', przyblizona: true },
  brak: { tekst: 'Nie znaleziono daty zdjęcia — wpisana bieżąca godzina. Popraw, jeśli odczyt był wcześniej.', przyblizona: true },
};

// `akapit` pozwala użyć tej samej uwagi na ekranie potwierdzenia
// i na ekranie prądu (każdy ma własny akapit pod polem daty).
export function ustawUwageCzasu(czasZdjecia, akapit) {
  const uwaga = czasZdjecia ? UWAGI_CZASU[czasZdjecia.zrodlo] : null;
  akapit.classList.toggle('ukryty', !uwaga);
  akapit.classList.toggle('uwaga-pola--przyblizona', Boolean(uwaga && uwaga.przyblizona));
  akapit.textContent = uwaga ? uwaga.tekst : '';
}

// Wiersz statusu pod nagłówkiem bloku. rodzaj: 'wczytywanie' | 'info' | 'blad'
// (steruje wyglądem przez klasę status-bloku--<rodzaj>); null chowa wiersz.
export function ustawStatusBloku(blok, tekst, rodzaj) {
  blok.className = 'status-bloku';
  if (!tekst) {
    blok.classList.add('ukryty');
    blok.textContent = '';
    return;
  }
  blok.classList.add('status-bloku--' + rodzaj);
  blok.textContent = tekst;
}

// Wczytuje jeden blok ekranu Podgląd według wzorca "pokaż stare, odśwież
// w tle" (BACKLOG pkt 12): jeśli w buforze (js/bufor.js) jest poprzednia
// odpowiedź, rysujemy ją OD RAZU i dopiero potem odpytujemy webhook; świeża
// odpowiedź podmienia widok. Dzięki temu ekran nie jest pusty przez 1–2 s
// (a czasem kilkanaście) po każdym otwarciu. Bez bufora — jak dotąd:
// "Wczytywanie…" i czekanie.
//
// Mierzymy też czas odpowiedzi i pokazujemy go po wczytaniu — dane do oceny,
// czy bufor rzeczywiście pomaga; z telefonu nie zajrzymy do konsoli.
// Spóźniona odpowiedź z poprzedniego otwarcia ekranu jest ignorowana
// (licznik generacji, jak w ekranie Kocioł).
//
// Używana też przez sekcję historii na ekranie Kocioł — stąd `czyAktualny`:
// każdy ekran sprawdza aktualność swoim licznikiem generacji.
export async function wczytajBlokPodgladu(czyAktualny, blok) {
  const start = performance.now();
  const zBufora = odczytajBufor(blok.klucz);

  if (zBufora) {
    blok.renderuj(zBufora.dane);
    ustawStatusBloku(blok.status,
      `Z pamięci (${opiszWiek(zBufora.czas)}) — odświeżam…`, 'wczytywanie');
  } else {
    ustawStatusBloku(blok.status, 'Wczytywanie…', 'wczytywanie');
  }

  // Błąd przy odświeżaniu NIE kasuje tego, co już pokazaliśmy z bufora —
  // lepiej stare dane z uczciwym ostrzeżeniem niż pusty ekran.
  const pokazBlad = (powod) => {
    const doTego = zBufora ? ` Pokazuję dane z pamięci (${opiszWiek(zBufora.czas)}).` : '';
    ustawStatusBloku(blok.status, `Nie udało się odświeżyć (${powod}).${doTego}`, 'blad');
  };

  try {
    const wynik = await blok.pobierz();
    if (!czyAktualny()) return;

    if (wynik.ok) {
      zapiszBufor(blok.klucz, wynik);
      // Jeśli świeże dane są takie same jak z bufora, nie rysujemy drugi raz.
      if (!zBufora || JSON.stringify(zBufora.dane) !== JSON.stringify(wynik)) {
        blok.renderuj(wynik);
      }
      const sekundy = ((performance.now() - start) / 1000).toFixed(1).replace('.', ',');
      ustawStatusBloku(blok.status, `Wczytano w ${sekundy} s`, 'info');
    } else {
      pokazBlad(wynik.blad || 'błąd webhooka');
    }
  } catch (blad) {
    if (!czyAktualny()) return;
    console.error('Nie udało się wczytać bloku podglądu:', blad);
    pokazBlad('brak połączenia');
  }
}
