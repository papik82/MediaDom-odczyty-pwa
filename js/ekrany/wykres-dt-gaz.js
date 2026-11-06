// Dwa wykresy ekranu Analizy (od 1.25.0), czysty SVG bez biblioteki — jak wykres doby
// (wykres-doby.js) i wykres faktur (faktura-wykres.js):
//  - wykres punktowy: jeden punkt to jeden okres między odczytami gazu, oś X to średnie ΔT
//    okresu, oś Y to zużycie w m³ na dobę (nie surowa różnica wskazań — odczyty są co 1–14 dni,
//    więc tylko wartość znormalizowana do doby jest porównywalna);
//  - oś czasu sezonu: u góry słupki zużycia na dobę (szerokość słupka = długość okresu),
//    pod spodem linia ΔT na tej samej osi czasu. To dwa osobne panele, nie jedna oś podwójna.
// Wykresy niczego nie liczą: dostają gotowe okresy z webhooka (akcja `analiza`, widok `dt_gaz`).
// Kolory biorą się z klas `wa-…` w styl.css (zmieniają się z porą dnia), a kolor trybu kotła
// jest ten sam na obu wykresach i w legendzie.

import { element, svg } from '../wspolne.js';

const MS_DZIEN = 24 * 60 * 60 * 1000;
const dataMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const MIESIACE = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export const OPIS_TRYBU = {
  cwu_co: 'woda i ogrzewanie',
  co: 'ogrzewanie',
  cwu: 'ciepła woda',
  off: 'kocioł wyłączony',
};
const znanyTryb = (t) => (OPIS_TRYBU[t] ? t : 'inny');

export const pl = (x, miejsca = 1) => x.toFixed(miejsca).replace('.', ',');

export function dataPL(iso) {
  const [r, m, d] = iso.split('-');
  return `${d}.${m}.${r}`;
}

// „Ładny” krok osi: 1, 2, 5 × potęga dziesięciu, tak żeby kresek było najwyżej `ile`.
function krokOsi(maks, ile) {
  const surowy = Math.max(maks, 1e-9) / ile;
  const rzad = 10 ** Math.floor(Math.log10(surowy));
  return [1, 2, 5, 10].map((m) => m * rzad).find((k) => k >= surowy * 0.999999);
}

function kreski(maks, krok) {
  const t = [];
  for (let v = 0; v <= maks + 1e-9; v += krok) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}

// Wspólny szkielet: SVG wstawiany do `kontener`, przerysowywany przy zmianie szerokości.
// Ukryty kontener ma szerokość 0 — wtedy nic nie rysujemy (ekran Analizy jest zwykle ukryty).
function obserwujSzerokosc(kontener, rysuj) {
  if (typeof ResizeObserver === 'function') {
    let ostatnia = 0;
    new ResizeObserver(() => {
      const w = Math.floor(kontener.clientWidth);
      if (w !== ostatnia) { ostatnia = w; rysuj(); }
    }).observe(kontener);
  } else {
    window.addEventListener('resize', rysuj);
  }
}

// Współrzędne zdarzenia w układzie viewBox SVG (SVG może być skalowane przez CSS).
function wSkaliSvg(ev, s, W, H) {
  const r = s.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
}

// --- Wykres punktowy -----------------------------------------------------------------------

