// Pulpit na ekranie startowym (od 1.6.0): stan domu w jednym spojrzeniu —
// tryb kotła, zbieracz, temperatury z ΔT, terminy odczytów liczników i pasek
// alarmów. Wszystko z JEDNEJ akcji webhooka `pulpit` (kontrakt:
// apps-script/CLAUDE.md), bo każde wywołanie to kilka sekund.
//
// Wzorzec „pokaż stare, odśwież w tle”: ostatnia odpowiedź leży w buforze
// (localStorage), więc ekran od razu ma dane, a świeża je podmienia. Progi
// i reguły (werdykt zbieracza, terminy odczytów, ΔT) liczy webhook — tutaj
// tylko wyświetlamy, żeby pulpit nie mógł się rozjechać z kartami i paskiem.
//
// Teksty kafelków wypełniamy w statycznej powłoce z index.html, więc same
// kafelki (odczyt, wejście do ekranów) działają także bez zasięgu.

import { pobierzPulpit } from '../webhook.js';
import { czyUstawieniaZapisane } from '../ustawienia.js';
import { zapiszBufor, odczytajBufor, opiszWiek } from '../bufor.js';
import { element, liczbaPL, ustawStatusBloku, MIN_ODSTEP_POBRANIA_MS } from '../wspolne.js';
import { naPowrotNaStart, naZmianieUstawien, naZmianieDanych, czyStartWidoczny } from '../nawigacja.js';
import { ETYKIETY_TRYBU, obwodyTrybu } from '../nastawy.js';
import { renderujAlarmy } from './alarmy.js';
import { PROG_BATERII_CZUJNIKA } from './zbieracz.js';

const KLUCZ_BUFORA = 'pulpit';
// Alarmy z bufora pokazujemy tylko, gdy są świeże — stary alarm mógłby straszyć
// czymś, co już minęło (ta sama zasada co przy pierwotnym pasku alarmów).
const MAKS_WIEK_ALARMOW_Z_BUFORA_MS = 30 * 60 * 1000;
// Telefon: poniżej tylu % bateria jest wyróżniona (próg alarmu z puls.js).
const PROG_BATERII_TELEFONU = 30;
// Temperatura baterii telefonu od tylu °C jest wyróżniona (TEMP_BATERII_UWAGA
// w apps-script/puls.js; alarm i mail od 45 °C robi webhook).
const PROG_TEMP_BATERII = 40;
// Temperatura starsza niż tyle godzin jest wyróżniona jako nieświeża
// (ten sam próg ciszy co w webhooku: CISZA_PROG_H w luki.js).
const PROG_STAROSCI_TEMP_H = 3;

const kafelGaz = document.getElementById('pulpit-gaz');
const kafelPrad = document.getElementById('przycisk-prad');
const kafelWoda = document.getElementById('pulpit-woda');
const podpisGazu = document.getElementById('pulpit-gaz-podpis');
const stanPradu = document.getElementById('pulpit-prad-stan');
const stanWody = document.getElementById('pulpit-woda-stan');
const tempCzas = document.getElementById('pulpit-temp-czas');
const tempWiek = document.getElementById('pulpit-temp-wiek');
const tempDt = document.getElementById('pulpit-temp-dt');
const kociolTryb = document.getElementById('pulpit-kociol-tryb');
const kociolIkony = document.getElementById('pulpit-kociol-ikony');
const kociolCwu = document.getElementById('pulpit-kociol-cwu');
const kociolCo = document.getElementById('pulpit-kociol-co');
const kociolWiersze = document.getElementById('pulpit-kociol-wiersze');
const zbKropka = document.getElementById('pulpit-zb-kropka');
const zbWerdykt = document.getElementById('pulpit-zb-werdykt');
const zbZapis = document.getElementById('pulpit-zb-zapis');
const zbWiersze = document.getElementById('pulpit-zb-wiersze');
const status = document.getElementById('pulpit-status');
const tempRole = {
  zewn: document.getElementById('pulpit-temp-zewn'),
  parter: document.getElementById('pulpit-temp-parter'),
  pietro: document.getElementById('pulpit-temp-pietro'),
};

