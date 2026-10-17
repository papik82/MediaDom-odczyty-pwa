// Ekran ustawień: adres webhooka i token (localStorage).

import {
  odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane, odczytajPolozenie, zapiszPolozenie,
} from '../ustawienia.js';
import { odswiezPore } from '../pora.js';
import { wyczyscBufor } from '../bufor.js';
import { pokazEkran, ekranStart, powiadomOZmianieUstawien } from '../nawigacja.js';

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
  komunikatUstawien.classList.add('ukryty');
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
