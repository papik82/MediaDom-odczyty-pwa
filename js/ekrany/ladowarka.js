// Ekran „Ładowarka” — sterowanie ładowaniem baterii telefonu zbieracza (BACKLOG pkt 49).
//
// Ładowarka jest w przełączniku Zigbee ZBMicro (eWeLink); telefon (zbieracz 1.6) co ok.
// 5 minut zgłasza webhookowi stan i pobiera konfigurację. Ten ekran:
//   - pokazuje stan (ładuje się / nie, bateria, od kiedy trwa ładowanie, ostrzeżenia),
//   - przełącza sterowanie (włączone / tylko log) i tryb (auto / harmonogram / ręczny),
//   - zmienia progi histerezy i okna harmonogramu, wysyła polecenie włącz / wyłącz,
//   - pokazuje 10 ostatnich ładowań.
// Konfiguracja leży w webhooku (źródło prawdy), a walidację robi serwer — walidacja tutaj
// tylko oszczędza podróż, gdy wartość jest oczywiście zła. Zmiana nigdzie nie czeka w kolejce
// offline: bez połączenia po prostu się nie zapisze i ekran to powie.

import { pobierzStanLadowarki, zapiszKonfiguracjeLadowarki } from '../webhook.js';
import { wyczyscBuforKlucz } from '../bufor.js';
import { element, formatujDataGodzinePodgladu, wczytajBlokPodgladu, MIN_ODSTEP_POBRANIA_MS } from '../wspolne.js';
import { pokazEkran, ukryjKomunikatStart, powiadomOZmianieDanych } from '../nawigacja.js';
import { poUstawieniach } from './ustawienia.js';

const ekranLadowarki = document.getElementById('ekran-ladowarka');
const ekranZbieracza = document.getElementById('ekran-zbieracz');
const przyciskOtworz = document.getElementById('przycisk-ladowarka');
const przyciskZamknij = document.getElementById('przycisk-zamknij-ladowarke');
const statusLadowarki = document.getElementById('status-ladowarki');
const stanKontener = document.getElementById('stan-ladowarki');
const listaLadowan = document.getElementById('lista-ladowan');
const komunikat = document.getElementById('komunikat-ladowarki');

const segmentAktywne = document.getElementById('segment-aktywne-ladowarki');
const segmentTryb = document.getElementById('segment-tryb-ladowarki');
const opisTrybu = document.getElementById('opis-trybu-ladowarki');

const sekcjaProgow = document.getElementById('sekcja-progow-ladowarki');
const formularzProgow = document.getElementById('formularz-progow-ladowarki');
const poleDolny = document.getElementById('pole-dolny-ladowarki');
const poleGorny = document.getElementById('pole-gorny-ladowarki');

const sekcjaHarmonogramu = document.getElementById('sekcja-harmonogramu-ladowarki');
const formularzHarmonogramu = document.getElementById('formularz-harmonogramu-ladowarki');
const listaOkien = document.getElementById('lista-okien-ladowarki');
const przyciskDodajOkno = document.getElementById('przycisk-dodaj-okno-ladowarki');

const sekcjaRecznego = document.getElementById('sekcja-recznego-ladowarki');
const przyciskWlacz = document.getElementById('przycisk-wlacz-ladowarke');
const przyciskWylacz = document.getElementById('przycisk-wylacz-ladowarke');
const opisPolecenia = document.getElementById('opis-polecenia-ladowarki');

// Granice jak na serwerze (apps-script/ladowarka.js) i na telefonie (zbieracz.py).
const DOLNY_MIN = 20;
const GORNY_MAX = 95;
const MIN_ROZSTEP = 15;
const MAKS_OKIEN = 6;
const ODSWIEZANIE_MS = MIN_ODSTEP_POBRANIA_MS;

const OPISY_TRYBOW = {
  auto: 'Auto — telefon włącza ładowanie przy dolnym progu baterii i wyłącza przy górnym.',
  harmonogram: 'Harmonogram — ładowanie tylko w oknach czasowych, niezależnie od poziomu baterii.',
  reczny: 'Ręczny — ładowarką steruje tylko to, co klikniesz poniżej.',
};
const NAZWY_ZRODEL = {
  auto: 'auto', harmonogram: 'harmonogram', reczne: 'ręcznie',
  awaryjne: 'awaryjnie', zewnetrzne: 'poza zbieraczem',
};
const STANY_LADOWANIA = {
  Charging: 'ładuje się', Discharging: 'rozładowuje się', Full: 'naładowana', 'Not charging': 'nie ładuje',
};

