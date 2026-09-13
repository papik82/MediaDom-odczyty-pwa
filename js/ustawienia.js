// Ustawienia aplikacji — adres webhooka i token trzymane w localStorage.
// Nic z tego nie trafia do repozytorium ani nie jest wysyłane nigdzie poza
// zapisany adres webhooka, więc bezpiecznie może zostać w przeglądarce.

const KLUCZ_ADRES = 'odczyty_adres_webhooka';
const KLUCZ_TOKEN = 'odczyty_token';

// Zwraca { adresWebhooka, token } albo null, gdy ustawienia nie są jeszcze
// zapisane (pierwsze uruchomienie aplikacji).
export function odczytajUstawienia() {
  const adresWebhooka = localStorage.getItem(KLUCZ_ADRES);
  const token = localStorage.getItem(KLUCZ_TOKEN);

  if (!adresWebhooka || !token) {
    return null;
  }

  return { adresWebhooka, token };
}

export function zapiszUstawienia(adresWebhooka, token) {
  localStorage.setItem(KLUCZ_ADRES, adresWebhooka.trim());
  localStorage.setItem(KLUCZ_TOKEN, token.trim());
}

export function czyUstawieniaZapisane() {
  return odczytajUstawienia() !== null;
}
