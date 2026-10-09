// Ekran Kocioł: formularz zmiany nastaw (dziennik zmian, nie okresowy odczyt),
// podpowiedź ostatnich nastaw pobierana z wyprzedzeniem i zapis (z kolejką
// offline). Historia zmian pod formularzem: kociol-historia.js.

import { czyUstawieniaZapisane } from '../ustawienia.js';
import { zapiszKociol, pobierzOstatnieNastawyKotla } from '../webhook.js';
import { dodajDoKolejki } from '../kolejka.js';
import { aktualizujKomunikatKolejki } from '../kolejka-wysylka.js';
import { sformatujDataGodzinaLokalnie, MIN_ODSTEP_POBRANIA_MS } from '../wspolne.js';
import {
  ETYKIETY_TRYBU, obwodyTrybu, liczbaAlboNull, dopelnijGodzine, serializujCyrkulacje,
  sparsujCyrkulacje, czyTeSameNastawy,
} from '../nastawy.js';
import {
  pokazEkran, ekranStart, pokazKomunikatStart, ukryjKomunikatStart, naPowrotNaStart, naZmianieUstawien,
} from '../nawigacja.js';
import { otworzUstawienia } from './ustawienia.js';
import { otworzHistorieKotla } from './kociol-historia.js';

const ekranKociol = document.getElementById('ekran-kociol');
const przyciskKociol = document.getElementById('przycisk-kociol');
const formularzKotla = document.getElementById('formularz-kotla');
const segmentTryb = document.getElementById('segment-tryb');
const wskaznikTrybu = segmentTryb.querySelector('.segment-tryb__wskaznik');
const opcjeTrybu = Array.from(segmentTryb.querySelectorAll('.segment-tryb__opcja'));
const poleKrzywa = document.getElementById('pole-krzywa');
const polePrzesuniecie = document.getElementById('pole-przesuniecie');
const poleTempCwu = document.getElementById('pole-temp-cwu');
const listaCyrkulacji = document.getElementById('lista-cyrkulacji');
const przyciskDodajPrzedzial = document.getElementById('przycisk-dodaj-przedzial');
const poleObowiazujeOd = document.getElementById('pole-obowiazuje-od');
const przyciskZapiszKociol = document.getElementById('przycisk-zapisz-kociol');
const przyciskAnulujKociol = document.getElementById('przycisk-anuluj-kociol');
const komunikatKotla = document.getElementById('komunikat-kotla');

// Nastawy pobrane z webhooka przy otwarciu ekranu — punkt odniesienia do
// wykrywania, czy formularz w ogóle się różni (wpis ma sens tylko wtedy).
// null = brak punktu odniesienia (pusty arkusz albo offline) — wtedy nie
// blokujemy wysyłki, bo nie ma z czym porównać.
let ostatnieNastawyKotla = null;
// Rośnie przy każdym otwarciu karty „Kocioł” — pozwala wczytajOstatnieNastawyKotla
// poznać, że użytkownik zdążył zamknąć/otworzyć ekran ponownie, zanim
// odpowiedź webhooka wróciła, i nie nadpisywać pól nieaktualną odpowiedzią.
let generacjaKotla = 0;

// Pobieranie nastaw kotła Z WYPRZEDZENIEM (BACKLOG pkt 12): aplikacja pyta
// webhook o ostatnie nastawy już przy starcie i przy powrocie na ekran startowy,
// żeby po dotknięciu kafelka „Kocioł” dane były gotowe od razu. Wynik trzymamy
// WYŁĄCZNIE w pamięci (nie w localStorage) i przez krótki czas — nastawy
// wypełniają formularz, więc nieaktualna podpowiedź z poprzedniej sesji
// mogłaby skłonić do zapisania złej zmiany.
const MAKS_WIEK_NASTAW_MS = 5 * 60 * 1000;   // starsze niż to → czekamy na świeże
let nastawyKotlaZWyprzedzeniem = null;       // { czas, wynik } — odpowiedź ostatni_kociol
let pobieranieNastawKotla = null;            // trwające żądanie (Promise) albo null
// Rośnie, gdy wynik przestaje być wiarygodny (zapis nastaw, zmiana ustawień) —
// spóźniona odpowiedź z żądania rozpoczętego przed unieważnieniem jest wtedy
// wyrzucana, zamiast wrócić do pamięci jako nieaktualna.
let wersjaNastawKotla = 0;
let czasOstatniejProbyNastawKotla = 0;       // kiedy ostatnio (nie)udanie pytaliśmy webhook

