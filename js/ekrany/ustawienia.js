// Ekran ustawień: adres webhooka i token (localStorage).

import {
  odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane, odczytajPolozenie, zapiszPolozenie,
  odczytajDateKopii, zapiszDateKopii,
} from '../ustawienia.js';
import { zapiszKopieUstawien } from '../webhook.js';
import { odswiezPore } from '../pora.js';
import { wyczyscBufor } from '../bufor.js';
import { zbudujKodKopii, odczytajKodKopii } from '../kopia-ustawien.js';
import {
  pokazEkran, ekranStart, powiadomOZmianieUstawien, pokazKomunikatStart,
} from '../nawigacja.js';

const ekranUstawien = document.getElementById('ekran-ustawienia');
// Kafelek „Ustawienia” na pulpicie (przycisk w nagłówku usunięty w 1.9.0).
const przyciskiUstawien = document.querySelectorAll('[data-otworz-ustawienia]');
const przyciskAnuluj = document.getElementById('przycisk-anuluj');
const formularzUstawien = document.getElementById('formularz-ustawien');
const poleAdres = document.getElementById('pole-adres');
const poleToken = document.getElementById('pole-token');
const komunikatUstawien = document.getElementById('komunikat-ustawien');
const poleSzerokosc = document.getElementById('pole-szerokosc');
const poleDlugosc = document.getElementById('pole-dlugosc');
const przyciskGps = document.getElementById('przycisk-gps');
const podpowiedzKopii = document.getElementById('podpowiedz-kopii');
const przyciskZapiszKopie = document.getElementById('przycisk-zapisz-kopie');
const przyciskPrzywroc = document.getElementById('przycisk-przywroc');
const poleKodKopii = document.getElementById('pole-kod-kopii');
const komunikatKopii = document.getElementById('komunikat-kopii');
const statusKopii = document.getElementById('status-kopii');

// Liczba z przecinkiem lub kropką → number; pusty tekst → null; reszta → NaN.
function wczytajLiczbe(tekst) {
  const t = tekst.trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

function pokazPolozenie(polozenie) {
  poleSzerokosc.value = polozenie ? String(polozenie.szerokosc).replace('.', ',') : '';
  poleDlugosc.value = polozenie ? String(polozenie.dlugosc).replace('.', ',') : '';
}

function pokazBlad(tekst) {
  komunikatUstawien.textContent = tekst;
  komunikatUstawien.classList.remove('ukryty');
}

// Przycisk „Anuluj” ma sens tylko wtedy, gdy jest do czego wracać —
// przy pierwszym uruchomieniu, bez zapisanych ustawień, go ukrywamy.
export function otworzUstawienia() {
  const ustawienia = odczytajUstawienia();
  poleAdres.value = ustawienia ? ustawienia.adresWebhooka : '';
  poleToken.value = ustawienia ? ustawienia.token : '';
  pokazPolozenie(odczytajPolozenie());
  przyciskAnuluj.classList.toggle('ukryty', !czyUstawieniaZapisane());
  // Pierwsze uruchomienie (albo po wyczyszczeniu pamięci): od razu wskazujemy kopię.
  podpowiedzKopii.classList.toggle('ukryty', czyUstawieniaZapisane());
  komunikatUstawien.classList.add('ukryty');
  komunikatKopii.classList.add('ukryty');
  poleKodKopii.value = '';
  odswiezStatusKopii();
  pokazEkran(ekranUstawien);
}

przyciskiUstawien.forEach((przycisk) => przycisk.addEventListener('click', otworzUstawienia));

przyciskAnuluj.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

// „Użyj mojego położenia” — jednorazowe pytanie telefonu o lokalizację. Do
// słońca wystarczy ok. 1 km, więc zaokrąglamy do dwóch miejsc po przecinku
// (nie zapisujemy dokładnego adresu domu).
przyciskGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    pokazBlad('Ta przeglądarka nie udostępnia położenia — wpisz współrzędne ręcznie.');
    return;
  }
  komunikatUstawien.classList.add('ukryty');
  przyciskGps.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pozycja) => {
      przyciskGps.disabled = false;
      pokazPolozenie({
        szerokosc: Math.round(pozycja.coords.latitude * 100) / 100,
        dlugosc: Math.round(pozycja.coords.longitude * 100) / 100,
      });
    },
    () => {
      przyciskGps.disabled = false;
      pokazBlad('Nie udało się pobrać położenia (brak zgody albo sygnału) — wpisz współrzędne ręcznie.');
    },
    { timeout: 15000, maximumAge: 600000 },
  );
});

