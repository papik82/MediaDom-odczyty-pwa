// Wykres doby (od 0.21.0) na ekranie Temperatury — rozwija się pod stukniętym
// dniem w tabeli. Czysty SVG, bez biblioteki.

import { pobierzTemperaturyGodzinowe } from '../webhook.js';
import { element, liczbaPL, svg } from '../wspolne.js';

// ---------------------------------------------------------------------------
// Wykres doby (od 0.21.0) — rozwija się pod stukniętym dniem w tabeli
// temperatur. Dane godzinowe (akcja temperatury_godzinowe, z temp_godz)
// pobieramy dopiero na żądanie i trzymamy w pamięci do zamknięcia Podglądu:
// historyczne godziny się nie zmieniają, więc ponowne rozwinięcie tego
// samego dnia jest natychmiastowe.
// ---------------------------------------------------------------------------

let rozwinietyDzien = null;             // "RRRR-MM-DD" albo null
const pamiecGodzin = new Map();         // data -> odpowiedź webhooka

// Kolory czujników — trzy wyraźnie różne barwy (pomarańcz, zieleń, niebieski).
// Do 0.22.0 parter i piętro miały dwa odcienie pomarańczu (#d85a30, #ba7517),
// a że ich linie leżą zwykle ok. 1°C od siebie, zlewały się w jedną.
// Nieznany (nowy) czujnik dostaje kolejny kolor z zapasu — nazw nie
// zaszywamy na sztywno.
const KOLORY_CZUJNIKOW = { parter: '#d85a30', pietro: '#2e9e5b', zewn: '#378add' };
const KOLORY_ZAPASOWE = ['#7f77dd', '#d4537e', '#ba7517', '#888780'];

export function kolorCzujnika(nazwa, indeks) {
  return KOLORY_CZUJNIKOW[nazwa] || KOLORY_ZAPASOWE[indeks % KOLORY_ZAPASOWE.length];
}

// `tabela` — tabela temperatur, `czyAktualny` — sprawdzenie licznika generacji
// ekranu Temperatury (spóźniona odpowiedź nie rysuje się w nowym otwarciu).
export function przelaczWykresDoby(tabela, wiersz, liczbaKolumn, czyAktualny) {
  const data = wiersz.dataset.data;
  const bylOtwarty = rozwinietyDzien === data;

  // Zamykamy to, co było otwarte (jeden dzień naraz).
  tabela.querySelectorAll('.wiersz-wykresu').forEach((w) => w.remove());
  tabela.querySelectorAll('.wiersz-dnia--rozwiniety').forEach((w) => {
    w.classList.remove('wiersz-dnia--rozwiniety');
    w.setAttribute('aria-expanded', 'false');
  });
  rozwinietyDzien = null;
  if (bylOtwarty) return;

  rozwinietyDzien = data;
  wiersz.classList.add('wiersz-dnia--rozwiniety');
  wiersz.setAttribute('aria-expanded', 'true');

  const wierszWykresu = document.createElement('tr');
  wierszWykresu.className = 'wiersz-wykresu';
  const komorka = document.createElement('td');
  komorka.colSpan = liczbaKolumn;
  wierszWykresu.appendChild(komorka);
  wiersz.after(wierszWykresu);

  if (pamiecGodzin.has(data)) {
    narysujWykresDoby(komorka, pamiecGodzin.get(data));
    return;
  }
  komorka.innerHTML = '<p class="wykres-doby__status">Wczytywanie godzin…</p>';
  wczytajGodzinyDoby(data, komorka, czyAktualny);
}

async function wczytajGodzinyDoby(data, komorka, czyAktualny) {
  try {
    const wynik = await pobierzTemperaturyGodzinowe(data);
    // Ekran zamknięty albo w międzyczasie rozwinięty inny dzień — nie rysujemy.
    if (!czyAktualny() || rozwinietyDzien !== data || !komorka.isConnected) return;
    if (!wynik.ok) {
      komorka.innerHTML = '';
      komorka.appendChild(element('p', 'wykres-doby__status wykres-doby__status--blad',
        `Nie udało się wczytać godzin (${wynik.blad || 'błąd webhooka'}).`));
      return;
    }
    pamiecGodzin.set(data, wynik);
    narysujWykresDoby(komorka, wynik);
  } catch (blad) {
    console.error('Nie udało się wczytać temperatur godzinowych:', blad);
    if (komorka.isConnected && rozwinietyDzien === data) {
      komorka.innerHTML = '<p class="wykres-doby__status wykres-doby__status--blad">Nie udało się wczytać godzin (brak połączenia).</p>';
    }
  }
}

