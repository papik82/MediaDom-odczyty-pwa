// Wykres historii faktur za gaz (od 1.24.0) nad listą faktur na ekranie Faktury.
// Czysty SVG, bez biblioteki (jak wykres doby w wykres-doby.js).
//
// Jeden panel z dwiema osiami pionowymi (wybór właściciela, 2026-11-02): kolumny to kwota brutto
// każdej faktury (lewa oś, zł; kolumna jest tak szeroka jak okres rozliczeniowy, więc widać
// też, że okresy nie są równe), linie schodkowe to koszt za m³ (prawa oś, zł/m³) — bez opłat
// stałych (ciągła) i ze stałymi (przerywana); cena obowiązuje przez cały okres. Obie osie mają
// tyle samo przedziałów, żeby kreski się pokrywały.
// Wartości kosztu za m³ są liczone na CAŁĄ fakturę (pole `analiza` z webhooka, jak w panelu
// „Analiza faktury”), nie na wiersz arkusza: faktura rozbita na dwa okresy ma w arkuszu
// dwa wiersze, a krótki wiersz zawyża koszt ze stałymi (opłaty stałe na kilka m³).
//
// Stuknięcie / najechanie wybiera fakturę (szczegóły pod wykresem), strzałki z klawiatury
// też. Kolory i obramowania biorą się z klas `wf-…` w styl.css, więc zmieniają się z porą dnia.

import { element, svg } from '../wspolne.js';

const MS_DZIEN = 24 * 60 * 60 * 1000;
const dataMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

// Liczba po polsku: twarda spacja jako separator tysięcy, przecinek dziesiętny.
function pl(x, miejsca) {
  const [calosc, ulamek = ''] = x.toFixed(miejsca).split('.');
  return calosc.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (ulamek ? `,${ulamek}` : '');
}

function dataPL(iso) {
  const [r, m, d] = iso.split('-');
  return `${d}.${m}.${r}`;
}

// Dwie osie pionowe na jednym panelu: kwoty (zł) po lewej, koszt za m³ po prawej. Obie mają
// tyle samo przedziałów, żeby kreski obu osi leżały na tych samych liniach siatki. Liczbę
// przedziałów (2–5) wybieramy tak, żeby żadna z osi nie miała dużo pustego miejsca nad danymi.
function osDlaPrzedzialow(maks, ile) {
  const surowy = Math.max(maks, 1e-9) / ile;
  const rzad = 10 ** Math.floor(Math.log10(surowy));
  const krok = [1, 1.5, 2, 2.5, 3, 4, 5, 10].map((m) => m * rzad).find((k) => k >= surowy * 0.999999);
  const kreski = Array.from({ length: ile + 1 }, (_, i) => Math.round(i * krok * 1e6) / 1e6);
  return { krok, max: krok * ile, kreski };
}

function osy(maksKwot, maksCeny) {
  let najlepsze = null;
  for (let ile = 2; ile <= 5; ile++) {
    const os1 = osDlaPrzedzialow(maksKwot, ile);
    const os2 = osDlaPrzedzialow(maksCeny, ile);
    const zapas = Math.max(os1.max / maksKwot, os2.max / maksCeny);
    if (!najlepsze || zapas < najlepsze.zapas - 1e-9) najlepsze = { os1, os2, zapas };
  }
  return najlepsze;
}

// Faktury z webhooka (najnowsza pierwsza) → punkty wykresu, najstarsza pierwsza.
// Faktura bez dat albo kwoty nie ma gdzie stanąć na osi czasu, więc ją pomijamy.
function punkty(faktury) {
  return faktury
    .filter((f) => f.okres_od && f.okres_do && typeof f.brutto === 'number')
    .map((f) => {
      const a = f.analiza || {};
      return {
        nr: f.nr_faktury,
        od: f.okres_od,
        do: f.okres_do,
        brutto: f.brutto,
        bezStalych: typeof a.zl_za_m3_bez_stalych === 'number' ? a.zl_za_m3_bez_stalych : null,
        zeStalymi: typeof a.zl_za_m3_ze_stalymi === 'number' ? a.zl_za_m3_ze_stalymi : null,
      };
    })
    .sort((a, b) => (a.od < b.od ? -1 : 1));
}

