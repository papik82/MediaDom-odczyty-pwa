// Kolejka offline — odczyty, których nie udało się wysłać (brak zasięgu),
// czekają tu w localStorage i idą same przy najbliższej okazji (start
// aplikacji albo powrót połączenia). Kolejność ma znaczenie: webhook
// sprawdza chronologię per medium, więc wysyłamy zawsze od najstarszego.

const KLUCZ_KOLEJKI = 'odczyty_kolejka_offline';

function odczytajKolejke() {
  try {
    const zapisane = JSON.parse(localStorage.getItem(KLUCZ_KOLEJKI));
    return Array.isArray(zapisane) ? zapisane : [];
  } catch {
    return [];
  }
}

function zapiszKolejke(kolejka) {
  localStorage.setItem(KLUCZ_KOLEJKI, JSON.stringify(kolejka));
}

export function pobierzKolejke() {
  return odczytajKolejke();
}

export function liczbaWKolejce() {
  return odczytajKolejke().length;
}

export function dodajDoKolejki(odczyt) {
  const kolejka = odczytajKolejke();
  kolejka.push(odczyt);
  zapiszKolejke(kolejka);
}

// Usuwa najstarszy wpis (ten, który właśnie próbowaliśmy wysłać).
export function usunPierwszyZKolejki() {
  const kolejka = odczytajKolejke();
  kolejka.shift();
  zapiszKolejke(kolejka);
}
