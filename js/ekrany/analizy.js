// Ekran „Analizy” (od 1.25.0) — tylko do odczytu. Liczy webhook (akcja `analiza`), aplikacja
// tylko wybiera i rysuje (BACKLOG pkt 45). Na dziś jeden widok: ΔT a zużycie gazu na dobę.
//
// Dwa wykresy z tych samych danych (wykres-dt-gaz.js), połączone wyborem:
//  - wykres punktowy: okres = punkt (tylko okresy „czyste”), kolor = tryb kotła, wielkość = doby;
//    dla jednego sezonu dochodzi prosta regresji i linia bazy CWU z webhooka;
//  - oś czasu sezonu: słupki zużycia i linia ΔT; okresy MIESZANE / NIEZNANY zostają na szaro,
//    bo luka w analizie ma być widoczna, nie wygładzona (zasada „luka zostaje luką”).
// Stuknięcie punktu albo słupka wybiera okres na obu wykresach i pokazuje jego szczegóły.
// Pod każdym wykresem podpis: na ilu okresach i z jakiego zakresu dat (zasada 4 z CLAUDE.md).
//
// Dane przez bufor „stare, potem świeże” (wczytajBlokPodgladu): wyniki zmieniają się rzadko,
// a webhook odpowiada ok. 2 s.

import { pobierzAnalizeDtGaz } from '../webhook.js';
import { element, wczytajBlokPodgladu } from '../wspolne.js';
import { pokazEkran, ekranStart, ukryjKomunikatStart } from '../nawigacja.js';
import {
  utworzWykresPunktowy, utworzWykresCzasu, probkaLegendy, OPIS_TRYBU, pl, dataPL,
} from './wykres-dt-gaz.js';

const ekranAnaliz = document.getElementById('ekran-analizy');
const przyciskAnalizy = document.getElementById('przycisk-analizy');
const przyciskZamknijAnalizy = document.getElementById('przycisk-zamknij-analizy');
const wyborSezonu = document.getElementById('analizy-sezon');
const statusAnaliz = document.getElementById('status-analiz');
const trescAnaliz = document.getElementById('analizy-tresc');
const legendaA = document.getElementById('analizy-a-legenda');
const legendaD = document.getElementById('analizy-d-legenda');
const podpisA = document.getElementById('analizy-a-podpis');
const podpisD = document.getElementById('analizy-d-podpis');
const szczegoly = document.getElementById('analizy-szczegoly');

const WSZYSTKIE = '';              // wartość opcji „Wszystkie sezony”
const KLUCZ_BUFORA = 'analiza_dt_gaz';

let generacja = 0;                 // chroni przed spóźnioną odpowiedzią z poprzedniego otwarcia
let dane = null;                   // ostatnia odpowiedź webhooka
let wybrany = null;                // wybrany okres (obiekt z dane.okresy)
let sezonWybrany = null;           // sezon z pola wyboru; null = jeszcze nie wybrano (pierwsze otwarcie)

const wykresA = utworzWykresPunktowy(document.getElementById('analizy-a'), wybierzOkres);
const wykresD = utworzWykresCzasu(document.getElementById('analizy-d'), wybierzOkres);

// --- Dane pomocnicze ---------------------------------------------------------------------

const czyste = (o) => o.status === 'TAK';
const nazwySezonow = () => [...new Set(dane.okresy.map((o) => o.sezon))].sort().reverse();   // najnowszy pierwszy
const okresyWSezonie = (sezon) => dane.okresy.filter((o) => sezon === WSZYSTKIE || o.sezon === sezon);

function zakresDat(okresy) {
  if (okresy.length === 0) return '';
  const od = okresy.reduce((a, o) => (o.od < a ? o.od : a), okresy[0].od);
  const doo = okresy.reduce((a, o) => (o.do > a ? o.do : a), okresy[0].do);
  return `${dataPL(od)} – ${dataPL(doo)}`;
}

// Liczba okresów po polsku: 1 okres, 2–4 okresy, reszta okresów.
function okresyTekst(n) {
  const koncowka = n === 1 ? 'okres' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'okresy' : 'okresów');
  return `${n} ${koncowka}`;
}

// --- Wybór okresu (wspólny dla obu wykresów) -----------------------------------------------

function wybierzOkres(okres) {
  wybrany = okres;
  wykresA.wybierz(okres);
  wykresD.wybierz(okres);
  pokazSzczegoly();
}

function pole(etykieta, wartosc, jednostka) {
  const w = element('div', 'analizy-pole');
  w.appendChild(element('div', 'faktura-etykieta', etykieta));
  const b = element('div', 'faktura-wartosc', wartosc);
  if (jednostka) b.appendChild(element('span', 'faktura-jednostka', ` ${jednostka}`));
  w.appendChild(b);
  return w;
}