const WERDYKTY = {
  ok: 'działa', uwaga: 'uwagi', problem: 'problem', nieznany: 'nieznany',
};
const ETYKIETY_CZUJNIKOW = { zewn: 'zewn.', parter: 'parter', pietro: 'piętro' };

// --- Pomocnicze ------------------------------------------------------------

function dwie(n) {
  return String(n).padStart(2, '0');
}

// "2026-10-09T21:00:00" → "21:00" (czas lokalny bez strefy, jak w całym projekcie).
function godzina(iso) {
  return iso ? iso.slice(11, 16) : '—';
}

// Wiersz „etykieta — wartość” w kafelku; `klasa` wyróżnia wartość (np. słaba bateria).
function wiersz(etykieta, tekst, klasa) {
  const w = element('span', 'kafel__wiersz');
  w.appendChild(element('span', '', etykieta));
  w.appendChild(element('span', klasa || '', tekst));
  return w;
}

// --- Odczyty liczników -------------------------------------------------------

// Na kaflach odczytów tylko jedno: ile dni minęło od ostatniego odczytu
// („dziś”, „wczoraj”, „N dni temu”). Dni liczymy NA TELEFONIE z daty ostatniego
// odczytu (dzień kalendarzowy, czas lokalny), a nie bierzemy z odpowiedzi —
// dzięki temu liczba jest prawdziwa także dla odpowiedzi z bufora sprzed doby.
function dniOdOdczytu(kafel) {
  if (!kafel || !kafel.ostatni) return null;
  const [rok, miesiac, dzien] = kafel.ostatni.slice(0, 10).split('-').map(Number);
  const teraz = new Date();
  const dzis = Date.UTC(teraz.getFullYear(), teraz.getMonth(), teraz.getDate());
  return Math.max(Math.round((dzis - Date.UTC(rok, miesiac - 1, dzien)) / 86400000), 0);
}

function opiszDni(n) {
  if (n === null) return '—';
  if (n === 0) return 'dziś';
  return n === 1 ? 'wczoraj' : `${n} dni temu`;
}

// Alarm gazu = przekroczony limit dni bez odczytu. Limit zna webhook (progi
// przypomnień): `limit_dni` (3 w sezonie, 10 poza), więc porównujemy z nim dni
// liczone lokalnie — działa też z bufora po zmianie doby. (Prąd i woda mają
// osobną ścieżkę: ustawKafelMiesieczny.)
function czyPrzekroczono(kafel, dniLokalnie) {
  if (!kafel || dniLokalnie === null) return false;
  return typeof kafel.limit_dni === 'number' && dniLokalnie >= kafel.limit_dni;
}

// Kafel gazu w alarmie dostaje klasę `kafel--alarm` (żółte tło i obrys) i znak ⚠
// przed liczbą dni oraz limit („5 dni temu · limit 3”).
function ustawKafelOdczytu(kafelEl, tekstEl, kafel, swiezy, zLimitem) {
  const dniLokalnie = dniOdOdczytu(kafel);
  const alarm = czyPrzekroczono(kafel, dniLokalnie);
  let tekst = opiszDni(dniLokalnie);
  if (alarm && zLimitem && typeof kafel.limit_dni === 'number') tekst += ` · limit ${kafel.limit_dni}`;
  tekstEl.textContent = alarm ? `⚠ ${tekst}` : tekst;
  tekstEl.classList.toggle('kafel__tekst-alarm', alarm);
  kafelEl.classList.toggle('kafel--alarm', alarm);
}

