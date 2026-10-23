// Lista faktur za gaz na karcie „Faktura” (od 1.22.0): każda faktura w osobnej ramce.
//
// Dane z akcji `ostatnie_faktury` (tylko do odczytu, przez bufor „stare, potem świeże”).
// Zwinięta faktura to pasek (numer, daty, kwota brutto); rozwinięta — ramka w zieleni akcji:
//   - nagłówek: numer, daty, plakietki, zielony blok z sumą brutto faktury,
//   - „Dane z faktury”: każdy okres w osobnym bloku (belka z numerem okresu, oś z datami
//     i odczytami, współczynnik i kwoty brutto — VAT małą linijką),
//   - „Analiza faktury”: wskaźniki policzone dla CAŁEJ faktury przez webhook (sumy po okresach).
// Układ jest jeden, a CSS przełącza go między telefonem (kolumna, analiza pod okresami)
// i komputerem (okresy po lewej, analiza po prawej). Kwoty brutto liczy webhook
// (netto × (1 + VAT)) — w arkuszu zostają netto.

import { pobierzOstatnieFaktury } from '../webhook.js';
import { element, wczytajBlokPodgladu } from '../wspolne.js';

const statusListyFaktur = document.getElementById('status-listy-faktur');
const listaFaktur = document.getElementById('lista-faktur');

const ILE_FAKTUR = 100;            // wszystkie (w arkuszu ok. 40); webhook przyjmuje do 100
const POCZATKOWO_NA_TELEFONIE = 4; // ile pasków na start; reszta po „Pokaż starsze faktury”
const KROK_STARSZYCH = 10;

let generacja = 0;
let faktury = [];
let otwarte = new Set();           // numery rozwiniętych faktur (pamiętane do zamknięcia ekranu)
let widoczne = 0;

// Komputer: wszystkie faktury od razu. Telefon: kilka ostatnich i przycisk „starsze”.
const szerokiEkran = () => window.matchMedia('(min-width: 900px)').matches;

// --- Formatowanie ----------------------------------------------------------

// "2026-07-23" → "23.07.2026"
function dataPL(iso) {
  if (!iso) return '—';
  const [r, m, d] = iso.split('-');
  return `${d}.${m}.${r}`;
}

// „06.01 – 24.02.2026” (ten sam rok) albo z obydwoma rokami.
function zakres(od, doo) {
  if (!od || !doo) return dataPL(od || doo);
  return od.slice(0, 4) === doo.slice(0, 4)
    ? `${dataPL(od).slice(0, 5)} – ${dataPL(doo)}` : `${dataPL(od)} – ${dataPL(doo)}`;
}

// Liczby po polsku: twarda spacja jako separator tysięcy i przecinek dziesiętny
// („1 134”, „468,88”). Własny zapis zamiast toLocaleString('pl-PL'), bo ten nie
// grupuje liczb czterocyfrowych. Zbędne zera po przecinku obcinamy do `min` miejsc.
function liczba(x, maks = 0, min = 0) {
  if (typeof x !== 'number') return '—';
  const [calosc, ulamek = ''] = x.toFixed(maks).split('.');
  const znak = calosc.startsWith('-') ? '−' : '';
  const grupy = calosc.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const ucieta = ulamek.replace(/0+$/, '').padEnd(min, '0');
  return `${znak}${grupy}${ucieta ? `,${ucieta}` : ''}`;
}

const kwota = (x) => (typeof x === 'number' ? `${liczba(x, 2, 2)} zł` : '—');
const vatTekst = (v) => (typeof v === 'number' ? `VAT ${Math.round(v * 100)} %` : '');
const okresyTekst = (n) => `${n} ${n === 1 ? 'okres' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'okresy' : 'okresów')}`;

// --- Pojedyncze elementy ---------------------------------------------------