let generacja = 0;
let odswiezanie = null;             // id timera odświeżania, gdy ekran jest otwarty
let ostatniWynik = null;            // ostatnia odpowiedź ladowarka_stan (z bufora lub świeża)
let brudneProgi = false;            // użytkownik edytuje pola — odświeżenie ich nie nadpisuje
let brudnyHarmonogram = false;
let zapisuje = false;

// --- Pomocnicze ---------------------------------------------------------------

const dwie = (n) => String(n).padStart(2, '0');

function godzinaZIso(tekst) {
  const d = tekst ? new Date(tekst) : null;
  return d && !Number.isNaN(d.getTime()) ? `${dwie(d.getHours())}:${dwie(d.getMinutes())}` : '—';
}

function dzienGodzinaZIso(tekst) {
  const d = tekst ? new Date(tekst) : null;
  return d && !Number.isNaN(d.getTime())
    ? `${dwie(d.getDate())}.${dwie(d.getMonth() + 1)} ${dwie(d.getHours())}:${dwie(d.getMinutes())}` : '—';
}

function opiszCzasTrwania(minut) {
  if (typeof minut !== 'number') return '';
  if (minut < 60) return `${minut} min`;
  return `${Math.floor(minut / 60)} h${minut % 60 ? ` ${minut % 60} min` : ''}`;
}

function ustawKomunikat(tekst, rodzaj) {
  komunikat.textContent = tekst || '';
  komunikat.className = tekst ? (rodzaj === 'sukces' ? 'komunikat komunikat-sukces' : 'komunikat') : 'komunikat ukryty';
}

// Wskaźnik segmentu stoi pod wybranym przyciskiem; pozycję liczymy z realnego położenia,
// więc ekran musi być już widoczny (na ukrytym offsetWidth = 0) — jak w kociol.js.
function ustawSegment(segment, wartosc) {
  const opcje = Array.from(segment.querySelectorAll('.segment-tryb__opcja'));
  const wskaznik = segment.querySelector('.segment-tryb__wskaznik');
  const wybrana = opcje.find((o) => o.dataset.wartosc === wartosc);
  opcje.forEach((o) => o.setAttribute('aria-checked', String(o === wybrana)));
  if (!wybrana || !wybrana.offsetWidth) return;
  wskaznik.style.width = `${wybrana.offsetWidth}px`;
  wskaznik.style.transform = `translateX(${wybrana.offsetLeft}px)`;
}

// --- Stan ---------------------------------------------------------------------

// Jedna plakietka w kolorach karty Zbieracz: ok / uwaga / problem / nieznany.
function ocenaStanu(wynik) {
  const t = wynik.telefon;
  const k = wynik.konfiguracja;
  if (!t) {
    return { klasa: 'nieznany', tytul: 'Brak danych z telefonu',
      opis: 'Zbieracz 1.6 jeszcze się nie zsynchronizował z webhookiem.' };
  }
  const ladowanie = t.przelacznik === 'on' ? 'Ładuje się' : t.przelacznik === 'off' ? 'Nie ładuje' : 'Stan nieznany';
  const czesci = [];
  if (typeof t.bateria === 'number') czesci.push(`bateria ${t.bateria} %`);
  czesci.push(t.wiek_min === null || t.wiek_min === undefined ? 'zgłoszenie bez czasu' : `zgłoszono ${opiszCzasTrwania(t.wiek_min)} temu`);
  const opis = czesci.join(' · ');
  if (t.online === false) return { klasa: 'problem', tytul: 'Przełącznik offline', opis };
  const przestarzale = k.aktywne && typeof t.wiek_min === 'number' && t.wiek_min >= 20;
  if (t.blad || przestarzale) return { klasa: 'uwaga', tytul: ladowanie, opis };
  return { klasa: 'ok', tytul: ladowanie, opis };
}