// Czysty SVG, bez biblioteki. Oś X: godziny 0–24, średnia godzinowa
// rysowana w środku swojej godziny (h + 0,5). Oś Y: zakres dobrany do dnia,
// „ładne” linie pomocnicze. Brakująca godzina przerywa linię — nie łączymy
// punktów ponad luką (luka zostaje luką, zasada z CLAUDE.md).
function narysujWykresDoby(komorka, wynik) {
  komorka.innerHTML = '';
  const godziny = wynik.godziny || [];
  if (godziny.length === 0) {
    komorka.appendChild(element('p', 'wykres-doby__status', 'Brak danych godzinowych dla tej doby.'));
    return;
  }

  const czujniki = Array.from(new Set(godziny.flatMap((g) => Object.keys(g.czujniki || {})))).sort();
  const wartosci = godziny.flatMap((g) => Object.values(g.czujniki || {})).filter((v) => typeof v === 'number');
  const min = Math.min(...wartosci);
  const max = Math.max(...wartosci);

  // Krok siatki tak, żeby wyszły 3–5 linie; zakres zaokrąglony do kroku.
  const rozpietosc = Math.max(max - min, 2);
  const krok = [1, 2, 5, 10].find((k) => rozpietosc / k <= 4) || 10;
  const dol = Math.floor(min / krok) * krok;
  const gora = Math.max(Math.ceil(max / krok) * krok, dol + krok);

  const S = 320, W = 150;                  // rozmiar viewBox
  const L = 30, P = 8, G = 10, D = 128;    // marginesy obszaru wykresu
  const x = (h) => L + (h / 24) * (S - L - P);
  const y = (t) => D - ((t - dol) / (gora - dol)) * (D - G);

  const wykres = svg('svg', { viewBox: `0 0 ${S} ${W}`, class: 'wykres-doby', role: 'img',
    'aria-label': `Temperatury w ciągu doby ${wynik.data}` });

  for (let t = dol; t <= gora + 1e-9; t += krok) {
    wykres.appendChild(svg('line', { x1: L, x2: S - P, y1: y(t), y2: y(t), class: 'wykres-doby__siatka' }));
    wykres.appendChild(svg('text', { x: L - 4, y: y(t) + 3.5, 'text-anchor': 'end', class: 'wykres-doby__opis' }, `${t}°`));
  }
  for (const h of [0, 6, 12, 18, 24]) {
    wykres.appendChild(svg('text', { x: x(h), y: D + 13, 'text-anchor': 'middle', class: 'wykres-doby__opis' }, String(h)));
  }

  czujniki.forEach((cz, i) => {
    const kolor = kolorCzujnika(cz, i);
    // Dzielimy serię na ciągłe odcinki — przerwa, gdy brakuje godziny
    // albo czujnik w danej godzinie nie ma wartości.
    const odcinki = [];
    let biezacy = [];
    let poprzedniaGodzina = null;
    for (const g of godziny) {
      const t = g.czujniki ? g.czujniki[cz] : undefined;
      if (typeof t !== 'number' || (poprzedniaGodzina !== null && g.godzina !== poprzedniaGodzina + 1)) {
        if (biezacy.length) odcinki.push(biezacy);
        biezacy = [];
      }
      if (typeof t === 'number') biezacy.push([g.godzina, t]);
      poprzedniaGodzina = g.godzina;
    }
    if (biezacy.length) odcinki.push(biezacy);

    for (const odcinek of odcinki) {
      if (odcinek.length > 1) {
        wykres.appendChild(svg('polyline', {
          points: odcinek.map(([h, t]) => `${x(h + 0.5).toFixed(1)},${y(t).toFixed(1)}`).join(' '),
          fill: 'none', stroke: kolor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }));
      }
      // Kropka na każdym odczycie (średniej godzinowej) — od 1.0.1. Widać
      // wtedy, ile punktów stoi za linią i gdzie dokładnie zaczyna się luka.
      // Kropka bez linii to zarazem pojedyncza godzina otoczona lukami.
      for (const [h, t] of odcinek) {
        wykres.appendChild(svg('circle', { cx: x(h + 0.5).toFixed(1), cy: y(t).toFixed(1), r: 1.8, fill: kolor }));
      }
    }

    // Minimum i maksimum tylko dla temperatury zewnętrznej — wnętrze zmienia
    // się w ciągu doby o ułamki stopnia, podpisy by się nakładały.
    if (cz === 'zewn') {
      const punkty = odcinki.flat();
      const najnizszy = punkty.reduce((a, b) => (b[1] < a[1] ? b : a));
      const najwyzszy = punkty.reduce((a, b) => (b[1] > a[1] ? b : a));
      for (const [[h, t], nad] of [[najwyzszy, true], [najnizszy, false]]) {
        wykres.appendChild(svg('circle', { cx: x(h + 0.5), cy: y(t), r: 3, fill: kolor }));
        wykres.appendChild(svg('text', {
          x: x(h + 0.5), y: nad ? y(t) - 6 : y(t) + 13, 'text-anchor': 'middle', class: 'wykres-doby__wartosc',
        }, `${liczbaPL(t.toFixed(1))}°`));
      }
    }
  });

  komorka.appendChild(wykres);

  const legenda = element('div', 'wykres-doby__legenda');
  czujniki.forEach((cz, i) => {
    const pozycja = element('span', 'wykres-doby__pozycja', cz);
    pozycja.style.setProperty('--kolor', kolorCzujnika(cz, i));
    legenda.appendChild(pozycja);
  });
  if (godziny.length < 24) {
    legenda.appendChild(element('span', 'wykres-doby__uwaga', `${godziny.length} z 24 godzin`));
  }
  komorka.appendChild(legenda);
}

// Zwija wykres i czyści pamięć godzin — przy każdym otwarciu ekranu Temperatury
// (dzień importu mógł w międzyczasie dostać nowe godziny).
export function wyczyscWykresDoby() {
  rozwinietyDzien = null;
  pamiecGodzin.clear();
}

// Dzień rozwinięty przed ponownym narysowaniem tabeli (raz z bufora, raz ze
// świeżej odpowiedzi) — zwraca go i zeruje, żeby przelaczWykresDoby otworzył
// go od nowa, a nie zamknął.
export function zabierzRozwinietyDzien() {
  const dzien = rozwinietyDzien;
  rozwinietyDzien = null;
  return dzien;
}