function pokazSzczegoly() {
  szczegoly.replaceChildren();
  if (!wybrany) {
    szczegoly.appendChild(element('p', 'analizy-podpis', 'Stuknij punkt albo słupek, żeby zobaczyć szczegóły okresu.'));
    return;
  }
  const o = wybrany;
  const opis = element('div', 'faktura-wykres__opis');
  opis.appendChild(element('span', 'faktura-wykres__numer', `${dataPL(o.od)} – ${dataPL(o.do)}`));
  opis.appendChild(element('span', 'faktura-wykres__daty',
    `Sezon ${o.sezon} · ${OPIS_TRYBU[o.tryb] || (o.tryb || 'tryb nieznany')}`));
  szczegoly.appendChild(opis);
  szczegoly.appendChild(pole('Zużycie', pl(o.m3_doba, 2), 'm³/dobę'));
  szczegoly.appendChild(pole('ΔT', pl(o.dt), 'K'));
  szczegoly.appendChild(pole('Okres', pl(o.doby, o.doby % 1 ? 1 : 0), o.doby === 1 ? 'doba' : 'dób'));
  if (!czyste(o)) {
    szczegoly.appendChild(element('p', 'analizy-uwaga',
      o.status === 'MIESZANY'
        ? 'Okres MIESZANY: w jego trakcie zmieniono nastawy kotła, więc wypada z analiz.'
        : 'Okres NIEZNANY: brak zapisu nastaw kotła, więc wypada z analiz.'));
  }
}

// --- Rysowanie ------------------------------------------------------------------------------

function legenda(miejsce, pozycje) {
  miejsce.replaceChildren();
  pozycje.forEach(([probka, tekst]) => {
    const p = element('span', 'faktura-wykres__pozycja');
    p.appendChild(probka);
    p.appendChild(document.createTextNode(tekst));
    miejsce.appendChild(p);
  });
}

function rysujWykresPunktowy(sezon) {
  const wSezonie = okresyWSezonie(sezon);
  const punkty = wSezonie.filter(czyste);
  const pominiete = wSezonie.length - punkty.length;
  const info = sezon === WSZYSTKIE ? null : dane.sezony.find((s) => s.nazwa === sezon);

  // Prosta i baza tylko dla jednego sezonu: regresja z różnych sezonów mieszałaby
  // różne nastawy i różną charakterystykę budynku (decyzje.md M5).
  let prosta = null;
  if (info && typeof info.nachylenie === 'number') {
    const x = punkty.filter((o) => o.tryb === 'cwu_co' && o.dt > 0).map((o) => o.dt);
    prosta = { nachylenie: info.nachylenie, odcieta: info.odcieta, x0: Math.min(...x), x1: Math.max(...x) };
  }
  const baza = info && typeof info.baza_cwu === 'number' ? info.baza_cwu : null;
  wykresA.ustaw({ okresy: punkty, prosta, baza });

  const tryby = [...new Set(punkty.map((o) => o.tryb))].filter((t) => OPIS_TRYBU[t]);
  const pozycje = tryby.map((t) => [probkaLegendy('kolo', `wa-pkt wa-pkt--${t}`), OPIS_TRYBU[t]]);
  if (prosta) pozycje.push([probkaLegendy('kreska', 'wa-prosta'), 'prosta regresji (woda i ogrzewanie)']);
  if (baza !== null) pozycje.push([probkaLegendy('kreska', 'wa-baza'), 'baza CWU']);
  pozycje.push([document.createTextNode('wielkość punktu = liczba dób'), '']);
  legenda(legendaA, pozycje);

  const czesci = [`${okresyTekst(punkty.length)}, ${zakresDat(punkty) || 'brak danych'}.`];
  if (pominiete > 0) czesci.push(`Pominięto ${okresyTekst(pominiete)} MIESZANE lub NIEZNANE (zmiana albo brak nastaw kotła).`);
  if (info && typeof info.nachylenie === 'number') {
    czesci.push(`Nachylenie: ${pl(info.nachylenie, 2)} m³/dobę na K, R² ${pl(info.r2, 2)}, ${okresyTekst(info.n)} w trybie woda i ogrzewanie.`);
  } else if (info) {
    czesci.push('Za mało okresów w trybie woda i ogrzewanie, żeby poprowadzić prostą.');
  } else {
    czesci.push('Prosta regresji pojawia się po wyborze jednego sezonu.');
  }
  // Najstarsze okresy (sprzed początku pomiarów temperatur) nie mają ΔT i nie ma ich na wykresach.
  if (dane.pominiete.bez_dt > 0) czesci.push(`${okresyTekst(dane.pominiete.bez_dt)} z najstarszych sezonów bez ΔT (brak temperatur) nie ma na wykresach.`);
  podpisA.textContent = czesci.join(' ');
}