function renderujStan(wynik) {
  ostatniWynik = wynik;
  stanKontener.innerHTML = '';
  const k = wynik.konfiguracja;
  const t = wynik.telefon;
  const ocena = ocenaStanu(wynik);

  const plakietka = element('div', `zbieracz__werdykt zbieracz__werdykt--${ocena.klasa}`);
  plakietka.appendChild(element('strong', 'zbieracz__werdykt-tytul', ocena.tytul));
  plakietka.appendChild(element('span', 'zbieracz__werdykt-opis', ocena.opis));
  stanKontener.appendChild(plakietka);

  // Ostrzeżenia z telefonu i zaległa zmiana ustawień — w stylu paska alarmów.
  const uwagi = [];
  if (t && t.blad) uwagi.push(t.blad);
  if (t && t.oczekuje) uwagi.push('Telefon jeszcze nie pobrał ostatnich ustawień — dojdą w ciągu ok. 5 minut.');
  if (k.aktywne && t && typeof t.wiek_min === 'number' && t.wiek_min >= 20) {
    uwagi.push(`Telefon nie synchronizował się od ${opiszCzasTrwania(t.wiek_min)} — sterowanie nie działa.`);
  }
  if (uwagi.length > 0) {
    const lista = element('div', 'pasek-alarmow');
    uwagi.forEach((tekst) => {
      const w = element('p', 'pasek-alarmow__pozycja pasek-alarmow__pozycja--uwaga');
      w.appendChild(element('span', 'pasek-alarmow__znak', 'ℹ'));
      w.appendChild(element('span', 'pasek-alarmow__tekst', tekst));
      lista.appendChild(w);
    });
    stanKontener.appendChild(lista);
  }

  if (t) {
    const wiersze = element('div', 'lista-odczytow');
    const dodaj = (etykieta, wartosc, dopisek) => {
      const w = element('div', 'wiersz-odczytu');
      w.appendChild(element('span', 'wiersz-odczytu__medium', etykieta));
      const prawa = element('span', 'wiersz-odczytu__stan', wartosc);
      if (dopisek) prawa.appendChild(element('span', 'zbieracz__dopisek', dopisek));
      w.appendChild(prawa);
      wiersze.appendChild(w);
    };
    dodaj('Przełącznik', t.online === false ? 'offline' : t.przelacznik === 'on' ? 'włączony' : t.przelacznik === 'off' ? 'wyłączony' : '—');
    if (typeof t.bateria === 'number') dodaj('Bateria telefonu', `${t.bateria} %`, STANY_LADOWANIA[t.ladowanie] || '');
    if (t.trwa) {
      dodaj('Trwa ładowanie', `od ${godzinaZIso(t.trwa.start)}`,
        `${NAZWY_ZRODEL[t.trwa.zrodlo] || t.trwa.zrodlo}${typeof t.trwa.bateria_start === 'number' ? ` · start ${t.trwa.bateria_start} %` : ''}`);
    }
    dodaj('Ustawienia na telefonie',
      typeof t.wersja_zastosowana === 'number' ? `wersja ${t.wersja_zastosowana}` : '—',
      t.oczekuje ? 'czeka na telefon' : 'aktualne');
    if (t.wersja_zbieracza) dodaj('Zbieracz', t.wersja_zbieracza);
    stanKontener.appendChild(wiersze);
  }

  renderujOstatnie(wynik.ostatnie || [], t);
  uzupelnijKontrolki(k, t);
}