// --- Kocioł: dziennik zmian nastaw, nie okresowy odczyt ------------------
//
// Cyrkulacja to zero, jeden albo kilka przedziałów czasu na dobę — trzymamy
// je jako wiersze w DOM (dodawane/usuwane przyciskiem) i przy zapisie
// spłaszczamy do jednego tekstu w komórce arkusza: "4:30 - 22:00" — bez
// zera wiodącego przy godzinie i ze spacjami wokół myślnika, dokładnie tak,
// jak wpisy zaimportowane wcześniej ręcznie do zakładki "kociol". Kilka
// przedziałów w jednej dobie sklejamy średnikiem ze spacją
// ("4:30 - 9:00; 18:00 - 22:00") — tak jak w archiwum (decyzja 2026-10-08,
// dokumentacja/decyzje.md D5; do 1.1.0 PWA sklejała przecinkiem).

// Segmentowy przełącznik trybu (zastępuje dawny <select>) — jeden przycisk
// jest zaznaczony (aria-checked), a przesuwany wskaźnik pod spodem dojeżdża
// pod jego realną pozycję. Liczymy ją z offsetLeft/offsetWidth przycisku
// zamiast ze sztywnych procentów, żeby nie rozjechało się przy zmianie
// szerokości ekranu czy długości etykiet.
function przesunWskaznikTrybu(przycisk) {
  wskaznikTrybu.style.width = `${przycisk.offsetWidth}px`;
  wskaznikTrybu.style.transform = `translateX(${przycisk.offsetLeft}px)`;
}

function ustawTryb(wartosc) {
  const wybrany = opcjeTrybu.find((p) => p.dataset.wartosc === wartosc) || opcjeTrybu[0];
  opcjeTrybu.forEach((p) => p.setAttribute('aria-checked', String(p === wybrany)));
  przesunWskaznikTrybu(wybrany);
  zastosujRegulyPolKotla();
}

// Wyszarzanie zbędnych pól: bez CO nie ma krzywej ani przesunięcia, bez CWU
// nie ma temperatury CWU — tak wygląda też całe archiwum w zakładce `kociol`
// (tryb `cwu` ma pustą krzywą i przesunięcie, `off` — wszystkie trzy puste).
// Cyrkulacji nie ruszamy: w archiwum jest wpisana także przy trybie `off`.
//
// Pole zablokowane jest czyszczone, ale jego wartość chowamy w data-schowane
// i przywracamy, gdy obwód wróci — przeklikanie trybu tam i z powrotem nie
// kasuje więc wpisanej krzywej. Schowek zeruje się przy każdym otwarciu ekranu.
const POLA_OBWODOW = [
  { pole: poleKrzywa, obwod: 'co' },
  { pole: polePrzesuniecie, obwod: 'co' },
  { pole: poleTempCwu, obwod: 'cwu' },
];
let wczytywanieKotla = false;   // w trakcie wczytywania wszystkie pola i tak są zablokowane

function zastosujRegulyPolKotla() {
  const obwody = obwodyTrybu(pobierzTryb());
  POLA_OBWODOW.forEach(({ pole, obwod }) => {
    const potrzebne = obwody[obwod];
    if (!potrzebne && pole.value !== '') {
      pole.dataset.schowane = pole.value;
      pole.value = '';
    } else if (potrzebne && pole.value === '' && pole.dataset.schowane) {
      pole.value = pole.dataset.schowane;
    }
    if (potrzebne) delete pole.dataset.schowane;
    pole.disabled = wczytywanieKotla || !potrzebne;
    pole.closest('.pole-formularza').classList.toggle('pole-formularza--nieaktywne', !potrzebne);
  });
}

function wyczyscSchowanePolaKotla() {
  POLA_OBWODOW.forEach(({ pole }) => { delete pole.dataset.schowane; });
}

function pobierzTryb() {
  return (opcjeTrybu.find((p) => p.getAttribute('aria-checked') === 'true') || opcjeTrybu[0]).dataset.wartosc;
}