// `kontener` — pusty element, w którym wykres buduje całą swoją zawartość.
// `naWybor(nr)` — wywoływane kliknięciem (stuknięciem) w słupek faktury albo Enterem na wykresie.
export function utworzWykresFaktur(kontener, naWybor) {
  let dane = [];
  let wybrany = -1;
  let szerokosc = 0;
  let geometria = null;
  let uchwyty = null;                // elementy SVG, które zmieniają się przy zmianie wyboru

  const naglowek = element('div', 'faktura-wykres__naglowek');
  naglowek.appendChild(element('span', 'faktura-sekcja', 'Historia faktur · gaz'));
  const zakres = element('span', 'faktura-wykres__zakres');
  naglowek.appendChild(zakres);

  const pole = element('div', 'faktura-wykres__plot');

  const legenda = element('div', 'faktura-wykres__legenda');
  const pozycjaLegendy = (znak, tekst) => {
    const p = element('span', 'faktura-wykres__pozycja');
    p.appendChild(znak);
    p.appendChild(document.createTextNode(tekst));
    return p;
  };
  const kwadrat = element('span', 'faktura-wykres__kwadrat');
  const kreska = (przerywana) => {
    const s = svg('svg', { width: 22, height: 8, 'aria-hidden': 'true' });
    s.appendChild(svg('line', { x1: 0, y1: 4, x2: 22, y2: 4,
      class: `wf-linia${przerywana ? ' wf-linia--ze-stalymi' : ''}` }));
    return s;
  };
  legenda.appendChild(pozycjaLegendy(kwadrat, 'Kwota brutto faktury'));
  legenda.appendChild(pozycjaLegendy(kreska(false), 'Zł za m³ bez stałych'));
  legenda.appendChild(pozycjaLegendy(kreska(true), 'Zł za m³ ze stałymi'));

  const szczegoly = element('div', 'faktura-wykres__szczegoly');
  szczegoly.setAttribute('aria-live', 'polite');

  kontener.append(naglowek, pole, legenda, szczegoly);

  function wartosc(etykieta, tekst, jednostka) {
    const w = element('div', 'faktura-wykres__wartosc');
    w.appendChild(element('div', 'faktura-etykieta', etykieta));
    const b = element('div', 'faktura-wartosc', tekst);
    if (jednostka && tekst !== '—') b.appendChild(element('span', 'faktura-jednostka', ` ${jednostka}`));
    w.appendChild(b);
    return w;
  }

  function pokazSzczegoly() {
    szczegoly.innerHTML = '';
    const p = dane[wybrany];
    if (!p) return;
    const opis = element('div', 'faktura-wykres__opis');
    opis.appendChild(element('span', 'faktura-wykres__numer', p.nr));
    opis.appendChild(element('span', 'faktura-wykres__daty', `${dataPL(p.od)} – ${dataPL(p.do)}`));
    szczegoly.appendChild(opis);
    szczegoly.appendChild(wartosc('Brutto', pl(p.brutto, 2), 'zł'));
    szczegoly.appendChild(wartosc('Bez stałych', p.bezStalych === null ? '—' : pl(p.bezStalych, 2), 'zł/m³'));
    szczegoly.appendChild(wartosc('Ze stałymi', p.zeStalymi === null ? '—' : pl(p.zeStalymi, 2), 'zł/m³'));
  }

  function rysuj() {
    const W = Math.floor(pole.clientWidth);
    if (dane.length === 0 || W < 200) return;       // ukryty kontener ma szerokość 0
    szerokosc = W;
    const szeroki = W >= 560;
    const L = szeroki ? 46 : 40;                    // miejsce na opisy osi kwot (lewa)
    const R = szeroki ? 44 : 38;                    // i osi kosztu za m³ (prawa)
    const h = W >= 900 ? 175 : (szeroki ? 148 : 120);
    const P = W - L - R;
    const g = { y: 20, h };
    const H = g.y + g.h + 24;

    const T0 = Math.min(...dane.map((p) => dataMs(p.od)));
    const T1 = Math.max(...dane.map((p) => dataMs(p.do))) + MS_DZIEN;
    const X = (ms) => L + ((ms - T0) / (T1 - T0)) * P;

    const ceny = dane.flatMap((p) => [p.bezStalych, p.zeStalymi]).filter((c) => c !== null);
    const { os1, os2 } = osy(Math.max(...dane.map((p) => p.brutto)), ceny.length ? Math.max(...ceny) : 1);
    const Y = (os, v) => g.y + g.h - (v / os.max) * g.h;

    const s = svg('svg', {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H, tabindex: 0, role: 'img',
      'aria-label': `Wykres historii faktur: ${dane.length} faktur od ${dane[0].od.slice(0, 7)} do `
        + `${dane[dane.length - 1].do.slice(0, 7)}. Strzałki w lewo i w prawo wybierają fakturę, Enter przechodzi do niej na liście.`,
    });

    // Siatka pozioma z osi kwot; oś kosztu za m³ ma tyle samo przedziałów, więc jej kreski
    // leżą na tych samych liniach.
    os1.kreski.forEach((v, i) => {
      const y = Y(os1, v);
      s.appendChild(svg('line', { x1: L, x2: L + P, y1: y, y2: y, class: 'wf-siatka' }));
      s.appendChild(svg('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'wf-tekst' }, pl(v, 0)));
      s.appendChild(svg('text', { x: L + P + 6, y: y + 4, class: 'wf-tekst' }, pl(os2.kreski[i], os2.krok % 1 ? 1 : 0)));
    });
    s.appendChild(svg('text', { x: L - 6, y: 11, 'text-anchor': 'end', class: 'wf-tekst' }, 'zł'));
    s.appendChild(svg('text', { x: L + P + 6, y: 11, class: 'wf-tekst' }, 'zł/m³'));

    // Znaczniki lat pod panelem (1 stycznia).
    const rokOd = new Date(T0).getUTCFullYear();
    const rokDo = new Date(T1).getUTCFullYear();
    for (let rok = rokOd + 1; rok <= rokDo; rok++) {
      const ms = Date.UTC(rok, 0, 1);
      if (ms <= T0 || ms >= T1) continue;
      const x = X(ms);
      s.appendChild(svg('line', { x1: x, x2: x, y1: g.y + g.h, y2: g.y + g.h + 4, class: 'wf-os' }));
      s.appendChild(svg('text', { x, y: g.y + g.h + 17, 'text-anchor': 'middle', class: 'wf-tekst' }, String(rok)));
    }

    // Kolumny kwot: od początku do końca okresu (włącznie z ostatnim dniem).
    const kolumny = dane.map((p) => {
      const x0 = X(dataMs(p.od));
      const x1 = X(dataMs(p.do) + MS_DZIEN);
      const y = Y(os1, p.brutto);
      const kolumna = svg('rect', {
        x: x0 + 0.6, y, width: Math.max(x1 - x0 - 1.2, 1.5), height: g.y + g.h - y, rx: 2, class: 'wf-kolumna',
      });
      s.appendChild(kolumna);
      return kolumna;
    });

    // Linie schodkowe kosztu za m³ (prawa oś); brak wartości przerywa linię. Pod każdą
    // linią jasna obwódka, żeby nie ginęła na kolumnach.
    const sciezka = (klucz) => {
      let d = '';
      let ciagla = false;
      dane.forEach((p) => {
        const v = p[klucz];
        if (v === null) { ciagla = false; return; }
        const y = Y(os2, v);
        d += `${ciagla ? 'L' : 'M'}${X(dataMs(p.od))} ${y}L${X(dataMs(p.do) + MS_DZIEN)} ${y}`;
        ciagla = true;
      });
      return d;
    };
    [['zeStalymi', ' wf-linia--ze-stalymi'], ['bezStalych', '']].forEach(([klucz, klasa]) => {
      const d = sciezka(klucz);
      s.appendChild(svg('path', { d, class: 'wf-linia-tlo' }));
      s.appendChild(svg('path', { d, class: `wf-linia${klasa}` }));
    });

    // Wybrana faktura: celownik i znaczniki na liniach. Przy zmianie wyboru przestawiamy je
    // w miejscu (aktualizujWybor), zamiast rysować wszystko od nowa — podmiana SVG między
    // naciśnięciem a puszczeniem przycisku gubiłaby kliknięcie.
    const celownik = svg('line', { y1: g.y, y2: g.y + g.h, class: 'wf-celownik' });
    const znaczniki = { bezStalych: svg('circle', { r: 4, class: 'wf-znacznik' }), zeStalymi: svg('circle', { r: 4, class: 'wf-znacznik' }) };
    s.append(celownik, znaczniki.bezStalych, znaczniki.zeStalymi);
    uchwyty = { kolumny, celownik, znaczniki, srodekX: (p) => (X(dataMs(p.od)) + X(dataMs(p.do) + MS_DZIEN)) / 2, Y: (v) => Y(os2, v) };

    geometria = { L, P, T0, T1, W };
    const mialFokus = pole.contains(document.activeElement);   // rysowanie podmienia cały SVG
    pole.innerHTML = '';
    pole.appendChild(s);
    if (mialFokus) s.focus({ preventScroll: true });
    s.addEventListener('pointerdown', wybierzWPunkcie);
    s.addEventListener('pointermove', wybierzWPunkcie);
    s.addEventListener('keydown', obsluzKlawisz);
    aktualizujWybor();
  }

  // Zaznaczenie wybranej faktury na już narysowanym wykresie.
  function aktualizujWybor() {
    if (!uchwyty) return;
    const p = dane[wybrany];
    uchwyty.kolumny.forEach((k, i) => k.classList.toggle('wf-kolumna--wybrana', i === wybrany));
    if (!p) return;
    const x = uchwyty.srodekX(p);
    uchwyty.celownik.setAttribute('x1', x);
    uchwyty.celownik.setAttribute('x2', x);
    Object.entries(uchwyty.znaczniki).forEach(([klucz, znacznik]) => {
      znacznik.setAttribute('visibility', p[klucz] === null ? 'hidden' : 'visible');
      if (p[klucz] !== null) {
        znacznik.setAttribute('cx', x);
        znacznik.setAttribute('cy', uchwyty.Y(p[klucz]));
      }
    });
  }

  // Faktura pod wskaźnikiem: ta, której okres obejmuje wskazany dzień, a przy luce między
  // okresami — najbliższa.
  // `wewnatrz` — wskaźnik leży w okresie tej faktury (nie w luce między okresami ani poza osią).
  function podWskaznikiem(zdarzenie) {
    const s = pole.querySelector('svg');
    if (!geometria || !s || dane.length === 0) return null;
    const r = s.getBoundingClientRect();
    const x = (zdarzenie.clientX - r.left) * (geometria.W / r.width);
    const ms = geometria.T0 + ((x - geometria.L) / geometria.P) * (geometria.T1 - geometria.T0);
    let najblizsza = 0;
    let odleglosc = Infinity;
    dane.forEach((p, i) => {
      const od = dataMs(p.od);
      const doo = dataMs(p.do) + MS_DZIEN;
      const d = ms < od ? od - ms : (ms > doo ? ms - doo : 0);
      if (d < odleglosc) { odleglosc = d; najblizsza = i; }
    });
    return { indeks: najblizsza, wewnatrz: odleglosc === 0 };
  }

  function wybierzWPunkcie(zdarzenie) {
    const trafiona = podWskaznikiem(zdarzenie);
    if (trafiona) ustawWybor(trafiona.indeks);
  }

  // Kliknięcie (stuknięcie) w słupek — przejście do faktury na liście.
  pole.addEventListener('click', (zdarzenie) => {
    const trafiona = podWskaznikiem(zdarzenie);
    if (trafiona && trafiona.wewnatrz) naWybor(dane[trafiona.indeks].nr);
  });

  function obsluzKlawisz(zdarzenie) {
    const ruch = { ArrowLeft: -1, ArrowRight: 1 }[zdarzenie.key];
    if (zdarzenie.key === 'Home') ustawWybor(0);
    else if (zdarzenie.key === 'End') ustawWybor(dane.length - 1);
    else if (ruch) ustawWybor(Math.min(Math.max(wybrany + ruch, 0), dane.length - 1));
    else if ((zdarzenie.key === 'Enter' || zdarzenie.key === ' ') && dane[wybrany]) naWybor(dane[wybrany].nr);
    else return;
    zdarzenie.preventDefault();
  }

  function ustawWybor(indeks) {
    if (indeks === wybrany) return;
    wybrany = indeks;
    aktualizujWybor();
    pokazSzczegoly();
  }

  new ResizeObserver(() => {
    if (Math.floor(pole.clientWidth) !== szerokosc) rysuj();
  }).observe(pole);

  return {
    // `faktury` — lista z akcji ostatnie_faktury (najnowsza pierwsza).
    ustaw(faktury) {
      const poprzedni = dane[wybrany] && dane[wybrany].nr;
      dane = punkty(faktury);
      kontener.classList.toggle('ukryty', dane.length === 0);
      if (dane.length === 0) return;
      const indeks = dane.findIndex((p) => p.nr === poprzedni);
      wybrany = indeks >= 0 ? indeks : dane.length - 1;
      zakres.textContent = `${dane.length} faktur · ${dane[0].od.slice(0, 7)} → ${dane[dane.length - 1].do.slice(0, 7)}`;
      szerokosc = 0;                                 // wymusza rysowanie nawet przy tej samej szerokości
      rysuj();
      pokazSzczegoly();
    },
  };
}