function renderujOstatnie(ostatnie, t) {
  listaLadowan.innerHTML = '';
  const pozycje = [];
  if (t && t.trwa) {
    pozycje.push({ lewa: `od ${dzienGodzinaZIso(t.trwa.start)}`, prawa: `${typeof t.trwa.bateria_start === 'number' ? t.trwa.bateria_start : '?'} % → …`,
      dopisek: `trwa · ${NAZWY_ZRODEL[t.trwa.zrodlo] || t.trwa.zrodlo}`, trwa: true });
  }
  ostatnie.forEach((s) => {
    const tenSamDzien = s.start.slice(0, 10) === s.koniec.slice(0, 10);
    const lewa = tenSamDzien
      ? `${dzienGodzinaZIso(s.start)}–${godzinaZIso(s.koniec)}`
      : `${dzienGodzinaZIso(s.start)} – ${dzienGodzinaZIso(s.koniec)}`;
    const baterie = (typeof s.bateria_start === 'number' && typeof s.bateria_koniec === 'number')
      ? `${s.bateria_start} → ${s.bateria_koniec} %` : '—';
    pozycje.push({ lewa, prawa: baterie,
      dopisek: `${opiszCzasTrwania(s.minut)}${s.minut === null ? '' : ' · '}${NAZWY_ZRODEL[s.zrodlo] || s.zrodlo}` });
  });
  if (pozycje.length === 0) {
    listaLadowan.appendChild(element('p', 'komunikat-pusto', 'Brak zapisanych ładowań — pierwsze pojawi się po synchronizacji z zbieraczem 1.6.'));
    return;
  }
  const lista = element('div', 'lista-odczytow');
  pozycje.forEach((p) => {
    const w = element('div', `wiersz-odczytu${p.trwa ? ' ladowarka__trwa' : ''}`);
    w.appendChild(element('span', 'wiersz-odczytu__medium ladowarka__przedzial', p.lewa));
    const prawa = element('span', 'wiersz-odczytu__stan', p.prawa);
    prawa.appendChild(element('span', 'zbieracz__dopisek', p.dopisek));
    w.appendChild(prawa);
    lista.appendChild(w);
  });
  listaLadowan.appendChild(lista);
}

// --- Kontrolki ----------------------------------------------------------------

function dodajOknoHarmonogramu(od = '', doGodz = '') {
  const wiersz = element('div', 'przedzial-cyrkulacji');
  const poleOd = element('input', 'ladowarka-okno-od');
  poleOd.type = 'time';
  poleOd.value = od;
  const poleDo = element('input', 'ladowarka-okno-do');
  poleDo.type = 'time';
  poleDo.value = doGodz;
  const usun = element('button', 'przycisk-usun-przedzial', '✕');
  usun.type = 'button';
  usun.setAttribute('aria-label', 'Usuń okno');
  usun.addEventListener('click', () => { wiersz.remove(); brudnyHarmonogram = true; odswiezPrzyciskDodajOkno(); });
  [poleOd, poleDo].forEach((p) => p.addEventListener('input', () => { brudnyHarmonogram = true; }));
  wiersz.append(poleOd, element('span', 'przedzial-cyrkulacji__lacznik', '–'), poleDo, usun);
  listaOkien.appendChild(wiersz);
  odswiezPrzyciskDodajOkno();
}

function odswiezPrzyciskDodajOkno() {
  przyciskDodajOkno.disabled = listaOkien.children.length >= MAKS_OKIEN;
}

function odczytajOkna() {
  return Array.from(listaOkien.querySelectorAll('.przedzial-cyrkulacji'))
    .map((w) => ({ od: w.querySelector('.ladowarka-okno-od').value, do: w.querySelector('.ladowarka-okno-do').value }))
    .filter((o) => o.od || o.do);   // pusty wiersz (kliknięte „dodaj”, potem rozmyślone) pomijamy
}

// Ustawia kontrolki wg konfiguracji z webhooka. Pola, które użytkownik właśnie edytuje
// (brudne), zostają — odświeżenie w tle nie może nadpisać wpisywanej wartości.
function uzupelnijKontrolki(k, t) {
  ustawSegment(segmentAktywne, k.aktywne ? 'tak' : 'nie');
  ustawSegment(segmentTryb, k.tryb);
  opisTrybu.textContent = `${OPISY_TRYBOW[k.tryb] || ''}${k.aktywne ? '' : ' Sterowanie jest wyłączone — telefon tylko zapisuje ładowania w logu.'}`;

  sekcjaProgow.classList.toggle('ladowarka__sekcja--nieaktywna', k.tryb !== 'auto');
  sekcjaHarmonogramu.classList.toggle('ladowarka__sekcja--nieaktywna', k.tryb !== 'harmonogram');
  sekcjaRecznego.classList.toggle('ladowarka__sekcja--nieaktywna', k.tryb !== 'reczny');

  if (!brudneProgi) {
    poleDolny.value = k.dolny;
    poleGorny.value = k.gorny;
  }
  if (!brudnyHarmonogram) {
    listaOkien.innerHTML = '';
    (k.harmonogram || []).forEach((o) => dodajOknoHarmonogramu(o.od, o.do));
    odswiezPrzyciskDodajOkno();
  }

  const reczneDostepne = k.tryb === 'reczny' && k.aktywne;
  przyciskWlacz.disabled = !reczneDostepne || zapisuje;
  przyciskWylacz.disabled = !reczneDostepne || zapisuje;
  let opis = reczneDostepne
    ? 'Polecenie dojdzie do telefonu w ciągu ok. 5 minut.'
    : 'Dostępne w trybie „Ręczny” przy włączonym sterowaniu.';
  if (k.polecenie) {
    const wykonane = t && typeof t.polecenie_zastosowane === 'number' && t.polecenie_zastosowane >= k.polecenie.id;
    opis += ` Ostatnie polecenie: ${k.polecenie.stan === 'on' ? 'włącz' : 'wyłącz'} (${dzienGodzinaZIso(k.polecenie.czas)}) — ${wykonane ? 'wykonane' : 'czeka na telefon'}.`;
  }
  opisPolecenia.textContent = opis;
}