opcjeTrybu.forEach((przycisk) => {
  przycisk.addEventListener('click', () => ustawTryb(przycisk.dataset.wartosc));
});

// Przy starcie wskaźnik musi trafić pod domyślnie zaznaczony przycisk —
// bez tego stałby w lewym górnym rogu (szerokość/pozycja z JS, nie CSS).
ustawTryb('off');

function dodajPrzedzialCyrkulacji(godzinaOd = '', godzinaDo = '') {
  const wiersz = document.createElement('div');
  wiersz.className = 'przedzial-cyrkulacji';
  wiersz.innerHTML = `
    <input type="time" class="cyrkulacja-od" value="${dopelnijGodzine(godzinaOd)}">
    <span class="przedzial-cyrkulacji__lacznik">–</span>
    <input type="time" class="cyrkulacja-do" value="${dopelnijGodzine(godzinaDo)}">
    <button type="button" class="przycisk-usun-przedzial" aria-label="Usuń przedział">✕</button>
  `;
  wiersz.querySelector('.przycisk-usun-przedzial').addEventListener('click', () => wiersz.remove());
  listaCyrkulacji.appendChild(wiersz);
}

przyciskDodajPrzedzial.addEventListener('click', () => dodajPrzedzialCyrkulacji());

// Tylko przedziały z obiema wypełnionymi godzinami — pusty wiersz (ktoś
// kliknął "dodaj" i się rozmyślił) po prostu pomijamy przy zapisie.
function odczytajPrzedzialyCyrkulacji() {
  return Array.from(listaCyrkulacji.querySelectorAll('.przedzial-cyrkulacji'))
    .map((wiersz) => ({
      od: wiersz.querySelector('.cyrkulacja-od').value,
      do: wiersz.querySelector('.cyrkulacja-do').value,
    }))
    .filter((p) => p.od && p.do);
}

// Blokuje pola formularza na czas wczytywania podpowiedzi — bez tego,
// na wolniejszym połączeniu, użytkownik mógł zdążyć coś wpisać zanim
// odpowiedź webhooka przyszła i po cichu nadpisała jego wpis.
function ustawWczytywanieKotla(wTrakcie) {
  wczytywanieKotla = wTrakcie;
  opcjeTrybu.forEach((p) => { p.disabled = wTrakcie; });
  // Pola krzywej, przesunięcia i temperatury CWU: blokada na czas wczytywania,
  // a po nim — według trybu (zastosujRegulyPolKotla).
  zastosujRegulyPolKotla();
  przyciskDodajPrzedzial.disabled = wTrakcie;
  przyciskZapiszKociol.disabled = wTrakcie;
  if (wTrakcie) {
    komunikatKotla.textContent = 'Wczytywanie ostatnich nastaw…';
    komunikatKotla.classList.remove('ukryty');
  } else {
    komunikatKotla.classList.add('ukryty');
  }
}

// Jedno wspólne żądanie o ostatnie nastawy: jeśli już trwa (np. rozpoczęte
// z wyprzedzeniem przy starcie), każdy kolejny chętny dołącza do tego samego,
// zamiast wysyłać drugie. Zwraca odpowiedź webhooka; do pamięci trafia tylko
// odpowiedź poprawna (ok: true) i nieunieważniona w międzyczasie.
function pobierzNastawyKotla() {
  if (pobieranieNastawKotla) return pobieranieNastawKotla;
  czasOstatniejProbyNastawKotla = Date.now();
  const wersja = wersjaNastawKotla;
  const zadanie = pobierzOstatnieNastawyKotla()
    .then((wynik) => {
      if (wynik.ok && wersja === wersjaNastawKotla) {
        nastawyKotlaZWyprzedzeniem = { czas: Date.now(), wynik };
      }
      return wynik;
    })
    .finally(() => {
      if (pobieranieNastawKotla === zadanie) pobieranieNastawKotla = null;
    });
  pobieranieNastawKotla = zadanie;
  return zadanie;
}

