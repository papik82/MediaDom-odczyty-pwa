// Podgląd tylko do odczytu: karty „Odczyty” (ostatnie wpisy z `odczyty`)
// i „Temperatury” (średnie dobowe z `temp_doba`, wykres doby po stuknięciu dnia).

import { MEDIA } from '../media.js';
import { pobierzOstatnieOdczyty, pobierzTemperaturyDobowe } from '../webhook.js';
import { formatujDataGodzinePodgladu, wczytajBlokPodgladu } from '../wspolne.js';
import { pokazEkran, ekranStart, ukryjKomunikatStart } from '../nawigacja.js';
import { poUstawieniach } from './ustawienia.js';
import {
  przelaczWykresDoby, wyczyscWykresDoby, zabierzRozwinietyDzien,
} from './wykres-doby.js';

const ekranOdczyty = document.getElementById('ekran-odczyty');
const ekranTemperatury = document.getElementById('ekran-temperatury');
const przyciskOdczyty = document.getElementById('przycisk-odczyty');
const przyciskTemperatury = document.getElementById('przycisk-temperatury');
const przyciskZamknijOdczyty = document.getElementById('przycisk-zamknij-odczyty');
const przyciskZamknijTemperatury = document.getElementById('przycisk-zamknij-temperatury');
const listaOstatnichOdczytow = document.getElementById('lista-ostatnich-odczytow');
const tabelaTemperatur = document.getElementById('tabela-temperatur');
const statusOdczytow = document.getElementById('status-odczytow');
const statusTemperatur = document.getElementById('status-temperatur');

// Ta sama rola co generacjaKotla/generacjaPotwierdzenia — chroni podgląd
// przed nadpisaniem przez odpowiedź z poprzedniego, już zamkniętego otwarcia.
let generacjaPodgladu = 0;

// --- Podgląd: ostatnie odczyty i temperatury dobowe (punkt 6 backlogu) ---
//
// Wyłącznie do odczytu — dwa niezależne zapytania do webhooka, każde może
// się nie udać osobno (np. jedno się wczyta, drugie pokaże błąd), więc
// obsługujemy je niezależnie zamiast jednym wspólnym try/catch.

function renderujOstatnieOdczyty(odczyty) {
  listaOstatnichOdczytow.innerHTML = '';

  if (!odczyty || odczyty.length === 0) {
    const pusto = document.createElement('p');
    pusto.className = 'komunikat-pusto';
    pusto.textContent = 'Brak zapisanych odczytów.';
    listaOstatnichOdczytow.appendChild(pusto);
    return;
  }

  odczyty.forEach((o) => {
    const opisMedium = MEDIA[o.medium];
    const wiersz = document.createElement('div');
    wiersz.className = 'wiersz-odczytu';
    wiersz.innerHTML = `
      <span class="wiersz-odczytu__data">${formatujDataGodzinePodgladu(o.data_godzina)}</span>
      <span class="wiersz-odczytu__medium">${opisMedium ? opisMedium.nazwa : o.medium}</span>
      <span class="wiersz-odczytu__stan">${o.stan}${opisMedium ? ' ' + opisMedium.jednostka : ''}</span>
    `;
    listaOstatnichOdczytow.appendChild(wiersz);
  });
}