formularzUstawien.addEventListener('submit', (zdarzenie) => {
  zdarzenie.preventDefault();
  const szerokosc = wczytajLiczbe(poleSzerokosc.value);
  const dlugosc = wczytajLiczbe(poleDlugosc.value);
  // Oba pola albo żadne; w zakresie geograficznym.
  if ((szerokosc === null) !== (dlugosc === null)
    || Number.isNaN(szerokosc) || Number.isNaN(dlugosc)
    || (szerokosc !== null && (Math.abs(szerokosc) > 90 || Math.abs(dlugosc) > 180))) {
    pokazBlad('Wpisz obie współrzędne jako liczby (szerokość od −90 do 90, długość od −180 do 180) albo zostaw oba pola puste.');
    return;
  }
  zapiszPolozenie(szerokosc, dlugosc);
  odswiezPore();
  zapiszUstawienia(poleAdres.value, poleToken.value);
  // Nowy adres/token to potencjalnie inny arkusz — dane z poprzedniego
  // nie mogą się pokazać ani w buforze ekranów, ani jako nastawy kotła
  // (moduł Kotła unieważnia je przez naZmianieUstawien).
  wyczyscBufor();
  powiadomOZmianieUstawien();
  pokazEkran(ekranStart);
  // Kopia w arkuszu po każdym zapisie ustawień (też po zmianie tokenu — nowy token
  // nadpisuje starą kopię). Wynik widać w komunikacie na ekranie startowym.
  zapiszKopieWTle('Ustawienia zapisane.');
});

// Bez zapisanego adresu i tokenu nie ma skąd pobrać danych — wtedy
// najpierw ekran ustawień, jak przy pozostałych kartach.
export function poUstawieniach(otworz) {
  return () => {
    if (!czyUstawieniaZapisane()) {
      otworzUstawienia();
      return;
    }
    otworz();
  };
}

// --- Kopia ustawień w arkuszu (od 1.19.0) ------------------------------------
//
// Kod (js/kopia-ustawien.js) powstaje z ZAPISANYCH ustawień, nie z tego, co
// akurat wpisano w formularz — kopia ma odtworzyć działający stan. Do arkusza
// trafia przez webhook (akcja `zapisz_kopie_ustawien`, zakładka `kopia_ustawien`),
// który składa też link przywracania. Po wyczyszczeniu pamięci telefonu link
// z arkusza (albo kod wklejony poniżej) przywraca ustawienia.

// Adres tej aplikacji z końcowym „/”, bez fragmentu i zapytania — do linku w arkuszu.
function adresAplikacji() {
  // Webhook przyjmuje tylko adres https; lokalnie (http://localhost…) wysyłamy sam kod.
  if (window.location.protocol !== 'https:') return '';
  return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
}

function pokazKomunikatKopii(tekst, blad) {
  komunikatKopii.textContent = tekst;
  komunikatKopii.classList.toggle('komunikat-sukces', !blad);
  komunikatKopii.classList.remove('ukryty');
}

function odswiezStatusKopii() {
  const data = odczytajDateKopii();
  if (!data) {
    statusKopii.textContent = 'Kopii w arkuszu jeszcze nie zrobiono.';
    return;
  }
  const [rok, mm, dd] = data.slice(0, 10).split('-');
  statusKopii.textContent = `Ostatnia kopia w arkuszu: ${dd}.${mm}.${rok} ${data.slice(11, 16)}.`;
}

// Zapisuje kopię zapisanych ustawień w arkuszu. Zwraca { ok } albo { ok: false, blad }.
export async function zapiszKopieWArkuszu() {
  const ustawienia = odczytajUstawienia();
  if (!ustawienia) return { ok: false, blad: 'Najpierw zapisz ustawienia.' };
  try {
    const kod = zbudujKodKopii({ ...ustawienia, polozenie: odczytajPolozenie() });
    const odpowiedz = await zapiszKopieUstawien(kod, adresAplikacji());
    if (!odpowiedz.ok) return { ok: false, blad: odpowiedz.blad || 'webhook odrzucił kopię' };
    zapiszDateKopii(odpowiedz.zapisano || new Date().toISOString().slice(0, 19));
    return { ok: true };
  } catch (blad) {
    return { ok: false, blad: navigator.onLine ? 'brak odpowiedzi serwera' : 'brak połączenia' };
  }
}

