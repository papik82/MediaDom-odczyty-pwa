// Pora dnia (od 1.18.0, system projektowy wersja 5): świt, dzień, zmierzch, noc.
//
// Aplikacja ustawia atrybut `data-pora` na <html>, a CSS (css/styl.css) zmienia
// pejzaż, tło i — w nocy — całą paletę (noc to motyw ciemny; ustawienie telefonu
// `prefers-color-scheme` nie ma znaczenia). Pory przełączają się skokowo,
// bez animacji.
//
// Skąd pora: wschód i zachód słońca liczymy z położenia zapisanego w
// Ustawieniach (szerokość i długość geograficzna, tylko w localStorage tego
// telefonu — nic nie trafia do repozytorium ani do webhooka). Bez położenia
// zostaje dzień.
//   świt     — od godziny przed wschodem do godziny po wschodzie,
//   zmierzch — od godziny przed zachodem do godziny po zachodzie,
//   dzień    — między świtem a zmierzchem,
//   noc      — poza tym.
//
// Podgląd bez ruszania zegara i położenia: ?pora=swit|dzien|zmierzch|noc
// w adresie (oraz opcjonalnie &faza=0..1 dla fazy księżyca).

import { odczytajPolozenie } from './ustawienia.js';

const GODZINA = 3600000;
const KLUCZ_OSTATNIA_PORA = 'odczyty_pora_ostatnia';
const PORY = ['swit', 'dzien', 'zmierzch', 'noc'];

// --- Wschód i zachód słońca ---------------------------------------------------
// „Sunrise equation” (przybliżenie rzędu minuty, wystarczy na pory dnia).
// Zwraca { wschod, zachod } jako znaczniki czasu (ms) albo { polarna: 'noc' |
// 'dzien' }, gdy słońce tego dnia nie wschodzi / nie zachodzi.
export function czasySlonca(rok, miesiac, dzien, szerokosc, dlugosc) {
  const rad = Math.PI / 180;
  const J2000 = 2451545.0;
  // Dzień juliański południa UTC dnia lokalnego (miesiac 0–11).
  const jd = Date.UTC(rok, miesiac, dzien, 12) / 86400000 + 2440587.5;
  // Południe UTC to całkowity dzień juliański, więc n = liczba dób od J2000
  // (ceil z wzoru źródłowego przeskakiwałby tu na następną dobę).
  const n = Math.round(jd - J2000);
  const jSr = n - dlugosc / 360;                                   // średni czas słoneczny
  const M = (357.5291 + 0.98560028 * jSr) % 360;                    // anomalia średnia
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;                    // długość ekliptyczna
  const jTranzyt = J2000 + jSr + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDelta = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDelta = Math.cos(Math.asin(sinDelta));
  const cosOmega = (Math.sin(-0.833 * rad) - Math.sin(szerokosc * rad) * sinDelta)
    / (Math.cos(szerokosc * rad) * cosDelta);
  if (cosOmega > 1) return { polarna: 'noc' };
  if (cosOmega < -1) return { polarna: 'dzien' };
  const omega = Math.acos(cosOmega) / rad;                           // kąt godzinny w stopniach
  const naMs = (j) => (j - 2440587.5) * 86400000;
  return { wschod: naMs(jTranzyt - omega / 360), zachod: naMs(jTranzyt + omega / 360) };
}

// Pora dnia dla chwili `teraz` (Date) i położenia { szerokosc, dlugosc } albo null.
export function wyznaczPore(teraz, polozenie) {
  if (!polozenie) return 'dzien';
  const s = czasySlonca(teraz.getFullYear(), teraz.getMonth(), teraz.getDate(),
    polozenie.szerokosc, polozenie.dlugosc);
  if (s.polarna) return s.polarna === 'dzien' ? 'dzien' : 'noc';
  const t = teraz.getTime();
  if (t >= s.wschod - GODZINA && t <= s.wschod + GODZINA) return 'swit';
  if (t >= s.zachod - GODZINA && t <= s.zachod + GODZINA) return 'zmierzch';
  if (t > s.wschod + GODZINA && t < s.zachod - GODZINA) return 'dzien';
  return 'noc';
}