// Pole „etykieta, wartość z jednostką, mała linijka (VAT)”.
function pole(etykieta, wartosc, jednostka, dopisek, klasa) {
  const w = element('div', klasa || '');
  w.appendChild(element('div', 'faktura-etykieta', etykieta));
  const wartoscEl = element('div', 'faktura-wartosc', wartosc);
  if (jednostka && wartosc !== '—') wartoscEl.appendChild(element('span', 'faktura-jednostka', ` ${jednostka}`));
  w.appendChild(wartoscEl);
  if (dopisek) w.appendChild(element('div', 'faktura-vat', dopisek));
  return w;
}

function koniecOsi(data, odczyt, prawy) {
  const k = element('div', `faktura-os__koniec${prawy ? ' faktura-os__koniec--prawy' : ''}`);
  k.appendChild(element('span', 'faktura-os__data', dataPL(data)));
  k.appendChild(element('span', 'faktura-os__odczyt', typeof odczyt === 'number' ? `${liczba(odczyt, 3)} m³` : '—'));
  return k;
}

// Oś okresu: data i odczyt na początku, data i odczyt na końcu, pośrodku przyrost i dni.
function osOkresu(o) {
  const os = element('div', 'faktura-os');
  os.appendChild(koniecOsi(o.okres_od, o.odczyt_od, false));
  const linia = element('div', 'faktura-os__linia');
  linia.appendChild(element('u'));
  linia.appendChild(element('i'));
  const przyrost = element('b', '', typeof o.m3 === 'number' ? `+${liczba(o.m3, 3)} m³` : '—');
  if (typeof o.dni === 'number') przyrost.appendChild(element('small', '', `${o.dni} dni`));
  linia.appendChild(przyrost);
  linia.appendChild(element('i'));
  linia.appendChild(element('u'));
  os.appendChild(linia);
  os.appendChild(koniecOsi(o.okres_do, o.odczyt_do, true));
  return os;
}

function blokOkresu(o, numer, ile) {
  const blok = element('div', 'faktura-okres');
  blok.appendChild(element('div', 'faktura-okres__belka', `Okres ${numer} z ${ile}`));
  const tresc = element('div', 'faktura-okres__tresc');
  tresc.appendChild(osOkresu(o));
  const pola = element('div', 'faktura-pola');
  pola.appendChild(pole('Wsp. konwersji', typeof o.wsp_konwersji === 'number' ? liczba(o.wsp_konwersji, 3, 3) : '—', 'kWh/m³', '', 'faktura-wsp'));
  pola.appendChild(pole('Paliwo gaz.', typeof o.paliwo_brutto === 'number' ? liczba(o.paliwo_brutto, 5, 5) : '—', 'zł/kWh', vatTekst(o.vat_paliwo)));
  pola.appendChild(pole('Dystr. zm.', typeof o.dystr_brutto === 'number' ? liczba(o.dystr_brutto, 5, 5) : '—', 'zł/kWh', vatTekst(o.vat_dystr)));
  pola.appendChild(pole('Abonament', typeof o.abonament_brutto === 'number' ? liczba(o.abonament_brutto, 2, 2) : '—', 'zł', vatTekst(o.vat_stale)));
  pola.appendChild(pole('Dystr. stała', typeof o.dystr_stala_brutto === 'number' ? liczba(o.dystr_stala_brutto, 2, 2) : '—', 'zł', vatTekst(o.vat_stale)));
  tresc.appendChild(pola);
  blok.appendChild(tresc);
  return blok;
}