// Prąd i woda — odczyt raz w miesiącu, pierwszego dnia (założenie Pawła
// 2026-10-10), więc zamiast dni od odczytu pokazujemy ODLICZANIE do następnego:
//   „✓ dziś”          — odczyt zrobiony dzisiaj,
//   „czas na odczyt”  — brak odczytu za bieżący miesiąc (alarm, żółty kafel;
//                       flaga `czas` z webhooka, tylko z odpowiedzi z dzisiaj),
//   „za N dni”        — dni do 1. dnia następnego miesiąca.
// Odliczanie liczymy z daty telefonu, a bez dzisiejszej odpowiedzi (bufor
// sprzed doby — mógł się zmienić miesiąc) pokazujemy „—”, zamiast zgadywać.
function dniDoNastepnegoMiesiaca() {
  const teraz = new Date();
  const dzis = Date.UTC(teraz.getFullYear(), teraz.getMonth(), teraz.getDate());
  return Math.round((Date.UTC(teraz.getFullYear(), teraz.getMonth() + 1, 1) - dzis) / 86400000);
}

function ustawKafelMiesieczny(kafelEl, stanEl, kafel, swiezy) {
  const dniLokalnie = dniOdOdczytu(kafel);
  let tekst = '—';
  let rodzaj = 'neutralny';
  if (kafel && dniLokalnie === 0) {
    tekst = '✓ dziś';
    rodzaj = 'dzis';
  } else if (kafel && swiezy && kafel.czas === true) {
    tekst = '⚠ czas na odczyt';
    rodzaj = 'alarm';
  } else if (kafel && swiezy) {
    const za = dniDoNastepnegoMiesiaca();
    tekst = `za ${za} ${za === 1 ? 'dzień' : 'dni'}`;
  }
  stanEl.textContent = tekst;
  stanEl.className = `kafel__stan kafel__stan--${rodzaj}`;
  kafelEl.classList.toggle('kafel--alarm', rodzaj === 'alarm');
}

function renderujOdczyty(odczyty, swiezy) {
  const o = odczyty || {};
  ustawKafelOdczytu(kafelGaz, podpisGazu, o.gaz, swiezy, true);
  ustawKafelMiesieczny(kafelPrad, stanPradu, o.prad, swiezy);
  ustawKafelMiesieczny(kafelWoda, stanWody, o.woda, swiezy);
}

// Dzisiejsza data lokalna jako "RRRR-MM-DD" — do sprawdzenia, czy odpowiedź jest z dzisiaj.
function dzisLokalnieIso() {
  const d = new Date();
  return `${d.getFullYear()}-${dwie(d.getMonth() + 1)}-${dwie(d.getDate())}`;
}

// --- Temperatury -------------------------------------------------------------

// Prawdziwy minus (−), nie myślnik — przy mrozie zewn. wygląda czytelniej.
function temp(wartosc) {
  return typeof wartosc === 'number' ? `${liczbaPL(wartosc.toFixed(1)).replace('-', '−')}°` : '—';
}

// Wiek pomiaru liczymy na telefonie od znacznika czasu (znacznik to POCZĄTEK
// godziny, a średnia przychodzi po jej zamknięciu — stąd + godzina), żeby
// był prawdziwy także dla odpowiedzi z bufora.
function renderujTemperatury(t) {
  const role = ['zewn', 'parter', 'pietro'];
  role.forEach((rola) => {
    tempRole[rola].textContent = t && t[rola] ? temp(t[rola].temp) : '—';
  });
  tempDt.textContent = t && typeof t.dT === 'number' ? `${liczbaPL(t.dT.toFixed(1)).replace('-', '−')} K` : '—';

  // Najnowszy pomiar spośród ról.
  const znaczniki = role.map((r) => t && t[r] && t[r].ostatni).filter(Boolean).sort();
  const ostatni = znaczniki[znaczniki.length - 1];
  tempCzas.textContent = godzina(ostatni);
  const koniecGodziny = ostatni ? new Date(ostatni).getTime() + 3600000 : null;
  tempWiek.textContent = koniecGodziny ? opiszWiek(koniecGodziny) : '';
  const stary = koniecGodziny && Date.now() - koniecGodziny > PROG_STAROSCI_TEMP_H * 3600000;
  tempWiek.className = stary ? 'temperatury__wiek--stary' : '';
}