// `naWybor(okres)` — stuknięcie / najechanie na punkt albo strzałki z klawiatury.
// ustaw({ okresy, prosta, baza }): `okresy` — punkty do narysowania (już przefiltrowane do TAK),
// `prosta` — { nachylenie, odcieta, x0, x1 } albo null, `baza` — zużycie bazowe CWU albo null.
export function utworzWykresPunktowy(kontener, naWybor) {
  let stan = { okresy: [], prosta: null, baza: null };
  let wybrany = null;
  let uchwyty = null;                 // elementy SVG zmieniane przy zmianie wyboru (bez przerysowania)

  function ustawWybor() {
    if (!uchwyty) return;
    uchwyty.kola.forEach((kolo, okres) => kolo.classList.toggle('wa-pkt--wybrany', okres === wybrany));
    const kolo = wybrany && uchwyty.kola.get(wybrany);
    if (kolo) {
      uchwyty.pierscien.setAttribute('cx', kolo.getAttribute('cx'));
      uchwyty.pierscien.setAttribute('cy', kolo.getAttribute('cy'));
      uchwyty.pierscien.setAttribute('r', Number(kolo.getAttribute('r')) + 3);
      uchwyty.pierscien.removeAttribute('display');
    } else {
      uchwyty.pierscien.setAttribute('display', 'none');
    }
  }

  function rysuj() {
    const W = Math.floor(kontener.clientWidth);
    if (W < 200) return;
    const H = W >= 560 ? 360 : 270;
    const L = 40, R = 10, T = 10, B = 36;
    const pts = stan.okresy;

    const xKrok = 4;
    const xMaks = Math.max(xKrok, Math.ceil(Math.max(8, ...pts.map((p) => p.dt)) / xKrok) * xKrok);
    const yKrok = krokOsi(Math.max(2, ...pts.map((p) => p.m3_doba), stan.baza || 0), 5);
    const yMaks = Math.max(yKrok, Math.ceil(Math.max(2, ...pts.map((p) => p.m3_doba), stan.baza || 0) / yKrok) * yKrok);
    const sx = (v) => L + (v / xMaks) * (W - L - R);
    const sy = (v) => H - B - (v / yMaks) * (H - B - T);

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: 0,
      'aria-label': `Wykres punktowy: ${pts.length} okresów, ΔT na osi poziomej, m³ na dobę na pionowej. Strzałki wybierają okres.` });

    kreski(yMaks, yKrok).forEach((v) => {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: sy(v), y2: sy(v), class: 'wf-siatka' }));
      s.appendChild(svg('text', { x: L - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'wf-tekst' }, pl(v, yKrok < 1 ? 1 : 0)));
    });
    kreski(xMaks, xKrok).forEach((v) => {
      s.appendChild(svg('text', { x: sx(v), y: H - B + 15, 'text-anchor': 'middle', class: 'wf-tekst' }, String(v)));
    });
    s.appendChild(svg('line', { x1: L, x2: W - R, y1: sy(0), y2: sy(0), class: 'wf-os' }));
    s.appendChild(svg('text', { x: (L + W - R) / 2, y: H - 4, 'text-anchor': 'middle', class: 'wf-tekst' }, 'ΔT (średnia z okresu), K'));
    s.appendChild(svg('text', { transform: `translate(11 ${(T + H - B) / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'wf-tekst' }, 'm³ na dobę'));

    if (typeof stan.baza === 'number') {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: sy(stan.baza), y2: sy(stan.baza), class: 'wa-baza' }));
    }
    if (stan.prosta && typeof stan.prosta.nachylenie === 'number') {
      const { nachylenie: k, odcieta: c, x0, x1 } = stan.prosta;
      s.appendChild(svg('line', { x1: sx(x0), y1: sy(c + k * x0), x2: sx(x1), y2: sy(c + k * x1), class: 'wa-prosta' }));
    }

    // Długie okresy (wiarygodniejsze) rysujemy pierwsze, żeby krótkie leżały na wierzchu.
    const kola = new Map();
    [...pts].sort((a, b) => b.doby - a.doby).forEach((p) => {
      const kolo = svg('circle', {
        cx: sx(p.dt).toFixed(1), cy: sy(p.m3_doba).toFixed(1),
        r: (3 + Math.min(p.doby, 14) * 0.4).toFixed(1), class: `wa-pkt wa-pkt--${znanyTryb(p.tryb)}`,
      });
      kolo.appendChild(svg('title', {}, `${dataPL(p.od)} – ${dataPL(p.do)}: ΔT ${pl(p.dt)} K, ${pl(p.m3_doba, 2)} m³/dobę`));
      s.appendChild(kolo);
      kola.set(p, kolo);
    });
    const pierscien = svg('circle', { class: 'wa-pierscien', display: 'none' });
    s.appendChild(pierscien);

    // Najbliższy punkt w promieniu ok. 18 px — palec trafia gorzej niż kursor.
    const najblizszy = (ev) => {
      const { x, y } = wSkaliSvg(ev, s, W, H);
      let wynik = null, odl = 18;
      pts.forEach((p) => {
        const d = Math.hypot(sx(p.dt) - x, sy(p.m3_doba) - y);
        if (d <= odl) { odl = d; wynik = p; }
      });
      return wynik;
    };
    s.addEventListener('click', (ev) => { const p = najblizszy(ev); if (p) naWybor(p); });
    s.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const p = najblizszy(ev);
      if (p && p !== wybrany) naWybor(p);
    });
    s.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const wg = [...pts].sort((a, b) => (a.do < b.do ? -1 : 1));
      const i = wg.indexOf(wybrany);
      const j = ev.key === 'ArrowRight' ? Math.min(wg.length - 1, i + 1) : Math.max(0, i < 0 ? wg.length - 1 : i - 1);
      if (wg[j]) naWybor(wg[j]);
    });

    kontener.replaceChildren(s);
    uchwyty = { kola, pierscien };
    ustawWybor();
  }

  obserwujSzerokosc(kontener, rysuj);
  return {
    ustaw(nowy) { stan = nowy; rysuj(); },
    wybierz(okres) { wybrany = okres; ustawWybor(); },
  };
}

// --- Oś czasu sezonu -----------------------------------------------------------------------

// ustaw({ okresy, od, do }): `okresy` — wszystkie okresy sezonu (także MIESZANY / NIEZNANY,
// pokazane na szaro jako luki w analizie), `od` / `do` — granice osi czasu (RRRR-MM-DD).
export function utworzWykresCzasu(kontener, naWybor) {
  let stan = { okresy: [], od: null, do: null };
  let wybrany = null;
  let uchwyty = null;

  function ustawWybor() {
    if (!uchwyty) return;
    const { pasmo, x } = uchwyty;
    if (!wybrany || !uchwyty.okresy.includes(wybrany)) { pasmo.setAttribute('display', 'none'); return; }
    const xa = x(dataMs(wybrany.od)), xb = x(dataMs(wybrany.do));
    pasmo.setAttribute('x', Math.min(xa, xb - 3));
    pasmo.setAttribute('width', Math.max(3, xb - xa));
    pasmo.removeAttribute('display');
  }

  function rysuj() {
    const W = Math.floor(kontener.clientWidth);
    const pts = stan.okresy;
    if (W < 200 || !stan.od || !stan.do || pts.length === 0) { kontener.replaceChildren(); uchwyty = null; return; }
    const szeroki = W >= 560;
    const L = 40, R = 10;
    const H1 = szeroki ? 170 : 140, H2 = szeroki ? 120 : 100;
    const gora1 = 18, gora2 = gora1 + H1 + 32;
    const H = gora2 + H2 + 26;
    const x0 = dataMs(stan.od), x1 = dataMs(stan.do);
    const x = (ms) => L + ((ms - x0) / (x1 - x0)) * (W - L - R);

    const yG = Math.max(2, ...pts.map((p) => p.m3_doba));
    const krokG = krokOsi(yG, 4);
    const maksG = Math.ceil(yG / krokG) * krokG;
    const yT = Math.max(5, ...pts.map((p) => p.dt));
    const krokT = krokOsi(yT, 4);
    const maksT = Math.ceil(yT / krokT) * krokT;
    const syG = (v) => gora1 + H1 - (v / maksG) * H1;
    const syT = (v) => gora2 + H2 - (v / maksT) * H2;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: 0,
      'aria-label': `Oś czasu sezonu: zużycie gazu na dobę i ΔT dla ${pts.length} okresów. Strzałki wybierają okres.` });

    // Siatka i opisy dwóch paneli.
    const panel = (gora, wys, maks, krok, syf, jednostka, miejsca) => {
      s.appendChild(svg('text', { x: L, y: gora - 6, class: 'wf-tekst' }, jednostka));
      kreski(maks, krok).forEach((v) => {
        s.appendChild(svg('line', { x1: L, x2: W - R, y1: syf(v), y2: syf(v), class: 'wf-siatka' }));
        s.appendChild(svg('text', { x: L - 6, y: syf(v) + 4, 'text-anchor': 'end', class: 'wf-tekst' }, pl(v, miejsca)));
      });
    };
    panel(gora1, H1, maksG, krokG, syG, 'm³ na dobę', krokG < 1 ? 1 : 0);
    panel(gora2, H2, maksT, krokT, syT, 'ΔT, K', krokT < 1 ? 1 : 0);

    // Pasmo wybranego okresu pod słupkami i linią, przez oba panele.
    const pasmo = svg('rect', { y: gora1, height: gora2 + H2 - gora1, class: 'wa-pasmo', display: 'none' });
    s.appendChild(pasmo);

    // Słupki: lewy brzeg = początek okresu, szerokość = długość okresu.
    pts.forEach((p) => {
      const xa = x(dataMs(p.od)), xb = x(dataMs(p.do));
      const klasa = `wa-slupek wa-slupek--${znanyTryb(p.tryb)}${p.status === 'TAK' ? '' : ' wa-slupek--pominiety'}`;
      const r = svg('rect', { x: xa.toFixed(1), y: syG(p.m3_doba).toFixed(1), width: Math.max(1, xb - xa - 0.6).toFixed(1),
        height: (syG(0) - syG(p.m3_doba)).toFixed(1), class: klasa });
      r.appendChild(svg('title', {}, `${dataPL(p.od)} – ${dataPL(p.do)}: ${pl(p.m3_doba, 2)} m³/dobę, ΔT ${pl(p.dt)} K${p.status === 'TAK' ? '' : ` (${p.status})`}`));
      s.appendChild(r);
    });

    // ΔT: schodki, bo wartość jest średnią z całego okresu. Przerwa w osi czasu = przerwa w linii.
    let sciezka = '';
    pts.forEach((p, i) => {
      const xa = x(dataMs(p.od)).toFixed(1), xb = x(dataMs(p.do)).toFixed(1), y = syT(p.dt).toFixed(1);
      const przerwa = i === 0 || dataMs(p.od) - dataMs(pts[i - 1].do) > 1.5 * MS_DZIEN;
      sciezka += `${przerwa ? 'M' : 'L'}${xa},${y} L${xb},${y} `;
    });
    s.appendChild(svg('path', { d: sciezka.trim(), class: 'wa-dt-linia' }));

    // Oś czasu: kreska i skrót na początku miesiąca (bez pionowej siatki), co drugi przy ciasnych opisach.
    const osY = gora2 + H2;
    s.appendChild(svg('line', { x1: L, x2: W - R, y1: osY, y2: osY, class: 'wf-os' }));
    const pocz = new Date(x0);
    let rok = pocz.getUTCFullYear(), mies = pocz.getUTCMonth() + (pocz.getUTCDate() > 1 ? 1 : 0);
    let ostatniaEtykieta = -Infinity;
    for (let ms = Date.UTC(rok, mies, 1); ms <= x1; ms = Date.UTC(rok, ++mies, 1)) {
      const d = new Date(ms);
      const px = x(ms);
      s.appendChild(svg('line', { x1: px, x2: px, y1: osY, y2: osY + 4, class: 'wf-os' }));
      if (px - ostatniaEtykieta >= 30) {
        const m = d.getUTCMonth();
        const etykieta = MIESIACE[m] + (m === 0 || ostatniaEtykieta === -Infinity ? ` ’${String(d.getUTCFullYear()).slice(2)}` : '');
        s.appendChild(svg('text', { x: px, y: osY + 16, 'text-anchor': 'middle', class: 'wf-tekst' }, etykieta));
        ostatniaEtykieta = px + (etykieta.length > 3 ? 18 : 0);
      }
    }

    // Okres pod kursorem: ten, którego przedział dat obejmuje punkt, albo najbliższy.
    const okresPodX = (ev) => {
      const px = wSkaliSvg(ev, s, W, H).x;
      const ms = x0 + ((px - L) / (W - L - R)) * (x1 - x0);
      let wynik = null, odl = Infinity;
      pts.forEach((p) => {
        const a = dataMs(p.od), b = dataMs(p.do);
        const d = ms >= a && ms <= b ? 0 : Math.min(Math.abs(ms - a), Math.abs(ms - b));
        if (d < odl) { odl = d; wynik = p; }
      });
      return odl <= 4 * MS_DZIEN ? wynik : null;
    };
    s.addEventListener('click', (ev) => { const p = okresPodX(ev); if (p) naWybor(p); });
    s.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const p = okresPodX(ev);
      if (p && p !== wybrany) naWybor(p);
    });
    s.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const i = pts.indexOf(wybrany);
      const j = ev.key === 'ArrowRight' ? Math.min(pts.length - 1, i + 1) : Math.max(0, i < 0 ? pts.length - 1 : i - 1);
      naWybor(pts[j]);
    });

    kontener.replaceChildren(s);
    uchwyty = { pasmo, x, okresy: pts };
    ustawWybor();
  }

  obserwujSzerokosc(kontener, rysuj);
  return {
    ustaw(nowy) { stan = nowy; rysuj(); },
    wybierz(okres) { wybrany = okres; ustawWybor(); },
  };
}

// Mała próbka koloru do legendy (okrąg, kwadrat albo kreska) w klasach tych samych co wykres.
export function probkaLegendy(rodzaj, klasa) {
  const s = svg('svg', { width: 22, height: 12, 'aria-hidden': 'true' });
  if (rodzaj === 'kolo') s.appendChild(svg('circle', { cx: 11, cy: 6, r: 4.5, class: klasa }));
  else if (rodzaj === 'slupek') s.appendChild(svg('rect', { x: 5, y: 1, width: 12, height: 10, rx: 2, class: klasa }));
  else s.appendChild(svg('line', { x1: 1, y1: 6, x2: 21, y2: 6, class: klasa }));
  return s;
}