function panelAnalizy(f) {
  const a = f.analiza || {};
  const strefa = element('div', 'faktura-analiza');
  strefa.appendChild(element('div', 'faktura-sekcja', 'Analiza faktury'));
  const panel = element('div', 'faktura-analiza__panel');

  const duze = element('div', 'faktura-analiza__duze');
  [['Dni', typeof f.dni === 'number' ? String(f.dni) : '—', ''],
    ['Zużycie', liczba(f.m3, 3), 'm³'],
    ['Energia', liczba(f.kwh), 'kWh']].forEach(([etykieta, wartosc, jednostka]) => {
    const w = element('div', 'faktura-wskaznik');
    w.appendChild(element('span', 'faktura-etykieta', etykieta));
    const b = element('b', '', wartosc);
    if (jednostka && wartosc !== '—') b.appendChild(element('span', 'faktura-jednostka', ` ${jednostka}`));
    w.appendChild(b);
    duze.appendChild(w);
  });
  panel.appendChild(duze);
  panel.appendChild(element('div', 'faktura-analiza__linia'));

  const lista = element('div', 'faktura-analiza__lista');
  [['Zużycie na dobę', liczba(a.m3_na_dobe, 3, 3), 'm³/d'],
    ['Koszt na dobę', liczba(a.zl_na_dobe, 2, 2), 'zł/d'],
    ['Koszt za m³', liczba(a.zl_za_m3, 2, 2), 'zł/m³'],
    ['Koszt za kWh', liczba(a.zl_za_kwh, 3, 3), 'zł/kWh'],
    ['Udział opłat stałych', typeof a.udzial_stalych === 'number' ? liczba(a.udzial_stalych * 100, 1, 1) : '—', '%']]
    .forEach(([etykieta, wartosc, jednostka]) => {
      lista.appendChild(element('span', 'faktura-analiza__nazwa', etykieta));
      const w = element('span', 'faktura-wartosc', wartosc);
      if (wartosc !== '—') w.appendChild(element('span', 'faktura-jednostka', ` ${jednostka}`));
      lista.appendChild(w);
    });
  panel.appendChild(lista);
  strefa.appendChild(panel);
  return strefa;
}

// Plakietka kontroli: suma okresów (wyliczona w arkuszu) kontra kwota z faktury.
function plakietkaKontroli(f) {
  const r = f.kontrola && f.kontrola.roznica;
  if (typeof r !== 'number') return null;
  if (Math.abs(r) < 0.005) {
    const p = element('span', 'faktura-plakietka faktura-plakietka--ok', '✓ zgodna z sumą okresów');
    p.title = 'suma okresów wyliczona w arkuszu = kwota brutto z faktury (różnica 0,00 zł)';
    return p;
  }
  return element('span', 'faktura-plakietka faktura-plakietka--uwaga', `⚠ różnica ${kwota(r)} względem sumy okresów`);
}

function ramkaFaktury(f, zwin) {
  const ramka = element('section', 'faktura-ramka');

  const glowa = element('button', 'faktura-ramka__glowa');
  glowa.type = 'button';
  glowa.setAttribute('aria-expanded', 'true');
  glowa.addEventListener('click', zwin);
  const opis = element('div', 'faktura-ramka__opis');
  opis.appendChild(element('span', 'faktura-ramka__numer', f.nr_faktury));
  opis.appendChild(element('span', 'faktura-ramka__daty', zakres(f.okres_od, f.okres_do)));
  const plakietki = element('div', 'faktura-ramka__plakietki');
  plakietki.appendChild(element('span', 'faktura-plakietka', okresyTekst((f.okresy || []).length)));
  const kontrola = plakietkaKontroli(f);
  if (kontrola) plakietki.appendChild(kontrola);
  opis.appendChild(plakietki);
  glowa.appendChild(opis);

  const suma = element('div', 'faktura-suma');
  suma.appendChild(element('span', 'faktura-suma__etykieta', 'Wartość brutto faktury'));
  // Brutto wyliczone z okresów (a nie z faktury) oznaczamy gwiazdką z opisem.
  const wartosc = element('span', 'faktura-suma__wartosc', kwota(f.brutto) + (f.brutto_zrodlo === 'wyliczone' ? ' *' : ''));
  if (f.brutto_zrodlo === 'wyliczone') suma.title = 'wyliczone z okresów — brak kwoty brutto z faktury';
  suma.appendChild(wartosc);
  glowa.appendChild(suma);
  ramka.appendChild(glowa);

  const tresc = element('div', 'faktura-ramka__tresc');
  const dane = element('div', 'faktura-dane');
  dane.appendChild(element('div', 'faktura-sekcja', 'Dane z faktury · kwoty brutto'));
  const okresy = f.okresy || [];
  okresy.forEach((o, i) => dane.appendChild(blokOkresu(o, i + 1, okresy.length)));
  tresc.appendChild(dane);
  tresc.appendChild(panelAnalizy(f));
  ramka.appendChild(tresc);
  return ramka;
}