// --- Kocioł ------------------------------------------------------------------

// Ikony obwodów (kran = CWU, kaloryfer = CO) pokazujemy TYLKO dla włączonych
// obwodów — wyłączony albo nieznany obwód nie ma ikony. Gdy nie ma żadnej
// (kocioł wyłączony, brak danych), znika też cały rząd, żeby nie zostawiał luki.
function ustawIkonyObwodow(cwu, co) {
  kociolCwu.classList.toggle('ukryty', !cwu);
  kociolCo.classList.toggle('ukryty', !co);
  kociolIkony.classList.toggle('ukryty', !cwu && !co);
}

function renderujKociol(k) {
  kociolWiersze.innerHTML = '';
  if (!k || !k.ok || k.brak) {
    ustawIkonyObwodow(false, false);
    kociolIkony.setAttribute('aria-label', 'Stan kotła nieznany');
    kociolTryb.textContent = k && k.brak ? 'brak zapisów' : '—';
    return;
  }
  const obwody = obwodyTrybu(k.tryb);
  ustawIkonyObwodow(obwody.cwu, obwody.co);
  kociolIkony.setAttribute('aria-label',
    `CWU ${obwody.cwu ? 'włączone' : 'wyłączone'}, CO ${obwody.co ? 'włączone' : 'wyłączone'}`);
  // Podpis pod ikonami: tryb słownie i od kiedy obowiązuje („CWU + CO · od 2.10”).
  const [, mm, dd] = (k.obowiazuje_od || '').slice(0, 10).split('-');
  const od = dd ? ` · od ${Number(dd)}.${mm}` : '';
  kociolTryb.textContent = `${ETYKIETY_TRYBU[k.tryb] || k.tryb}${od}`;
  // Tylko nastawy, które mają sens dla trybu (bez CO nie ma krzywej, bez CWU temperatury CWU).
  const dodaj = (etykieta, wartosc, jednostka = '') => {
    if (wartosc === null || wartosc === undefined || wartosc === '') return;
    kociolWiersze.appendChild(wiersz(etykieta, `${liczbaPL(wartosc)}${jednostka}`));
  };
  if (obwody.co) {
    dodaj('krzywa', k.krzywa_grzewcza);
    dodaj('przesunięcie', k.przesuniecie);
  }
  if (obwody.cwu) dodaj('CWU', k.temp_cwu, ' °C');
}

// --- Zbieracz ----------------------------------------------------------------

// Trend baterii telefonu „doba do doby”: strzałka i różnica w punktach %
// względem tej samej pory poprzedniej doby (ocena harmonogramu ładowania).
// Pusty trend (pierwsza doba po wdrożeniu) — bez strzałki.
function opiszTrend(trend) {
  if (!trend) return null;
  const strzalki = { spada: '↘', plasko: '→', rosnie: '↗' };
  const znak = trend.roznica > 0 ? '+' : trend.roznica < 0 ? '−' : '±';
  return {
    tekst: `${strzalki[trend.kierunek] || '→'} ${znak}${Math.abs(trend.roznica)}`,
    uwaga: trend.kierunek === 'spada',
  };
}

