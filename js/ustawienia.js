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

// Położenie do liczenia wschodu i zachodu słońca (pory dnia, js/pora.js).
// Szerokość i długość geograficzna w stopniach, zapisane tylko w localStorage
// tego telefonu — nie trafiają do repozytorium ani do webhooka. Opcjonalne:
// bez nich aplikacja zostaje przy dniu.
const KLUCZ_SZEROKOSC = 'odczyty_szerokosc';
const KLUCZ_DLUGOSC = 'odczyty_dlugosc';

export function odczytajPolozenie() {
  const szerokosc = parseFloat(localStorage.getItem(KLUCZ_SZEROKOSC));
  const dlugosc = parseFloat(localStorage.getItem(KLUCZ_DLUGOSC));
  if (!Number.isFinite(szerokosc) || !Number.isFinite(dlugosc)) return null;
  return { szerokosc, dlugosc };
}

// Puste wartości (null) kasują położenie.
export function zapiszPolozenie(szerokosc, dlugosc) {
  if (szerokosc === null || dlugosc === null) {
    localStorage.removeItem(KLUCZ_SZEROKOSC);
    localStorage.removeItem(KLUCZ_DLUGOSC);
    return;
  }
  localStorage.setItem(KLUCZ_SZEROKOSC, String(szerokosc));
  localStorage.setItem(KLUCZ_DLUGOSC, String(dlugosc));
}

export function czyUstawieniaZapisane() {
  return odczytajUstawienia() !== null;
}