function pasekFaktury(f, rozwin) {
  const pasek = element('button', 'faktura-pasek');
  pasek.type = 'button';
  pasek.setAttribute('aria-expanded', 'false');
  pasek.addEventListener('click', rozwin);
  const opis = element('span', 'faktura-pasek__opis');
  opis.appendChild(element('span', 'faktura-pasek__numer', f.nr_faktury));
  const n = (f.okresy || []).length;
  const linia = element('span', 'faktura-pasek__daty');
  linia.appendChild(document.createTextNode(zakres(f.okres_od, f.okres_do)));
  linia.appendChild(element('span', 'faktura-tylko-telefon', ` · ${okresyTekst(n)}`));
  linia.appendChild(element('span', 'faktura-tylko-komputer',
    ` · ${typeof f.dni === 'number' ? `${f.dni} dni` : '—'} · ${liczba(f.m3, 3)} m³ · ${okresyTekst(n)}`));
  opis.appendChild(linia);
  pasek.appendChild(opis);
  pasek.appendChild(element('span', 'faktura-pasek__kwota', kwota(f.brutto) + (f.brutto_zrodlo === 'wyliczone' ? ' *' : '')));
  pasek.appendChild(element('span', 'faktura-pasek__strzalka', '›'));
  return pasek;
}

// --- Lista -----------------------------------------------------------------

function renderujListe() {
  listaFaktur.innerHTML = '';
  if (faktury.length === 0) {
    listaFaktur.appendChild(element('p', 'komunikat-pusto', 'Brak zapisanych faktur.'));
    return;
  }
  faktury.slice(0, widoczne).forEach((f) => {
    const karta = element('div', 'faktura-karta');
    const przelacz = (otworz) => () => {
      if (otworz) otwarte.add(f.nr_faktury); else otwarte.delete(f.nr_faktury);
      renderujListe();
    };
    karta.appendChild(otwarte.has(f.nr_faktury) ? ramkaFaktury(f, przelacz(false)) : pasekFaktury(f, przelacz(true)));
    listaFaktur.appendChild(karta);
  });
  if (widoczne < faktury.length) {
    const wiecej = element('button', 'przycisk-drugorzedny faktura-wiecej', 'Pokaż starsze faktury');
    wiecej.type = 'button';
    wiecej.addEventListener('click', () => {
      widoczne = Math.min(widoczne + KROK_STARSZYCH, faktury.length);
      renderujListe();
    });
    listaFaktur.appendChild(wiecej);
  }
}

function przyjmijDane(wynik) {
  const nowe = (wynik && wynik.faktury) || [];
  const pierwszy = faktury.length === 0;
  faktury = nowe;
  // Pierwsze rysowanie po otwarciu ekranu: najnowsza faktura rozwinięta, reszta zwinięta.
  if (pierwszy && nowe.length > 0 && otwarte.size === 0) otwarte.add(nowe[0].nr_faktury);
  if (pierwszy || widoczne === 0) {
    widoczne = szerokiEkran() ? nowe.length : Math.min(POCZATKOWO_NA_TELEFONIE, nowe.length);
  }
  renderujListe();
}

export function wczytajListeFaktur() {
  generacja++;
  const biezaca = generacja;
  faktury = [];
  otwarte = new Set();
  widoczne = 0;
  wczytajBlokPodgladu(() => biezaca === generacja, {
    status: statusListyFaktur,
    klucz: 'faktury_pelne',
    pobierz: () => pobierzOstatnieFaktury(ILE_FAKTUR),
    renderuj: przyjmijDane,
  });
}
