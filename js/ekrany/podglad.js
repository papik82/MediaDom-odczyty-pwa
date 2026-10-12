// Podgląd tylko do odczytu: karty „Odczyty” (ostatnie wpisy z `odczyty`)
// i „Temperatury” (średnie dobowe z `temp_doba`, wykres doby po stuknięciu dnia).

import { MEDIA } from '../media.js';
import { pobierzOstatnieOdczyty, pobierzTemperaturyDobowe } from '../webhook.js';
import { element, formatujDataGodzinePodgladu, liczbaPL, wczytajBlokPodgladu } from '../wspolne.js';
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

// --- Ekrany Odczyty i Temperatury: ostatnie wpisy i temperatury dobowe ---
//
// Wyłącznie do odczytu — dwa niezależne zapytania do webhooka, każde może
// się nie udać osobno (np. jedno się wczyta, drugie pokaże błąd), więc
// obsługujemy je niezależnie zamiast jednym wspólnym try/catch.

// Opis przyrostu dobowego pod stanem licznika (BACKLOG pkt 42). Liczby daje
// webhook (`przyrost_doba`, `dni_od_poprzedniego`, `przyrost_pominiety`) —
// tutaj tylko tekst. Zwraca null, gdy nie ma czego pokazać (pierwszy odczyt
// medium, starszy webhook bez tych pól).
//
// Zasada projektu: porównujemy wartości na dobę, nie surowe różnice, więc przy
// dłuższym odstępie podajemy średnią z liczbą dób („śr. z 7 d”), a przy
// wyraźnie krótszym niż doba — z ilu godzin, bo taka liczba jest mniej pewna.
function opiszPrzyrost(odczyt, opisMedium) {
  if (odczyt.przyrost_pominiety === 'wymiana') return '— wymiana licznika';
  if (odczyt.przyrost_pominiety === 'spadek') return '— wskazanie spadło';
  if (typeof odczyt.przyrost_doba !== 'number') return null;

  const jednostka = opisMedium ? ` ${opisMedium.jednostka}/d` : '/d';
  let tekst = liczbaPL(Number(odczyt.przyrost_doba.toFixed(2))) + jednostka;

  const dni = odczyt.dni_od_poprzedniego;
  if (typeof dni === 'number') {
    // Odczyty „codzienne” wypadają co 0,9–1,1 doby — to nie jest odstęp krótki.
    if (dni < 0.75) tekst += ` · z ${Math.max(1, Math.round(dni * 24))} h`;
    else if (dni >= 1.5) tekst += ` · śr. z ${Math.round(dni)} d`;
  }
  return tekst;
}

function renderujOstatnieOdczyty(odczyty) {
  listaOstatnichOdczytow.innerHTML = '';

  if (!odczyty || odczyty.length === 0) {
    listaOstatnichOdczytow.appendChild(element('p', 'komunikat-pusto', 'Brak zapisanych odczytów.'));
    return;
  }

  // Tekst z arkusza wstawiamy przez textContent (element()), nie przez innerHTML.
  odczyty.forEach((o) => {
    const opisMedium = MEDIA[o.medium];
    const wiersz = element('div', 'wiersz-odczytu');
    wiersz.appendChild(element('span', 'wiersz-odczytu__data', formatujDataGodzinePodgladu(o.data_godzina)));
    wiersz.appendChild(element('span', 'wiersz-odczytu__medium', opisMedium ? opisMedium.nazwa : o.medium));
    const stan = element('span', 'wiersz-odczytu__stan',
      `${o.stan}${opisMedium ? ' ' + opisMedium.jednostka : ''}`);
    const przyrost = opiszPrzyrost(o, opisMedium);
    if (przyrost) stan.appendChild(element('span', 'wiersz-odczytu__przyrost', przyrost));
    wiersz.appendChild(stan);
    listaOstatnichOdczytow.appendChild(wiersz);
  });
}

// Kolumny (czujniki) budujemy z tego, co faktycznie przyszło w danych,
// zamiast zaszywać nazwy na sztywno — czujników przybywało w przeszłości
// (patrz historia w temp_doba) i mogą dojść kolejne.
function renderujTemperaturyDobowe(dni) {
  tabelaTemperatur.innerHTML = '';

  if (!dni || dni.length === 0) {
    const pusty = element('tr');
    pusty.appendChild(element('td', 'komunikat-pusto', 'Brak danych o temperaturach.'));
    tabelaTemperatur.appendChild(pusty);
    return;
  }

  const czujniki = Array.from(new Set(dni.flatMap((d) => Object.keys(d.czujniki || {})))).sort();

  const naglowek = element('tr');
  naglowek.appendChild(element('th', '', 'Data'));
  czujniki.forEach((cz) => naglowek.appendChild(element('th', '', cz)));
  // Dodatkowa, wąska kolumna na strzałkę rozwijania (od 0.21.0).
  const kolumnaStrzalki = element('th');
  kolumnaStrzalki.setAttribute('aria-hidden', 'true');
  naglowek.appendChild(kolumnaStrzalki);
  const thead = element('thead');
  thead.appendChild(naglowek);
  tabelaTemperatur.appendChild(thead);

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
    wiersz.appendChild(element('td', '', d.data));
    czujniki.forEach((cz) => {
      const wartosc = d.czujniki ? d.czujniki[cz] : undefined;
      wiersz.appendChild(element('td', '', typeof wartosc === 'number' ? wartosc.toFixed(1) + '°' : '—'));
    });
    const strzalka = element('td', 'wiersz-dnia__strzalka', '▾');
    strzalka.setAttribute('aria-hidden', 'true');
    wiersz.appendChild(strzalka);
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