function renderujZbieracz(z) {
  zbWiersze.innerHTML = '';
  if (!z) {
    zbKropka.className = 'kropka kropka--nieznany';
    zbWerdykt.textContent = '—';
    zbZapis.textContent = '';
    return;
  }
  const werdykt = WERDYKTY[z.werdykt] ? z.werdykt : 'nieznany';
  zbKropka.className = `kropka kropka--${werdykt}`;
  zbWerdykt.textContent = WERDYKTY[werdykt];

  // Podpis pod werdyktem: godzina ostatniego PULSU telefonu (zbieracz wysyła go
  // co godzinę), a nie ostatniego zapisu temperatur — puls mówi, że telefon żyje.
  // Wiek liczymy od znacznika czasu, żeby był prawdziwy także z bufora.
  const t = z.telefon;
  if (t && t.czas) {
    zbZapis.textContent = `puls ${godzina(t.czas)} · ${opiszWiek(new Date(t.czas).getTime())}`;
  } else {
    zbZapis.textContent = 'brak pulsu';
  }

  if (t && typeof t.bateria === 'number') {
    const w = wiersz('telefon', `${t.bateria} %`, t.bateria < PROG_BATERII_TELEFONU ? 'kafel__wartosc--uwaga' : '');
    const trend = opiszTrend(t.trend);
    if (trend) {
      w.lastChild.appendChild(element('span', trend.uwaga ? 'kafel__trend kafel__trend--uwaga' : 'kafel__trend', ` ${trend.tekst}`));
    }
    zbWiersze.appendChild(w);
    // Temperatura baterii telefonu (od pulsu); wyróżniona od progu uwagi.
    if (typeof t.temp_baterii === 'number') {
      zbWiersze.appendChild(wiersz('temp. baterii', `${liczbaPL(t.temp_baterii.toFixed(0))} °C`,
        t.temp_baterii >= PROG_TEMP_BATERII ? 'kafel__wartosc--uwaga' : ''));
    }
  } else {
    zbWiersze.appendChild(wiersz('telefon', 'brak pulsu', 'kafel__wartosc--uwaga'));
  }

  // Bateria Sonoffów (BleBox jej nie raportuje, więc bez wiersza).
  Object.entries(z.czujniki || {}).forEach(([rola, c]) => {
    if (!c || typeof c.bateria !== 'number') return;
    zbWiersze.appendChild(wiersz(`Sonoff ${ETYKIETY_CZUJNIKOW[rola] || rola}`, `${c.bateria} %`,
      c.bateria < PROG_BATERII_CZUJNIKA ? 'kafel__wartosc--uwaga' : ''));
  });
}

// --- Całość ------------------------------------------------------------------

// `wynik` = odpowiedź akcji `pulpit` (null = pusty pulpit, np. po zmianie
// ustawień). `czasMs` — kiedy odpowiedź została pobrana; `zBufora` — czy to
// stare dane, których alarmów nie chcemy pokazywać bez sprawdzenia wieku.
function renderujPulpit(wynik, czasMs, zBufora) {
  const swiezy = Boolean(wynik) && String(wynik.sprawdzono || '').slice(0, 10) === dzisLokalnieIso();
  renderujOdczyty(wynik && wynik.odczyty, swiezy);
  renderujTemperatury(wynik && wynik.temperatury);
  renderujKociol(wynik && wynik.kociol);
  renderujZbieracz(wynik && wynik.zbieracz);
  const alarmyOk = wynik && (!zBufora || Date.now() - czasMs <= MAKS_WIEK_ALARMOW_Z_BUFORA_MS);
  renderujAlarmy(alarmyOk ? (wynik.alarmy || []) : []);
}

let pokazanoDane = false;     // czy na ekranie są już dane (z bufora albo ze świeżej odpowiedzi)
let czasPokazanych = 0;       // kiedy pobrano to, co widać
let wToku = false;
let czasOstatniejProby = 0;
let wymusOdswiezenie = false; // po zapisie albo zmianie ustawień — bez czekania na odstęp
// Rośnie przy zmianie ustawień — odpowiedź z poprzedniego adresu/arkusza jest wyrzucana.
let generacja = 0;

function pokazStatusAktualizacji(rodzaj, tekst) {
  ustawStatusBloku(status, tekst, rodzaj);
}

