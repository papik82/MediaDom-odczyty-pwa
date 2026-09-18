// Bufor odpowiedzi webhooka w localStorage — dla ekranu Podgląd.
//
// Wzorzec "pokaż stare, odśwież w tle": ekran od razu rysuje ostatnio pobrane
// dane, a świeża odpowiedź podmienia je, gdy dojdzie. Webhook Apps Script ma
// stałą "podłogę" ok. 1,2–1,6 s na każde wywołanie (patrz BACKLOG.md pkt 12),
// więc bez bufora ekran jest pusty przez tyle czasu przy każdym otwarciu.
//
// UWAGA: to celowo tylko dane do PODGLĄDU (odczyty, temperatury). Nastaw kotła
// tu nie trzymamy — one wypełniają formularz, a nieaktualna podpowiedź mogłaby
// skłonić do zapisania złej zmiany. Dla kotła jest osobne pobieranie
// z wyprzedzeniem, tylko w pamięci (patrz js/app.js).

const PREFIKS = 'odczyty_bufor_';

// localStorage potrafi rzucić wyjątek (tryb prywatny, pełna pamięć, wyłączone
// przez użytkownika) — bufor jest tylko przyspieszeniem, więc każdy błąd
// traktujemy jak "nic nie ma w buforze", a aplikacja działa dalej po staremu.

export function zapiszBufor(klucz, dane) {
  try {
    localStorage.setItem(PREFIKS + klucz, JSON.stringify({ czas: Date.now(), dane }));
  } catch (blad) {
    console.error('Nie udało się zapisać bufora:', blad);
  }
}

// Zwraca { dane, czas } albo null, gdy bufora nie ma lub jest uszkodzony.
export function odczytajBufor(klucz) {
  try {
    const tekst = localStorage.getItem(PREFIKS + klucz);
    if (!tekst) return null;
    const wpis = JSON.parse(tekst);
    if (!wpis || typeof wpis.czas !== 'number' || !wpis.dane) return null;
    return wpis;
  } catch (blad) {
    return null;
  }
}

export function wyczyscBuforKlucz(klucz) {
  try {
    localStorage.removeItem(PREFIKS + klucz);
  } catch (blad) {
    // nic — patrz komentarz wyżej
  }
}

// Czyści cały bufor — przy zmianie adresu webhooka albo tokenu, bo dane
// z poprzedniego arkusza nie mogą się pokazać pod nowymi ustawieniami.
export function wyczyscBufor() {
  try {
    Object.keys(localStorage)
      .filter((klucz) => klucz.startsWith(PREFIKS))
      .forEach((klucz) => localStorage.removeItem(klucz));
  } catch (blad) {
    // nic — patrz komentarz wyżej
  }
}

// "przed chwilą" / "5 min temu" / "3 godz. temu" / "2 dni temu"
export function opiszWiek(czasMs) {
  const minuty = Math.floor((Date.now() - czasMs) / 60000);
  if (minuty < 1) return 'przed chwilą';
  if (minuty < 60) return `${minuty} min temu`;
  const godziny = Math.floor(minuty / 60);
  if (godziny < 24) return `${godziny} godz. temu`;
  return `${Math.floor(godziny / 24)} dni temu`;
}
