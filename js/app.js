// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków
// i formularza ustawień. Na tym etapie (punkty 1–2) kafelki jeszcze niczego
// nie wysyłają — to dojdzie w kolejnych krokach.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';

const ekranStart = document.getElementById('ekran-start');
const ekranUstawien = document.getElementById('ekran-ustawienia');
const przyciskUstawienia = document.getElementById('przycisk-ustawienia');
const przyciskAnuluj = document.getElementById('przycisk-anuluj');
const formularzUstawien = document.getElementById('formularz-ustawien');
const poleAdres = document.getElementById('pole-adres');
const poleToken = document.getElementById('pole-token');
const komunikatUstawien = document.getElementById('komunikat-ustawien');
const kafelki = document.querySelectorAll('.kafelek');

function pokazEkran(ekranDoPokazania) {
  for (const ekran of [ekranStart, ekranUstawien]) {
    ekran.classList.toggle('ukryty', ekran !== ekranDoPokazania);
  }
}

// Przycisk „Anuluj” ma sens tylko wtedy, gdy jest do czego wracać —
// przy pierwszym uruchomieniu, bez zapisanych ustawień, go ukrywamy.
function otworzUstawienia() {
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
  pokazEkran(ekranStart);
});

// Kafelki mediów — ekran potwierdzenia i wysyłka odczytu dojdą w kolejnych
// krokach (punkty 3–4 z kolejności pracy). Na razie kafelek tylko sygnalizuje,
// że trzeba wpierw uzupełnić ustawienia, jeśli jeszcze ich nie ma.
kafelki.forEach((kafelek) => {
  kafelek.addEventListener('click', () => {
    if (!czyUstawieniaZapisane()) {
      otworzUstawienia();
      return;
    }
    const medium = kafelek.dataset.medium;
    console.log(`Wybrano medium: ${medium} — ekran odczytu jeszcze nie gotowy.`);
  });
});

// Przy pierwszym uruchomieniu, bez zapisanych ustawień, od razu pokazujemy
// ekran ustawień — bez adresu i tokenu wysyłka i tak by się nie udała.
pokazEkran(czyUstawieniaZapisane() ? ekranStart : ekranUstawien);
if (!czyUstawieniaZapisane()) {
  przyciskAnuluj.classList.add('ukryty');
}

// Rejestracja service workera — pozwala otworzyć aplikację bez zasięgu.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((blad) => {
      console.error('Nie udało się zarejestrować service workera:', blad);
    });
  });
}