function odswiezPulpit() {
  if (!czyUstawieniaZapisane() || !czyStartWidoczny()) return;
  if (wToku) return;
  if (!wymusOdswiezenie && Date.now() - czasOstatniejProby < MIN_ODSTEP_POBRANIA_MS) return;

  // Pierwsze pokazanie w tej sesji: od razu to, co zapamiętane.
  if (!pokazanoDane) {
    const zBufora = odczytajBufor(KLUCZ_BUFORA);
    if (zBufora) {
      renderujPulpit(zBufora.dane, zBufora.czas, true);
      pokazanoDane = true;
      czasPokazanych = zBufora.czas;
    }
  }

  wToku = true;
  wymusOdswiezenie = false;
  czasOstatniejProby = Date.now();
  const mojaGeneracja = generacja;
  pokazStatusAktualizacji(pokazanoDane ? 'info' : 'wczytywanie',
    pokazanoDane ? `Dane z ${godzina(lokalnyIso(czasPokazanych))} — odświeżam…` : 'Wczytywanie…');

  pobierzPulpit()
    .then((wynik) => {
      if (mojaGeneracja !== generacja) return;
      if (!wynik.ok) throw new Error(wynik.blad || 'błąd webhooka');
      zapiszBufor(KLUCZ_BUFORA, wynik);
      czasPokazanych = Date.now();
      pokazanoDane = true;
      renderujPulpit(wynik, czasPokazanych, false);
      const czesciowo = wynik.bledy && wynik.bledy.length > 0 ? ' (część danych niedostępna)' : '';
      pokazStatusAktualizacji('info', `Zaktualizowano ${godzina(lokalnyIso(czasPokazanych))}${czesciowo}`);
    })
    .catch((blad) => {
      if (mojaGeneracja !== generacja) return;
      console.error('Nie udało się odświeżyć pulpitu:', blad);
      const powod = navigator.onLine ? 'brak odpowiedzi serwera' : 'brak połączenia';
      const dane = pokazanoDane ? ` Pokazuję dane z ${godzina(lokalnyIso(czasPokazanych))}.` : '';
      // Z danymi na ekranie to tylko informacja (czerwona ramka tylko wtedy, gdy ekran jest pusty).
      pokazStatusAktualizacji(pokazanoDane ? 'info' : 'blad', `Nie udało się odświeżyć (${powod}).${dane}`);
    })
    // Po zmianie ustawień (generacja) odpowiedź jest obca — flagę zdjął już ten, kto ją zmienił.
    .finally(() => { if (mojaGeneracja === generacja) wToku = false; });
}

// Czas w ms → "RRRR-MM-DDTGG:MM:SS" w czasie lokalnym (jak znaczniki z webhooka).
function lokalnyIso(czasMs) {
  const d = new Date(czasMs);
  return `${d.getFullYear()}-${dwie(d.getMonth() + 1)}-${dwie(d.getDate())}T${dwie(d.getHours())}:${dwie(d.getMinutes())}:${dwie(d.getSeconds())}`;
}

// Odświeżenie przy starcie, powrocie na ekran startowy i powrocie z tła.
naPowrotNaStart(odswiezPulpit);

// Zapis (odczyt, kocioł, faktura, wysyłka z kolejki) zmienił arkusz — pulpit
// pytamy od razu; jeśli ekran startowy nie jest widoczny, zrobi to powrót na start.
naZmianieDanych(() => {
  wymusOdswiezenie = true;
  odswiezPulpit();
});

// Nowy adres/token to inny arkusz — czyścimy to, co widać, i wyrzucamy
// odpowiedzi w drodze (bufor czyści ekran ustawień przez wyczyscBufor).
naZmianieUstawien(() => {
  generacja++;
  pokazanoDane = false;
  wToku = false;
  wymusOdswiezenie = true;
  renderujPulpit(null, 0, false);
  pokazStatusAktualizacji('info', '');
});
