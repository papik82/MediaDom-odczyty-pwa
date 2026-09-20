// Minimalny czytnik EXIF: wyciąga z pliku JPEG datę i godzinę zrobienia zdjęcia.
//
// Po co: zdjęcie licznika wybrane z galerii mogło powstać godziny albo dni
// przed wpisem, a ΔT liczy się z prawdziwego momentu odczytu (BACKLOG pkt 3).
// Bez bibliotek (zasada projektu) — czytamy tylko to jedno pole i ignorujemy
// resztę EXIF-a.
//
// Jak to jest zbudowane (w skrócie): plik JPEG to ciąg "segmentów"; EXIF siedzi
// w segmencie APP1 (marker 0xFFE1) w formacie TIFF. TIFF ma nagłówek
// (kolejność bajtów + adres pierwszego katalogu), a katalogi (IFD) to listy
// 12-bajtowych wpisów {tag, typ, liczba, wartość/adres}. Data zrobienia
// (tag 0x9003, DateTimeOriginal) leży w podkatalogu "Exif", na który wskazuje
// tag 0x8769 z głównego katalogu.
//
// EXIF NIE zawiera strefy czasowej — traktujemy datę jako czas lokalny,
// zgodnie z konwencją webhooka (Europe/Warsaw, patrz apps-script/CLAUDE.md).

const TAG_WSKAZNIK_EXIF = 0x8769;      // główny katalog → podkatalog Exif
const TAG_DATA_ZROBIENIA = 0x9003;     // DateTimeOriginal
const TAG_DATA_CYFROWA = 0x9004;       // DateTimeDigitized (zapas)

// APP1 z EXIF-em leży na samym początku pliku i ma najwyżej 64 KB — nie ma
// sensu wczytywać całego, wielomegabajtowego zdjęcia.
const ILE_BAJTOW_CZYTAC = 256 * 1024;

// "2026:09:12 17:31:07" → Date w czasie lokalnym; null przy złym formacie.
function sparsujDateExif(tekst) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(tekst);
  if (!m) return null;
  const [rok, mies, dzien, godz, min, sek] = m.slice(1).map(Number);
  const data = new Date(rok, mies - 1, dzien, godz, min, sek);
  // Aparaty z rozładowanym zegarkiem zapisują "0000:00:00 00:00:00" albo
  // datę fabryczną — taka data jest gorsza niż brak daty. Odrzucamy: daty
  // sprzed 2000, "przelanie się" miesiąca/dnia (np. miesiąc 00 albo 13)
  // i daty z przyszłości (z zapasem doby na różnice zegarów).
  const przelalo = data.getFullYear() !== rok || data.getMonth() !== mies - 1 || data.getDate() !== dzien;
  if (rok < 2000 || przelalo || data.getTime() > Date.now() + 24 * 3600 * 1000) return null;
  return data;
}

// Szuka wpisu o danym tagu w katalogu TIFF. Zwraca { typ, liczba, przesuniecieWartosci }
// albo null. `tiff` to początek nagłówka TIFF w buforze (adresy liczone od niego).
function znajdzWpis(widok, tiff, adresKatalogu, tag, malyEndian) {
  const start = tiff + adresKatalogu;
  const liczbaWpisow = widok.getUint16(start, malyEndian);
  for (let i = 0; i < liczbaWpisow; i++) {
    const wpis = start + 2 + i * 12;
    if (widok.getUint16(wpis, malyEndian) === tag) {
      return {
        typ: widok.getUint16(wpis + 2, malyEndian),
        liczba: widok.getUint32(wpis + 4, malyEndian),
        pole: wpis + 8, // 4 bajty: wartość albo adres wartości
      };
    }
  }
  return null;
}

function czytajTekst(widok, tiff, wpis, malyEndian) {
  // ASCII dłuższe niż 4 bajty: pole zawiera ADRES tekstu (od początku TIFF).
  const adres = wpis.liczba > 4 ? tiff + widok.getUint32(wpis.pole, malyEndian) : wpis.pole;
  let tekst = '';
  for (let i = 0; i < wpis.liczba; i++) {
    const bajt = widok.getUint8(adres + i);
    if (bajt === 0) break;
    tekst += String.fromCharCode(bajt);
  }
  return tekst;
}

function czasZBufora(bufor) {
  const widok = new DataView(bufor);
  if (widok.byteLength < 4 || widok.getUint16(0) !== 0xFFD8) return null; // nie JPEG

  // Segmenty: marker (2 B) + długość (2 B, wliczając te 2 bajty) + dane.
  let pozycja = 2;
  while (pozycja + 4 <= widok.byteLength) {
    const marker = widok.getUint16(pozycja);
    if ((marker & 0xFF00) !== 0xFF00) return null;      // uszkodzona struktura
    if (marker === 0xFFDA) return null;                 // początek danych obrazu — EXIF-a już nie będzie
    const dlugosc = widok.getUint16(pozycja + 2);

    const czyExif = marker === 0xFFE1
      && widok.getUint32(pozycja + 4) === 0x45786966    // "Exif"
      && widok.getUint16(pozycja + 8) === 0x0000;
    if (czyExif) {
      const tiff = pozycja + 10;
      const malyEndian = widok.getUint16(tiff) === 0x4949; // "II" = little, "MM" = big
      if (widok.getUint16(tiff + 2, malyEndian) !== 42) return null;

      const katalogGlowny = widok.getUint32(tiff + 4, malyEndian);
      const wskaznik = znajdzWpis(widok, tiff, katalogGlowny, TAG_WSKAZNIK_EXIF, malyEndian);
      if (!wskaznik) return null;
      const katalogExif = widok.getUint32(wskaznik.pole, malyEndian);

      for (const tag of [TAG_DATA_ZROBIENIA, TAG_DATA_CYFROWA]) {
        const wpis = znajdzWpis(widok, tiff, katalogExif, tag, malyEndian);
        if (wpis && wpis.typ === 2) {
          const data = sparsujDateExif(czytajTekst(widok, tiff, wpis, malyEndian));
          if (data) return data;
        }
      }
      return null;
    }
    pozycja += 2 + dlugosc;
  }
  return null;
}

// Zwraca Date albo null (brak EXIF-a, inny format niż JPEG, uszkodzony plik).
// Nigdy nie rzuca wyjątku — brak daty to zwykła sytuacja, nie błąd aplikacji.
export async function odczytajCzasZdjecia(plik) {
  try {
    const bufor = await plik.slice(0, ILE_BAJTOW_CZYTAC).arrayBuffer();
    return czasZBufora(bufor);
  } catch (blad) {
    return null;
  }
}