// --- Księżyc ------------------------------------------------------------------
// Faza f ∈ [0, 1): 0 nów, 0,25 pierwsza kwadra, 0,5 pełnia, 0,75 ostatnia
// kwadra. Miesiąc synodyczny od nowiu odniesienia 2000-01-06 18:14 UTC —
// dokładność ok. ±1 dzień, wystarcza do rysunku.
const MIESIAC = 29.530588 * 864e5;
const NOW_0 = Date.UTC(2000, 0, 6, 18, 14);

export function fazaKsiezyca(teraz) {
  return ((((teraz.getTime() - NOW_0) / MIESIAC) % 1) + 1) % 1;
}

// Cień na tarczy księżyca: półkole plus półelipsa terminatora (cx, cy — środek,
// R — promień tarczy; cień o 0,6 px większy, żeby nie zostawała jasna obwódka).
// Przybywanie (f < 0,5): cień po lewej, świeci prawa strona (półkula północna);
// ubywanie: ten sam kształt odbity w poziomie.
export function cienKsiezyca(f, cx, cy, R) {
  const r = R + 0.6;
  const k = Math.cos(2 * Math.PI * f);       // 1 przy nowiu, −1 przy pełni
  const rx = Math.abs(k) * r;                // półoś pozioma elipsy terminatora
  const luk = k > 0 ? 0 : 1;                 // sierp: terminator po stronie światła; garb: po stronie cienia
  const d = `M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r} A${rx} ${r} 0 0 ${luk} ${cx} ${cy - r} Z`;
  const transform = f > 0.5 ? `translate(${2 * cx} 0) scale(-1 1)` : '';
  return { d, transform };
}

// --- Zastosowanie pory ----------------------------------------------------------
const html = document.documentElement;
let ostatniaPora = null;
let ostatniaFaza = null;

function narysujKsiezyc(f) {
  const cien = document.getElementById('ksiezyc-cien');
  if (!cien) return;
  // Środek i promień tarczy w układzie ciała niebieskiego 68 × 68 (index.html).
  const { d, transform } = cienKsiezyca(f, 34, 34, 22);
  cien.setAttribute('d', d);
  if (transform) cien.setAttribute('transform', transform);
  else cien.removeAttribute('transform');
}

// Podgląd z adresu: ?pora=noc&faza=0.5 (zob. nagłówek pliku).
function podgladZAdresu() {
  const parametry = new URLSearchParams(location.search);
  const pora = parametry.get('pora');
  if (!PORY.includes(pora)) return null;
  const faza = parseFloat(parametry.get('faza'));
  return { pora, faza: Number.isFinite(faza) ? ((faza % 1) + 1) % 1 : null };
}

export function odswiezPore() {
  const teraz = new Date();
  const podglad = podgladZAdresu();
  const pora = podglad ? podglad.pora : wyznaczPore(teraz, odczytajPolozenie());
  const faza = podglad && podglad.faza !== null ? podglad.faza : fazaKsiezyca(teraz);

  // Księżyc rysujemy tylko w nocy i tylko, gdy faza się zmieniła (w ciągu
  // jednej nocy rysunek stoi w miejscu).
  if (pora === 'noc' && (ostatniaPora !== 'noc' || ostatniaFaza !== faza)) {
    narysujKsiezyc(faza);
    ostatniaFaza = faza;
  }
  if (pora === ostatniaPora) return;
  ostatniaPora = pora;
  html.dataset.pora = pora;

  // Pasek systemowy telefonu: kolor per pora (token pasek-systemowy). Manifest
  // jest statyczny, więc tu przepisujemy go do <meta name="theme-color">.
  const pasek = getComputedStyle(html).getPropertyValue('--pasek-systemowy').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && pasek) meta.setAttribute('content', pasek);
  try {
    localStorage.setItem(KLUCZ_OSTATNIA_PORA, pora);
  } catch (blad) {
    // Prywatny tryb przeglądarki — pamięć pory to tylko wygoda przy starcie.
  }
}

// Pora jest wyznaczana przy starcie, przy powrocie do aplikacji i co minutę.
odswiezPore();
setInterval(odswiezPore, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') odswiezPore();
});