// --- Zapis --------------------------------------------------------------------

function blokujPrzyciski(blokada) {
  zapisuje = blokada;
  ekranLadowarki.querySelectorAll('button').forEach((p) => {
    if (p === przyciskZamknij) return;
    if (blokada) {
      p.dataset.byloWylaczone = String(p.disabled);
      p.disabled = true;
    } else if (p.dataset.byloWylaczone !== undefined) {
      p.disabled = p.dataset.byloWylaczone === 'true';
      delete p.dataset.byloWylaczone;
    }
  });
}

// Wysyła zmianę i odświeża widok odpowiedzią serwera (`konfiguracja` po zmianie).
// `poSukcesie` (opcjonalne) działa PRZED odświeżeniem widoku — tam gasimy flagi „edytowane”,
// żeby odpowiedź serwera mogła uzupełnić pola. Zwraca true, gdy zapisano.
async function zapisz(zmiany, komunikatSukcesu, poSukcesie) {
  if (zapisuje) return false;
  ustawKomunikat('');
  blokujPrzyciski(true);
  try {
    const odpowiedz = await zapiszKonfiguracjeLadowarki(zmiany);
    if (!odpowiedz.ok) throw new Error(odpowiedz.blad || 'webhook odrzucił zmianę');
    wyczyscBuforKlucz('ladowarka');
    if (poSukcesie) poSukcesie();
    blokujPrzyciski(false);
    if (ostatniWynik) {
      renderujStan({ ...ostatniWynik, konfiguracja: odpowiedz.konfiguracja,
        telefon: ostatniWynik.telefon ? { ...ostatniWynik.telefon, oczekuje: true } : null });
    }
    ustawKomunikat(komunikatSukcesu, 'sukces');
    powiadomOZmianieDanych();
    return true;
  } catch (wyjatek) {
    blokujPrzyciski(false);
    ustawKomunikat(wyjatek.message === 'Failed to fetch'
      ? 'Brak połączenia — nie zapisano. Spróbuj ponownie.' : wyjatek.message);
    if (ostatniWynik) uzupelnijKontrolki(ostatniWynik.konfiguracja, ostatniWynik.telefon);
    return false;
  }
}

segmentAktywne.querySelectorAll('.segment-tryb__opcja').forEach((opcja) => opcja.addEventListener('click', async () => {
  const wlacz = opcja.dataset.wartosc === 'tak';
  if (!ostatniWynik || ostatniWynik.konfiguracja.aktywne === wlacz) return;
  if (wlacz) {
    const k = ostatniWynik.konfiguracja;
    const co = k.tryb === 'auto' ? `progi ${k.dolny} % / ${k.gorny} %`
      : k.tryb === 'harmonogram' ? 'okna z harmonogramu' : 'tylko polecenia ręczne';
    if (!window.confirm(`Włączyć sterowanie? Telefon zacznie sam włączać i wyłączać ładowarkę (tryb: ${k.tryb}, ${co}).`)) return;
  }
  await zapisz({ aktywne: wlacz }, wlacz ? 'Sterowanie włączone.' : 'Sterowanie wyłączone — telefon tylko zapisuje ładowania.');
}));

segmentTryb.querySelectorAll('.segment-tryb__opcja').forEach((opcja) => opcja.addEventListener('click', async () => {
  const tryb = opcja.dataset.wartosc;
  if (!ostatniWynik || ostatniWynik.konfiguracja.tryb === tryb) return;
  await zapisz({ tryb }, `Tryb: ${tryb}.`);
}));