// Kopia po zapisie ustawień albo przy starcie: wynik w komunikacie na ekranie
// startowym. `poczatek` — zdanie przed wynikiem („Ustawienia zapisane.”).
export async function zapiszKopieWTle(poczatek) {
  const wynik = await zapiszKopieWArkuszu();
  const wstep = poczatek ? `${poczatek} ` : '';
  if (wynik.ok) {
    pokazKomunikatStart(`${wstep}Kopia ustawień zapisana w arkuszu.`);
  } else if (poczatek) {
    pokazKomunikatStart(`${wstep}Nie udało się zapisać kopii ustawień w arkuszu (${wynik.blad}) — spróbuj w Ustawieniach.`);
  }
  odswiezStatusKopii();
}

// Po aktualizacji do 1.19.0 ustawienia już są, a kopii jeszcze nie było — robimy
// ją raz (błąd, np. brak zasięgu, nie daje komunikatu i powtórzy się przy następnym starcie).
export function zrobKopieJesliBrak() {
  if (!czyUstawieniaZapisane() || odczytajDateKopii()) return;
  zapiszKopieWTle('');
}

przyciskZapiszKopie.addEventListener('click', async () => {
  przyciskZapiszKopie.disabled = true;
  const wynik = await zapiszKopieWArkuszu();
  przyciskZapiszKopie.disabled = false;
  odswiezStatusKopii();
  if (wynik.ok) pokazKomunikatKopii('Kopia ustawień zapisana w arkuszu (zakładka kopia_ustawien).', false);
  else pokazKomunikatKopii(`Nie udało się zapisać kopii: ${wynik.blad}.`, true);
});

// Zastosowanie ustawień z kopii — wspólne dla pola z kodem i linku z arkusza.
// Pyta o zgodę, gdy zastępuje inne ustawienia. Zwraca true, gdy zastosowano.
function zastosujKopie({ adresWebhooka, token, polozenie }) {
  const obecne = odczytajUstawienia();
  if (obecne && (obecne.adresWebhooka !== adresWebhooka || obecne.token !== token)
    && !window.confirm('Zastąpić obecne ustawienia ustawieniami z kopii?')) {
    return false;
  }
  zapiszUstawienia(adresWebhooka, token);
  // Kopia bez położenia nie kasuje położenia wpisanego już na tym telefonie.
  if (polozenie) {
    zapiszPolozenie(polozenie.szerokosc, polozenie.dlugosc);
    odswiezPore();
  }
  // Jak przy zwykłym zapisie ustawień: inny adres to potencjalnie inny arkusz.
  wyczyscBufor();
  powiadomOZmianieUstawien();
  return true;
}

przyciskPrzywroc.addEventListener('click', () => {
  const wynik = odczytajKodKopii(poleKodKopii.value);
  if (!wynik.ok) {
    pokazKomunikatKopii(wynik.blad, true);
    return;
  }
  if (!zastosujKopie(wynik.ustawienia)) return;
  poleKodKopii.value = '';
  pokazEkran(ekranStart);
  pokazKomunikatStart('Ustawienia przywrócone z kopii.');
});

// Przywracanie z linku z arkusza: adres aplikacji z fragmentem `#przywroc=<kod>`.
// Wołane raz przy starcie (js/app.js), PRZED wyborem pierwszego ekranu. Fragment
// usuwamy z paska adresu od razu (token nie zostaje w historii ani zakładkach),
// a błędny kod pokazujemy na ekranie Ustawienia. Zwraca true, gdy przywrócono.
let bladLinkuKopii = null;

export function przywrocZLinku() {
  const trafienie = window.location.hash.match(/^#przywroc=(.+)$/);
  if (!trafienie) return false;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  let kod = trafienie[1];
  try {
    kod = decodeURIComponent(kod);
  } catch (blad) {
    // zostaje surowy tekst — odczytajKodKopii sam oceni
  }
  const wynik = odczytajKodKopii(kod);
  if (!wynik.ok) {
    bladLinkuKopii = wynik.blad;
    return false;
  }
  return zastosujKopie(wynik.ustawienia);
}

// Błąd z linku (zły albo ucięty kod) pokazujemy po otwarciu ekranu Ustawienia.
export function pokazBladLinkuJesliJest() {
  if (!bladLinkuKopii) return;
  pokazKomunikatKopii(`Link z arkusza nie zadziałał: ${bladLinkuKopii}`, true);
  bladLinkuKopii = null;
}