// Ciche pobranie w tle — start aplikacji, powrót na ekran startowy, powrót
// aplikacji na pierwszy plan. Nie częściej niż raz na minutę, żeby nie
// zasypywać webhooka (Apps Script przy serii szybkich żądań bywa kapryśny),
// a błąd (offline) jest tu zwyczajnie ignorowany — ekran Kocioł sprawdzi sam.
function odswiezNastawyKotlaWTle() {
  if (!czyUstawieniaZapisane()) return;
  if (pobieranieNastawKotla) return;
  if (Date.now() - czasOstatniejProbyNastawKotla < MIN_ODSTEP_POBRANIA_MS) return;
  pobierzNastawyKotla().catch((blad) => {
    console.error('Pobranie nastaw kotła z wyprzedzeniem nie powiodło się:', blad);
  });
}

// Po zapisie nastaw albo zmianie ustawień to, co mamy w pamięci, przestaje
// być wiarygodne — wyrzucamy je i pozwalamy od razu pobrać nowe.
function uniewaznNastawyKotla() {
  wersjaNastawKotla++;
  nastawyKotlaZWyprzedzeniem = null;
  pobieranieNastawKotla = null;
  czasOstatniejProbyNastawKotla = 0;
}

async function wczytajOstatnieNastawyKotla(generacja) {
  try {
    // Gotowe z wyprzedzenia i niezbyt stare → wypełniamy formularz od ręki,
    // bez czekania (i bez blokady pól, bo ta zdejmuje się w finally poniżej,
    // zanim ktokolwiek zdąży cokolwiek wpisać). W przeciwnym razie dołączamy
    // do trwającego pobierania albo zaczynamy nowe — jak dawniej.
    const gotowe = nastawyKotlaZWyprzedzeniem;
    const swieze = gotowe && Date.now() - gotowe.czas <= MAKS_WIEK_NASTAW_MS;
    const wynik = swieze ? gotowe.wynik : await pobierzNastawyKotla();
    if (generacja !== generacjaKotla) return; // ekran zdążył się zmienić

    if (!wynik.ok || wynik.brak) {
      ostatnieNastawyKotla = null; // pusty arkusz — nie ma punktu odniesienia
      return;
    }

    poleKrzywa.value = wynik.krzywa_grzewcza ?? '';
    polePrzesuniecie.value = wynik.przesuniecie ?? '';
    poleTempCwu.value = wynik.temp_cwu ?? '';
    listaCyrkulacji.innerHTML = '';
    sparsujCyrkulacje(wynik.cyrkulacja).forEach((p) => dodajPrzedzialCyrkulacji(p.od, p.do));
    // Tryb PO wartościach — reguły pól działają na tym, co już jest wpisane
    // (gdyby w arkuszu przy `cwu` była krzywa, trafi do schowka, nie do wysyłki).
    ustawTryb(wynik.tryb || 'off');

    ostatnieNastawyKotla = {
      tryb: wynik.tryb || 'off',
      krzywa_grzewcza: wynik.krzywa_grzewcza ?? null,
      przesuniecie: wynik.przesuniecie ?? null,
      temp_cwu: wynik.temp_cwu ?? null,
      // Przepuszczone przez sparsuj + serializuj — tak samo jak to, co wyśle
      // formularz. Inaczej sam inny zapis tego samego (separator, zero
      // wiodące) wyglądałby jak zmiana nastaw i dałby zbędny wpis w `kociol`.
      cyrkulacja: serializujCyrkulacje(sparsujCyrkulacje(wynik.cyrkulacja).map((p) => ({
        od: dopelnijGodzine(p.od), do: dopelnijGodzine(p.do),
      })).filter((p) => p.od && p.do)),
    };
  } catch (blad) {
    // Offline albo webhook nie odpowiada — zostajemy przy pustym formularzu
    // i nie blokujemy wysyłki, bo nie mamy z czym porównać.
    if (generacja !== generacjaKotla) return;
    console.error('Nie udało się pobrać poprzednich nastaw kotła:', blad);
    ostatnieNastawyKotla = null;
  } finally {
    if (generacja === generacjaKotla) ustawWczytywanieKotla(false);
  }
}