[poleDolny, poleGorny].forEach((p) => p.addEventListener('input', () => { brudneProgi = true; }));

formularzProgow.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const dolny = Number(poleDolny.value);
  const gorny = Number(poleGorny.value);
  if (!Number.isInteger(dolny) || !Number.isInteger(gorny)) return ustawKomunikat('Progi muszą być liczbami całkowitymi.');
  if (dolny < DOLNY_MIN) return ustawKomunikat(`Dolny próg nie może być niższy niż ${DOLNY_MIN} %.`);
  if (gorny > GORNY_MAX) return ustawKomunikat(`Górny próg nie może być wyższy niż ${GORNY_MAX} %.`);
  if (gorny - dolny < MIN_ROZSTEP) return ustawKomunikat(`Górny próg musi być wyższy od dolnego o co najmniej ${MIN_ROZSTEP} punktów.`);
  await zapisz({ dolny, gorny }, `Progi zapisane: włącz ≤ ${dolny} %, wyłącz ≥ ${gorny} %.`, () => { brudneProgi = false; });
});

przyciskDodajOkno.addEventListener('click', () => { dodajOknoHarmonogramu(); brudnyHarmonogram = true; });

formularzHarmonogramu.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const okna = odczytajOkna();
  if (okna.some((o) => !o.od || !o.do)) return ustawKomunikat('Uzupełnij godziny „od” i „do” w każdym oknie albo usuń puste.');
  if (okna.some((o) => o.od === o.do)) return ustawKomunikat('Godzina „od” musi różnić się od „do”.');
  if (okna.length > MAKS_OKIEN) return ustawKomunikat(`Najwyżej ${MAKS_OKIEN} okien.`);
  await zapisz({ harmonogram: okna }, okna.length === 0
    ? 'Harmonogram zapisany: bez okien (w trybie „Harmonogram” ładowanie nie włączy się wcale).'
    : `Harmonogram zapisany (${okna.length} ${okna.length === 1 ? 'okno' : 'okna'}).`,
  () => { brudnyHarmonogram = false; });
});

przyciskWlacz.addEventListener('click', () => zapisz({ polecenie: 'on' }, 'Polecenie „włącz” wysłane — telefon wykona je w ciągu ok. 5 minut.'));
przyciskWylacz.addEventListener('click', () => zapisz({ polecenie: 'off' }, 'Polecenie „wyłącz” wysłane — telefon wykona je w ciągu ok. 5 minut.'));

// --- Wczytywanie i otwieranie ------------------------------------------------

function wczytaj() {
  generacja++;
  const biezaca = generacja;
  wczytajBlokPodgladu(() => biezaca === generacja, {
    status: statusLadowarki,
    klucz: 'ladowarka',
    pobierz: pobierzStanLadowarki,
    renderuj: renderujStan,
  });
}

function zatrzymajOdswiezanie() {
  if (odswiezanie !== null) {
    clearInterval(odswiezanie);
    odswiezanie = null;
  }
}

function otworz() {
  ukryjKomunikatStart();
  ostatniWynik = null;
  brudneProgi = false;
  brudnyHarmonogram = false;
  stanKontener.innerHTML = '';
  listaLadowan.innerHTML = '';
  ustawKomunikat('');
  pokazEkran(ekranLadowarki);
  wczytaj();
  // Polecenie ręczne i zmiana ustawień dochodzą do telefonu w ≤5 min — ekran odświeża
  // się sam (raz na minutę, jak pulpit), żeby było widać skutek bez wychodzenia.
  zatrzymajOdswiezanie();
  odswiezanie = setInterval(() => {
    if (ekranLadowarki.classList.contains('ukryty') || document.hidden || zapisuje) return;
    wczytaj();
  }, ODSWIEZANIE_MS);
}

function zamknij() {
  zatrzymajOdswiezanie();
  generacja++;   // spóźniona odpowiedź nie narysuje się na zamkniętym ekranie
  pokazEkran(ekranZbieracza);
}

przyciskOtworz.addEventListener('click', poUstawieniach(otworz));
przyciskZamknij.addEventListener('click', zamknij);