function rysujWykresCzasu(sezon) {
  // Oś czasu jednego sezonu; przy „Wszystkie sezony” pokazujemy najnowszy.
  const nazwa = sezon === WSZYSTKIE ? nazwySezonow()[0] : sezon;
  const okresy = okresyWSezonie(nazwa).sort((a, b) => (a.od < b.od ? -1 : 1));
  if (okresy.length === 0) { wykresD.ustaw({ okresy: [], od: null, do: null }); podpisD.textContent = ''; return; }

  // Oś od początku miesiąca pierwszego okresu do końca miesiąca ostatniego.
  const pierwszy = okresy[0].od;
  const ostatni = okresy[okresy.length - 1].do;
  const [ro, mo] = pierwszy.split('-').map(Number);
  const [rk, mk] = ostatni.split('-').map(Number);
  const nastepny = new Date(Date.UTC(rk, mk, 1));          // mk jest 1-indeksowany, więc to początek miesiąca po ostatnim
  const iso = (d) => d.toISOString().slice(0, 10);
  wykresD.ustaw({ okresy, od: iso(new Date(Date.UTC(ro, mo - 1, 1))), do: iso(nastepny) });

  const tryby = [...new Set(okresy.filter(czyste).map((o) => o.tryb))].filter((t) => OPIS_TRYBU[t]);
  const pozycje = tryby.map((t) => [probkaLegendy('slupek', `wa-slupek wa-slupek--${t}`), OPIS_TRYBU[t]]);
  if (okresy.some((o) => !czyste(o))) pozycje.push([probkaLegendy('slupek', 'wa-slupek wa-slupek--pominiety'), 'MIESZANY / NIEZNANY']);
  pozycje.push([probkaLegendy('kreska', 'wa-dt-linia'), 'ΔT']);
  legenda(legendaD, pozycje);

  const pominiete = okresy.filter((o) => !czyste(o)).length;
  podpisD.textContent = `Sezon ${nazwa}: ${okresyTekst(okresy.length)}, ${zakresDat(okresy)}.`
    + (pominiete > 0 ? ` Na szaro ${okresyTekst(pominiete)} wyłączone z analiz.` : '')
    + (sezon === WSZYSTKIE ? ' Przy wszystkich sezonach oś czasu pokazuje najnowszy.' : '');
}

function rysuj() {
  const sezon = wyborSezonu.value;
  rysujWykresPunktowy(sezon);
  rysujWykresCzasu(sezon);
  // Wybrany okres zostaje wybrany tylko wtedy, gdy nadal jest na którymś wykresie.
  wybierzOkres(wybrany && okresyWSezonie(sezon).includes(wybrany) ? wybrany : null);
}

// Odpowiedź webhooka → lista sezonów w polu wyboru (najnowszy pierwszy, domyślnie wybrany)
// i pierwsze rysowanie. Ponowne wczytanie (świeże dane po buforze) zachowuje wybrany sezon.
function renderujAnalizy(wynik) {
  dane = wynik;
  const nazwy = nazwySezonow();
  wyborSezonu.replaceChildren();
  nazwy.forEach((n) => wyborSezonu.appendChild(new Option(`Sezon ${n}`, n)));
  wyborSezonu.appendChild(new Option('Wszystkie sezony', WSZYSTKIE));
  // Pierwsze rysowanie: najnowszy sezon. Ponowne (świeże dane po buforze): to, co wybrano.
  const zachowany = sezonWybrany !== null && (sezonWybrany === WSZYSTKIE || nazwy.includes(sezonWybrany));
  sezonWybrany = zachowany ? sezonWybrany : (nazwy[0] ?? WSZYSTKIE);
  wyborSezonu.value = sezonWybrany;
  trescAnaliz.classList.remove('ukryty');   // najpierw widoczne — ukryty kontener ma szerokość 0
  wybrany = null;
  rysuj();
}

wyborSezonu.addEventListener('change', () => {
  sezonWybrany = wyborSezonu.value;
  wybrany = null;
  rysuj();
});

// --- Otwieranie i zamykanie ---------------------------------------------------------------

function otworzAnalizy() {
  ukryjKomunikatStart();
  const moja = ++generacja;
  pokazEkran(ekranAnaliz);
  wczytajBlokPodgladu(() => moja === generacja, {
    klucz: KLUCZ_BUFORA,
    status: statusAnaliz,
    pobierz: pobierzAnalizeDtGaz,
    renderuj: renderujAnalizy,
  });
}

przyciskAnalizy.addEventListener('click', otworzAnalizy);
przyciskZamknijAnalizy.addEventListener('click', () => {
  generacja++;
  pokazEkran(ekranStart);
});
