// Ekran ustawień: adres webhooka i token (localStorage).

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from '../ustawienia.js';
import { wyczyscBufor } from '../bufor.js';
import { pokazEkran, ekranStart, powiadomOZmianieUstawien } from '../nawigacja.js';

const ekranUstawien = document.getElementById('ekran-ustawienia');
const przyciskUstawienia = document.getElementById('przycisk-ustawienia');
const przyciskAnuluj = document.getElementById('przycisk-anuluj');
const formularzUstawien = document.getElementById('formularz-ustawien');
const poleAdres = document.getElementById('pole-adres');
const poleToken = document.getElementById('pole-token');
const komunikatUstawien = document.getElementById('komunikat-ustawien');

// Przycisk „Anuluj” ma sens tylko wtedy, gdy jest do czego wracać —
// przy pierwszym uruchomieniu, bez zapisanych ustawień, go ukrywamy.
export function otworzUstawienia() {
  const ustawienia = odczytajUstawienia();
  poleAdres.value = ustawienia ? ustawienia.adresWebhooka : '';
  poleToken.value = ustawienia ? ustawienia.token : '';
  przyciskAnuluj.classList.toggle('ukryty', !czyUstawieniaZapisane());
  komunikatUstawien.classList.add('ukryty');
  pokazEkran(ekranUstawien);
}

przyciskUstawienia.addEventListener('click', otworzUstawienia);

przyciskAnuluj.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

formularzUstawien.addEventListener('submit', (zdarzenie) => {
  zdarzenie.preventDefault();
  zapiszUstawienia(poleAdres.value, poleToken.value);
  // Nowy adres/token to potencjalnie inny arkusz — dane z poprzedniego
  // nie mogą się pokazać ani w buforze Podglądu, ani jako nastawy kotła
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