// Kolumny (czujniki) budujemy z tego, co faktycznie przyszło w danych,
// zamiast zaszywać nazwy na sztywno — czujników przybywało w przeszłości
// (patrz historia w temp_doba) i mogą dojść kolejne.
function renderujTemperaturyDobowe(dni) {
  tabelaTemperatur.innerHTML = '';

  if (!dni || dni.length === 0) {
    tabelaTemperatur.innerHTML = '<tr><td class="komunikat-pusto">Brak danych o temperaturach.</td></tr>';
    return;
  }

  const czujniki = Array.from(new Set(dni.flatMap((d) => Object.keys(d.czujniki || {})))).sort();

  const naglowek = document.createElement('tr');
  naglowek.innerHTML = '<th>Data</th>' + czujniki.map((cz) => `<th>${cz}</th>`).join('');
  const thead = document.createElement('thead');
  thead.appendChild(naglowek);
  tabelaTemperatur.appendChild(thead);

  // Dodatkowa, wąska kolumna na strzałkę rozwijania (od 0.21.0).
  naglowek.insertAdjacentHTML('beforeend', '<th aria-hidden="true"></th>');

  const tbody = document.createElement('tbody');
  dni.forEach((d) => {
    const wiersz = document.createElement('tr');
    wiersz.className = 'wiersz-dnia';
    wiersz.dataset.data = d.data;
    // Wiersz działa jak przycisk: stuknięcie (albo Enter na klawiaturze)
    // rozwija pod nim wykres temperatur z tej doby.
    wiersz.tabIndex = 0;
    wiersz.setAttribute('role', 'button');
    wiersz.setAttribute('aria-expanded', 'false');
    const komorki = czujniki.map((cz) => {
      const wartosc = d.czujniki ? d.czujniki[cz] : undefined;
      return `<td>${typeof wartosc === 'number' ? wartosc.toFixed(1) + '°' : '—'}</td>`;
    }).join('');
    wiersz.innerHTML = `<td>${d.data}</td>${komorki}<td class="wiersz-dnia__strzalka" aria-hidden="true">▾</td>`;
    wiersz.addEventListener('click', () => przelaczWykres(wiersz, czujniki.length + 2));
    wiersz.addEventListener('keydown', (zdarzenie) => {
      if (zdarzenie.key === 'Enter' || zdarzenie.key === ' ') {
        zdarzenie.preventDefault();
        przelaczWykres(wiersz, czujniki.length + 2);
      }
    });
    tbody.appendChild(wiersz);
  });
  tabelaTemperatur.appendChild(tbody);

  // Tabela bywa rysowana dwa razy (najpierw z bufora, potem ze świeżej
  // odpowiedzi) — jeśli jakiś dzień był rozwinięty, rozwijamy go ponownie,
  // żeby podmiana danych nie zamykała wykresu pod palcem.
  const dzien = zabierzRozwinietyDzien();
  if (dzien) {
    const wiersz = tbody.querySelector(`tr[data-data="${dzien}"]`);
    if (wiersz) przelaczWykres(wiersz, czujniki.length + 2);
  }
}

// Wykres doby z aktualnym licznikiem generacji tego ekranu.
function przelaczWykres(wiersz, liczbaKolumn) {
  const generacja = generacjaPodgladu;
  przelaczWykresDoby(tabelaTemperatur, wiersz, liczbaKolumn, () => generacja === generacjaPodgladu);
}

// Ile pozycji pokazują ekrany podglądu: ostatnich wpisów z `odczyty`
// i ostatnich dni z `temp_doba`. Jedna stała dla obu, żeby zmieniać to
// w jednym miejscu. 20 wystarcza do sprawdzenia z telefonu, co ostatnio
// poszło do arkusza, a krótsza lista daje mniejszą odpowiedź webhooka.
const ILE_POZYCJI_PODGLADU = 20;

// Od 0.22.0 podgląd to dwa osobne ekrany — każdy pobiera tylko swoje dane
// (wcześniej jeden ekran czekał na dwa zapytania naraz). Wspólny licznik
// generacji wystarcza, bo naraz widać najwyżej jeden z tych ekranów:
// spóźniona odpowiedź z poprzedniego otwarcia nie narysuje się w nowym.
function otworzOdczyty() {
  ukryjKomunikatStart();
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;
  listaOstatnichOdczytow.innerHTML = '';
  pokazEkran(ekranOdczyty);

  wczytajBlokPodgladu(() => generacja === generacjaPodgladu, {
    status: statusOdczytow,
    klucz: 'ostatnie_odczyty',
    pobierz: () => pobierzOstatnieOdczyty(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujOstatnieOdczyty(wynik.odczyty),
  });
}

function otworzTemperatury() {
  ukryjKomunikatStart();
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;
  tabelaTemperatur.innerHTML = '';
  // Każde otwarcie zaczyna ze zwiniętą tabelą. Pamięć godzin czyścimy,
  // bo dzień importu mógł w międzyczasie dostać nowe godziny.
  wyczyscWykresDoby();
  pokazEkran(ekranTemperatury);

  wczytajBlokPodgladu(() => generacja === generacjaPodgladu, {
    status: statusTemperatur,
    klucz: 'temperatury_dobowe',
    pobierz: () => pobierzTemperaturyDobowe(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujTemperaturyDobowe(wynik.dni),
  });
}

przyciskOdczyty.addEventListener('click', poUstawieniach(otworzOdczyty));
przyciskTemperatury.addEventListener('click', poUstawieniach(otworzTemperatury));
przyciskZamknijOdczyty.addEventListener('click', () => pokazEkran(ekranStart));
przyciskZamknijTemperatury.addEventListener('click', () => pokazEkran(ekranStart));