function otworzKociol() {
  ukryjKomunikatStart();
  generacjaKotla++;
  poleKrzywa.value = '';
  polePrzesuniecie.value = '';
  poleTempCwu.value = '';
  poleObowiazujeOd.value = sformatujDataGodzinaLokalnie(new Date());
  listaCyrkulacji.innerHTML = '';
  wyczyscSchowanePolaKotla();
  ostatnieNastawyKotla = null;
  pokazEkran(ekranKociol);
  // Wskaźnik trybu liczy swoją pozycję z realnych wymiarów przycisku
  // (offsetLeft/offsetWidth) — musi więc zostać ustawiony PO pokazEkran,
  // bo ukryty (display: none) ekran zwraca zerowe wymiary.
  ustawTryb('off');
  ustawWczytywanieKotla(true);
  wczytajOstatnieNastawyKotla(generacjaKotla);

  // Historia zmian — niezależnie od podpowiedzi formularza: własne żądanie,
  // własny wiersz statusu i bufor, tak jak bloki Podglądu.
  const generacja = generacjaKotla;
  otworzHistorieKotla(() => generacja === generacjaKotla);
}

przyciskKociol.addEventListener('click', () => {
  if (!czyUstawieniaZapisane()) {
    otworzUstawienia();
    return;
  }
  otworzKociol();
});

przyciskAnulujKociol.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

formularzKotla.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();

  const daneKotla = {
    tryb: pobierzTryb(),
    krzywa_grzewcza: liczbaAlboNull(poleKrzywa.value),
    przesuniecie: liczbaAlboNull(polePrzesuniecie.value),
    temp_cwu: liczbaAlboNull(poleTempCwu.value),
    cyrkulacja: serializujCyrkulacje(odczytajPrzedzialyCyrkulacji()),
    obowiazuje_od: `${poleObowiazujeOd.value}:00`,
  };

  if (ostatnieNastawyKotla && czyTeSameNastawy(ostatnieNastawyKotla, daneKotla)) {
    komunikatKotla.textContent = 'Brak zmian względem poprzednich nastaw — nic nie wysłano.';
    komunikatKotla.classList.remove('ukryty');
    return;
  }

  komunikatKotla.classList.add('ukryty');
  przyciskZapiszKociol.disabled = true;
  przyciskZapiszKociol.textContent = 'Wysyłanie…';

  try {
    const odpowiedz = await zapiszKociol(daneKotla);

    if (!odpowiedz.ok) {
      komunikatKotla.textContent = odpowiedz.blad || 'Webhook odrzucił zmianę nastaw.';
      komunikatKotla.classList.remove('ukryty');
      return;
    }

    pokazKomunikatStart(`Zapisano zmianę nastaw kotła: ${ETYKIETY_TRYBU[daneKotla.tryb] || daneKotla.tryb}.`);
    uniewaznNastawyKotla();   // powrót na ekran startowy pobierze świeże nastawy
    pokazEkran(ekranStart);
  } catch (blad) {
    // Brak sieci — jak przy odczytach, dokładamy do wspólnej kolejki offline.
    console.error('Nie udało się wysłać zmiany nastaw kotła, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'zmiana_kotla', ...daneKotla });
    aktualizujKomunikatKolejki();
    // Punktem odniesienia na najbliższe otwarcia są teraz nastawy, które
    // właśnie zapisaliśmy lokalnie (arkusz jeszcze ich nie zna) — inaczej
    // ekran podpowiedziałby stare i pozwolił wysłać tę samą zmianę drugi raz.
    uniewaznNastawyKotla();
    nastawyKotlaZWyprzedzeniem = { czas: Date.now(), wynik: { ok: true, brak: false, ...daneKotla } };
    czasOstatniejProbyNastawKotla = Date.now();
    // Jak przy odczytach: to nie musi być brak internetu, a zapis mógł dojść.
    const przyczyna = navigator.onLine ? 'brak odpowiedzi serwera' : 'brak połączenia';
    pokazKomunikatStart(`Nie udało się potwierdzić zapisu (${przyczyna}) — zmiana nastaw kotła ` +
      'zapisana lokalnie. Aplikacja wyśle ją sama albo sprawdzi, że już doszła.');
    pokazEkran(ekranStart);
  } finally {
    przyciskZapiszKociol.disabled = false;
    przyciskZapiszKociol.textContent = 'Zapisz zmianę';
  }
});

// Przy starcie, powrocie na ekran startowy i z tła — z wyprzedzeniem pobieramy
// nastawy; po zmianie ustawień (inny arkusz) wyrzucamy te z pamięci.
naPowrotNaStart(odswiezNastawyKotlaWTle);
naZmianieUstawien(uniewaznNastawyKotla);
