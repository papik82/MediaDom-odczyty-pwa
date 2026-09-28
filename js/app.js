// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków,
// formularza ustawień, ekranu potwierdzenia odczytu i wysyłki do webhooka.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import { MEDIA, MEDIA_ZE_ZDJECIEM } from './media.js';
import {
  wyslij, wyslijOdczyt, rozpoznajZdjecie, zapiszKociol, pobierzOstatnieNastawyKotla,
  pobierzOstatnieOdczyty, pobierzTemperaturyDobowe, pobierzHistorieKotla,
} from './webhook.js';
import { zrobZdjecie, wybierzZGalerii, blobDoBase64 } from './aparat.js';
import { dodajDoKolejki, liczbaWKolejce, pobierzKolejke, usunPierwszyZKolejki } from './kolejka.js';
import {
  zapiszBufor, odczytajBufor, wyczyscBufor, wyczyscBuforKlucz, opiszWiek,
} from './bufor.js';

document.getElementById('numer-wersji').textContent = WERSJA_APLIKACJI;

const ekranStart = document.getElementById('ekran-start');
const ekranUstawien = document.getElementById('ekran-ustawienia');
const ekranWyboruMetody = document.getElementById('ekran-wybor-metody');
const ekranPotwierdzenia = document.getElementById('ekran-potwierdzenia');
const wyborMetodyTytul = document.getElementById('wybor-metody-tytul');
const przyciskZdjecie = document.getElementById('przycisk-zdjecie');
const przyciskGaleria = document.getElementById('przycisk-galeria');
const przyciskRecznie = document.getElementById('przycisk-recznie');
const przyciskAnulujWybor = document.getElementById('przycisk-anuluj-wybor');
const podgladZdjecia = document.getElementById('podglad-zdjecia');
const przyciskHome = document.getElementById('przycisk-home');
const przyciskUstawienia = document.getElementById('przycisk-ustawienia');
const przyciskAnuluj = document.getElementById('przycisk-anuluj');
const formularzUstawien = document.getElementById('formularz-ustawien');
const poleAdres = document.getElementById('pole-adres');
const poleToken = document.getElementById('pole-token');
const komunikatUstawien = document.getElementById('komunikat-ustawien');
const komunikatStart = document.getElementById('komunikat-start');
const komunikatKolejka = document.getElementById('komunikat-kolejka');
// Karty mediów rozpoznajemy po atrybucie data-medium, a nie po klasie —
// Kocioł i Podgląd mają tę samą klasę `karta`, ale nie są mediami.
const kafelki = document.querySelectorAll('.karta[data-medium]');

const potwierdzenieTytul = document.getElementById('potwierdzenie-tytul');
const potwierdzenieJednostka = document.getElementById('potwierdzenie-jednostka');
const formularzPotwierdzenia = document.getElementById('formularz-potwierdzenia');
const poleStan = document.getElementById('pole-stan');
const poleDataGodzina = document.getElementById('pole-data-godzina');
const przyciskAnulujPotwierdzenie = document.getElementById('przycisk-anuluj-potwierdzenie');
const przyciskZatwierdz = document.getElementById('przycisk-zatwierdz');
const komunikatPotwierdzenia = document.getElementById('komunikat-potwierdzenia');
const uwagaCzasu = document.getElementById('uwaga-czasu');

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
const statusHistoriiKotla = document.getElementById('status-historii-kotla');
const historiaKotla = document.getElementById('historia-kotla');

const ekranPodglad = document.getElementById('ekran-podglad');
const przyciskPodglad = document.getElementById('przycisk-podglad');
const przyciskZamknijPodglad = document.getElementById('przycisk-zamknij-podglad');
const listaOstatnichOdczytow = document.getElementById('lista-ostatnich-odczytow');
const tabelaTemperatur = document.getElementById('tabela-temperatur');
const statusOdczytow = document.getElementById('status-odczytow');
const statusTemperatur = document.getElementById('status-temperatur');

const ETYKIETY_TRYBU = { off: 'Wyłączony', cwu: 'CWU', co: 'CO', cwu_co: 'CWU + CO' };

// Tryb rozłożony na dwa obwody: CO (ogrzewanie) i CWU (ciepła woda). Z tego
// korzysta formularz (które pola mają sens) i historia zmian (paski, opisy).
// Stoi tu, na górze, bo ustawTryb woła je już przy starcie modułu.
const OBWODY_TRYBU = {
  off: { co: false, cwu: false },
  cwu: { co: false, cwu: true },
  co: { co: true, cwu: false },
  cwu_co: { co: true, cwu: true },
};

function obwodyTrybu(tryb) {
  return OBWODY_TRYBU[tryb] || { co: false, cwu: false };
}

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
const MIN_ODSTEP_POBRANIA_MS = 60 * 1000;    // nie pytaj webhooka częściej niż raz na minutę
let nastawyKotlaZWyprzedzeniem = null;       // { czas, wynik } — odpowiedź ostatni_kociol
let pobieranieNastawKotla = null;            // trwające żądanie (Promise) albo null
// Rośnie, gdy wynik przestaje być wiarygodny (zapis nastaw, zmiana ustawień) —
// spóźniona odpowiedź z żądania rozpoczętego przed unieważnieniem jest wtedy
// wyrzucana, zamiast wrócić do pamięci jako nieaktualna.
let wersjaNastawKotla = 0;
let czasOstatniejProbyNastawKotla = 0;       // kiedy ostatnio (nie)udanie pytaliśmy webhook

let wybraneMedium = null;
let metodaAktualnegoOdczytu = 'reczny';
let adresUrlPodgladuZdjecia = null;
// Rośnie przy każdym otwarciu ekranu potwierdzenia — pozwala rozpoznajIWypelnij
// poznać, że użytkownik zdążył zamknąć ten ekran (albo otworzyć kolejny),
// zanim odpowiedź modelu wróciła, i nie wpisywać wyniku w złe miejsce.
let generacjaPotwierdzenia = 0;
// Ta sama rola co generacjaKotla/generacjaPotwierdzenia — chroni podgląd
// przed nadpisaniem przez odpowiedź z poprzedniego, już zamkniętego otwarcia.
let generacjaPodgladu = 0;

function pokazEkran(ekranDoPokazania) {
  for (const ekran of [ekranStart, ekranUstawien, ekranWyboruMetody, ekranPotwierdzenia, ekranKociol, ekranPodglad]) {
    ekran.classList.toggle('ukryty', ekran !== ekranDoPokazania);
  }
  // Każdy powrót na ekran startowy (i start aplikacji) to okazja, żeby
  // z wyprzedzeniem odświeżyć nastawy kotła — patrz odswiezNastawyKotlaWTle.
  if (ekranDoPokazania === ekranStart) odswiezNastawyKotlaWTle();
}

// Format wymagany przez <input type="datetime-local">: "RRRR-MM-DDTGG:MM",
// czas lokalny — inaczej niż toISOString(), które liczy w UTC.
function sformatujDataGodzinaLokalnie(data) {
  const dwieCyfry = (liczba) => String(liczba).padStart(2, '0');
  const rok = data.getFullYear();
  const miesiac = dwieCyfry(data.getMonth() + 1);
  const dzien = dwieCyfry(data.getDate());
  const godzina = dwieCyfry(data.getHours());
  const minuta = dwieCyfry(data.getMinutes());
  return `${rok}-${miesiac}-${dzien}T${godzina}:${minuta}`;
}

// Przycisk „Anuluj” ma sens tylko wtedy, gdy jest do czego wracać —
// przy pierwszym uruchomieniu, bez zapisanych ustawień, go ukrywamy.
function otworzUstawienia() {
  const ustawienia = odczytajUstawienia();
  poleAdres.value = ustawienia ? ustawienia.adresWebhooka : '';
  poleToken.value = ustawienia ? ustawienia.token : '';
  przyciskAnuluj.classList.toggle('ukryty', !czyUstawieniaZapisane());
  komunikatUstawien.classList.add('ukryty');
  pokazEkran(ekranUstawien);
}

przyciskUstawienia.addEventListener('click', otworzUstawienia);

// Przycisk „home” jest widoczny na każdym ekranie i zawsze wraca do
// kafelków — sprząta podgląd zdjęcia, żeby nie zostawiać wycieku URL-a,
// gdy ktoś wyjdzie w trakcie robienia zdjęcia.
przyciskHome.addEventListener('click', () => {
  zwolnijPodgladZdjecia();
  pokazEkran(ekranStart);
});

przyciskAnuluj.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

formularzUstawien.addEventListener('submit', (zdarzenie) => {
  zdarzenie.preventDefault();
  zapiszUstawienia(poleAdres.value, poleToken.value);
  // Nowy adres/token to potencjalnie inny arkusz — dane z poprzedniego
  // nie mogą się pokazać ani w buforze Podglądu, ani jako nastawy kotła.
  wyczyscBufor();
  uniewaznNastawyKotla();
  pokazEkran(ekranStart);
});

// --- Kocioł: dziennik zmian nastaw, nie okresowy odczyt ------------------
//
// Cyrkulacja to zero, jeden albo kilka przedziałów czasu na dobę — trzymamy
// je jako wiersze w DOM (dodawane/usuwane przyciskiem) i przy zapisie
// spłaszczamy do jednego tekstu w komórce arkusza: "4:30 - 22:00" — bez
// zera wiodącego przy godzinie i ze spacjami wokół myślnika, dokładnie tak,
// jak wpisy zaimportowane wcześniej ręcznie do zakładki "kociol". Kilka
// przedziałów w jednej dobie sklejamy przecinkiem — to już nasze rozszerzenie,
// w archiwum każdy wiersz miał tylko jeden przedział.

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

// <input type="time"> wymaga dwucyfrowej godziny (value="04:30"), więc przy
// wczytywaniu z arkusza ("4:30") trzeba ją dopełnić zerem — inaczej
// przeglądarka po cichu zignoruje wartość i pole zostanie puste.
function dopelnijGodzine(godzina) {
  const [h, m] = (godzina || '').split(':');
  if (h === undefined || m === undefined) return '';
  return `${h.padStart(2, '0')}:${m}`;
}

// Odwrotnie — do zapisu w stylu arkusza zdejmujemy zero wiodące.
function skrocGodzine(godzina) {
  const [h, m] = godzina.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

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

function serializujCyrkulacje(przedzialy) {
  return przedzialy.map((p) => `${skrocGodzine(p.od)} - ${skrocGodzine(p.do)}`).join(', ');
}

// Odporne na format z zera wiodącym i bez niego, ze spacjami wokół myślnika
// albo bez — split('-') i trim() ogarniają obie wersje (nasza i archiwalna).
function sparsujCyrkulacje(tekst) {
  if (!tekst) return [];
  return tekst.split(',').map((kawalek) => kawalek.trim()).filter(Boolean).map((kawalek) => {
    const [od, do_] = kawalek.split('-').map((s) => s.trim());
    return { od: od || '', do: do_ || '' };
  });
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
      cyrkulacja: wynik.cyrkulacja || '',
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
  komunikatStart.classList.add('ukryty');
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
  historiaKotla.innerHTML = '';
  wczytajBlokPodgladu(() => generacja === generacjaKotla, {
    status: statusHistoriiKotla,
    klucz: 'historia_kotla',
    pobierz: () => pobierzHistorieKotla(DNI_HISTORII_KOTLA, ILE_ZMIAN_KOTLA),
    renderuj: renderujHistorieKotla,
  });
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

// --- Kocioł: historia zmian (paski CO/CWU i oś ostatnich zmian) -----------
//
// Tylko do odczytu, pod formularzem. Dane z akcji historia_kotla, przez bufor
// w localStorage jak bloki Podglądu — to bezpieczne, bo historia niczego nie
// podpowiada do formularza (podpowiedź idzie osobno, z ostatni_kociol).
//
// Cztery tryby kotła rozkładamy na dwa niezależne obwody: CO (ogrzewanie)
// i CWU (ciepła woda). To tylko sposób wyświetlania — w arkuszu dalej jest
// jeden z czterech trybów.

const DNI_HISTORII_KOTLA = 365;   // okno pasków
const ILE_ZMIAN_KOTLA = 6;        // ile ostatnich wpisów na osi
const DOBA_MS = 24 * 3600 * 1000;

// Mały pomocnik do budowania DOM: tekst przez textContent, nie innerHTML —
// cyrkulacja to dowolny tekst z arkusza, więc nie wstawiamy go jako HTML.
function element(znacznik, klasa, tekst) {
  const el = document.createElement(znacznik);
  if (klasa) el.className = klasa;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

// Liczba po polsku (przecinek dziesiętny) — 0.5 → "0,5".
function liczbaPL(wartosc) {
  return String(wartosc).replace('.', ',');
}

function wartoscPusta(v) {
  return v === null || v === undefined || v === '';
}

// Czy zmieniła się dana nastawa — to samo porównanie co przy wykrywaniu
// „brak zmian” w formularzu (doPorownania traktuje null i '' jednakowo).
function rozne(a, b) {
  return doPorownania(a) !== doPorownania(b);
}

// Opis jednej nastawy liczbowej: przy świeżo włączonym obwodzie sama wartość
// („krzywa 0,5”), przy zmianie w trakcie — „krzywa 0,5 → 0,6”.
function opisNastawy(nazwa, teraz, wczesniej, swiezoWlaczony, jednostka = '') {
  if (wartoscPusta(teraz)) return null;
  if (swiezoWlaczony) return `${nazwa} ${liczbaPL(teraz)}${jednostka}`;
  if (!rozne(teraz, wczesniej)) return null;
  const przed = wartoscPusta(wczesniej) ? '—' : liczbaPL(wczesniej);
  return `${nazwa} ${przed} → ${liczbaPL(teraz)}${jednostka}`;
}

// Co się zmieniło we wpisie względem poprzedniego. Zwraca { tekst, obwod },
// gdzie obwod ('co' | 'cwu' | 'oba' | 'brak') decyduje o kolorze kropki na osi.
// Bez poprzedniego wpisu (najstarszy dostępny) opisujemy po prostu nastawy.
function opiszZmianeKotla(wpis, poprzedni) {
  const teraz = obwodyTrybu(wpis.tryb);
  const przed = poprzedni ? obwodyTrybu(poprzedni.tryb) : { co: false, cwu: false };
  const p = poprzedni || {};
  const czesci = [];
  let zmianaCo = false;
  let zmianaCwu = false;

  if (poprzedni && teraz.co !== przed.co) {
    czesci.push(teraz.co ? 'CO włączone' : 'CO wyłączone');
    zmianaCo = true;
  }
  if (teraz.co) {
    const swiezo = !poprzedni || !przed.co;
    const krzywa = opisNastawy('krzywa', wpis.krzywa_grzewcza, p.krzywa_grzewcza, swiezo);
    const przesuniecie = opisNastawy('przes.', wpis.przesuniecie, p.przesuniecie, swiezo);
    [krzywa, przesuniecie].filter(Boolean).forEach((c) => czesci.push(c));
    if (!swiezo && (krzywa || przesuniecie)) zmianaCo = true;
  }

  if (poprzedni && teraz.cwu !== przed.cwu) {
    czesci.push(teraz.cwu ? 'CWU włączone' : 'CWU wyłączone');
    zmianaCwu = true;
  }
  if (teraz.cwu) {
    const swiezo = !poprzedni || !przed.cwu;
    // Przy samym włączeniu CWU temperaturę pokazujemy tylko, gdy też się
    // zmieniła — inaczej każdy wpis powtarzałby „CWU 55 °C”.
    const temp = opisNastawy('CWU', wpis.temp_cwu, p.temp_cwu, !poprzedni, ' °C');
    if (temp) czesci.push(temp);
    if (!swiezo && temp) zmianaCwu = true;
    if (poprzedni && wpis.cyrkulacja !== p.cyrkulacja) {
      czesci.push(`cyrkulacja ${wpis.cyrkulacja || '—'}`);
      zmianaCwu = true;
    }
  }

  if (!poprzedni && !teraz.co && !teraz.cwu) czesci.push('kocioł wyłączony');
  if (czesci.length === 0) czesci.push('bez zmian nastaw');

  const obwod = zmianaCo && zmianaCwu ? 'oba' : zmianaCo ? 'co' : zmianaCwu ? 'cwu' : 'brak';
  return { tekst: czesci.join(' · '), obwod };
}

// „4 dni”, „1 dnia” — odmiana tylko tam, gdzie jej potrzebujemy.
// Pełne doby (w dół), a poniżej doby godziny — inaczej zmiana sprzed 14 godzin
// wyglądałaby na „od 1 dnia”.
function opiszCzasTrwania(ms, obowiazuje) {
  const dni = Math.floor(ms / DOBA_MS);
  if (dni < 1) {
    const godziny = Math.max(1, Math.round(ms / 3600000));
    return obowiazuje ? `obowiązuje od ${godziny} godz.` : `trwało ${godziny} godz.`;
  }
  if (obowiazuje) return `obowiązuje od ${dni} ${dni === 1 ? 'dnia' : 'dni'}`;
  return `trwało ${dni} ${dni === 1 ? 'dzień' : 'dni'}`;
}

// Pasek jednego obwodu w oknie [od, teraz]. `wpisy` rosnąco po dacie.
// Każdy wpis obowiązuje od swojej daty do daty następnego (ostatni — do teraz).
// Kreska = zmiana nastawy obwodu przy trybie, który go nie wyłącza ani nie
// włącza (np. sama zmiana krzywej); zmiana wł./wył. widać po kolorze.
function zbudujPasekObwodu(obwod, wpisy, odMs, terazMs) {
  const rozpietosc = terazMs - odMs;
  const pasek = element('div', 'pasek-obwodu');
  let wlaczonyMs = 0;
  let brakDanych = false;

  // Przed pierwszym znanym wpisem nie wiemy, jaki był tryb — zostawiamy lukę.
  const pierwszy = wpisy.length ? new Date(wpisy[0].obowiazuje_od).getTime() : terazMs;
  if (pierwszy > odMs) {
    const luka = element('div', 'pasek-obwodu__odcinek pasek-obwodu__odcinek--brak');
    luka.style.width = `${((Math.min(pierwszy, terazMs) - odMs) / rozpietosc) * 100}%`;
    pasek.appendChild(luka);
    brakDanych = true;
  }

  wpisy.forEach((wpis, i) => {
    const poczatek = Math.max(new Date(wpis.obowiazuje_od).getTime(), odMs);
    const koniec = i + 1 < wpisy.length ? new Date(wpisy[i + 1].obowiazuje_od).getTime() : terazMs;
    if (koniec <= odMs || koniec <= poczatek) return;

    const wlaczony = obwodyTrybu(wpis.tryb)[obwod];
    const odcinek = element('div', `pasek-obwodu__odcinek pasek-obwodu__odcinek--${wlaczony ? obwod : 'wyl'}`);
    odcinek.style.width = `${((koniec - poczatek) / rozpietosc) * 100}%`;
    pasek.appendChild(odcinek);
    if (wlaczony) wlaczonyMs += koniec - poczatek;

    const poprzedni = wpisy[i - 1];
    const dataWpisu = new Date(wpis.obowiazuje_od).getTime();
    if (poprzedni && dataWpisu > odMs && wlaczony && obwodyTrybu(poprzedni.tryb)[obwod]) {
      const zmiana = obwod === 'co'
        ? rozne(wpis.krzywa_grzewcza, poprzedni.krzywa_grzewcza) || rozne(wpis.przesuniecie, poprzedni.przesuniecie)
        : rozne(wpis.temp_cwu, poprzedni.temp_cwu) || wpis.cyrkulacja !== poprzedni.cyrkulacja;
      if (zmiana) {
        const kreska = element('div', 'pasek-obwodu__kreska');
        kreska.style.left = `${((dataWpisu - odMs) / rozpietosc) * 100}%`;
        pasek.appendChild(kreska);
      }
    }
  });

  return { pasek, dniWlaczony: Math.round(wlaczonyMs / DOBA_MS), brakDanych };
}

const MIESIACE_KROTKO = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

// Podpisy pod paskami: początki kwartałów (sty, kwi, lip, paź) i „dziś”.
// Co trzy miesiące, bo przy dwunastu podpisach na szerokości telefonu nachodzą
// na siebie.
function zbudujOsPaskow(odMs, terazMs) {
  const os = element('div', 'pasek-osi');
  const rozpietosc = terazMs - odMs;
  const miesiac = new Date(odMs);
  miesiac.setDate(1);
  miesiac.setHours(0, 0, 0, 0);
  for (miesiac.setMonth(miesiac.getMonth() + 1); miesiac.getTime() < terazMs; miesiac.setMonth(miesiac.getMonth() + 1)) {
    if (miesiac.getMonth() % 3 !== 0) continue;
    const pozycja = ((miesiac.getTime() - odMs) / rozpietosc) * 100;
    if (pozycja > 90) continue; // za blisko „dziś”
    const podpis = element('span', 'pasek-osi__podpis', MIESIACE_KROTKO[miesiac.getMonth()]);
    podpis.style.left = `${pozycja}%`;
    os.appendChild(podpis);
  }
  os.appendChild(element('span', 'pasek-osi__podpis pasek-osi__podpis--dzis', 'dziś'));
  return os;
}

function renderujHistorieKotla(wynik) {
  const kontener = historiaKotla;
  kontener.innerHTML = '';
  const wpisyMalejaco = (wynik.wpisy || []).filter((w) => !Number.isNaN(new Date(w.obowiazuje_od).getTime()));

  if (wpisyMalejaco.length === 0) {
    kontener.appendChild(element('p', 'komunikat-pusto', 'Brak zapisanych zmian nastaw.'));
    return;
  }

  const wpisy = wpisyMalejaco.slice().reverse(); // rosnąco — wygodniej liczyć odcinki
  const terazMs = Date.now();
  const odSerwera = new Date(wynik.od).getTime();
  const odMs = Number.isNaN(odSerwera) ? terazMs - DNI_HISTORII_KOTLA * DOBA_MS : odSerwera;

  // Paski CO i CWU
  const paski = element('div', 'historia-kotla__paski');
  paski.appendChild(element('p', 'historia-kotla__podpis', 'Ostatnie 12 miesięcy'));
  let brakDanych = false;
  [['co', 'CO'], ['cwu', 'CWU']].forEach(([obwod, nazwa]) => {
    const { pasek, dniWlaczony, brakDanych: luka } = zbudujPasekObwodu(obwod, wpisy, odMs, terazMs);
    brakDanych = brakDanych || luka;
    const wiersz = element('div', 'wiersz-paska');
    wiersz.appendChild(element('span', 'wiersz-paska__nazwa', nazwa));
    wiersz.appendChild(pasek);
    wiersz.appendChild(element('span', 'wiersz-paska__dni', `${dniWlaczony} dni`));
    paski.appendChild(wiersz);
  });
  paski.appendChild(zbudujOsPaskow(odMs, terazMs));
  paski.appendChild(element('p', 'historia-kotla__legenda',
    'kolor — włączone · szare — wyłączone · kreska — zmiana nastawy'
    + (brakDanych ? ' · kreskowane — brak danych' : '')));
  kontener.appendChild(paski);

  // Oś ostatnich zmian — najnowsze na górze.
  const os = element('ol', 'os-zmian');
  const ostatnie = wpisy.slice(-ILE_ZMIAN_KOTLA).reverse();
  ostatnie.forEach((wpis) => {
    const indeks = wpisy.indexOf(wpis);
    const poprzedni = wpisy[indeks - 1] || null;
    const nastepny = wpisy[indeks + 1] || null;
    const { tekst, obwod } = opiszZmianeKotla(wpis, poprzedni);
    const obwody = obwodyTrybu(wpis.tryb);
    const poczatek = new Date(wpis.obowiazuje_od).getTime();
    const koniec = nastepny ? new Date(nastepny.obowiazuje_od).getTime() : terazMs;

    const pozycja = element('li', 'zmiana-kotla');
    pozycja.appendChild(element('span', `zmiana-kotla__kropka zmiana-kotla__kropka--${obwod}`));

    const gora = element('div', 'zmiana-kotla__gora');
    gora.appendChild(element('span', 'zmiana-kotla__data', formatujDataGodzinePodgladu(wpis.obowiazuje_od)));
    const plakietki = element('span', 'zmiana-kotla__plakietki');
    plakietki.appendChild(element('span', `plakietka-obwodu ${obwody.co ? 'plakietka-obwodu--co' : 'plakietka-obwodu--wyl'}`, 'CO'));
    plakietki.appendChild(element('span', `plakietka-obwodu ${obwody.cwu ? 'plakietka-obwodu--cwu' : 'plakietka-obwodu--wyl'}`, 'CWU'));
    gora.appendChild(plakietki);
    pozycja.appendChild(gora);

    pozycja.appendChild(element('p', 'zmiana-kotla__opis', tekst));
    pozycja.appendChild(element('p', 'zmiana-kotla__czas', opiszCzasTrwania(koniec - poczatek, !nastepny)));
    os.appendChild(pozycja);
  });
  kontener.appendChild(os);
}

// --- Podgląd: ostatnie odczyty i temperatury dobowe (punkt 6 backlogu) ---
//
// Wyłącznie do odczytu — dwa niezależne zapytania do webhooka, każde może
// się nie udać osobno (np. jedno się wczyta, drugie pokaże błąd), więc
// obsługujemy je niezależnie zamiast jednym wspólnym try/catch.

function formatujDataGodzinePodgladu(tekstIso) {
  const data = tekstIso ? new Date(tekstIso) : null;
  if (!data || Number.isNaN(data.getTime())) return tekstIso || '—';
  const dwieCyfry = (l) => String(l).padStart(2, '0');
  return `${dwieCyfry(data.getDate())}.${dwieCyfry(data.getMonth() + 1)}.${data.getFullYear()} `
    + `${dwieCyfry(data.getHours())}:${dwieCyfry(data.getMinutes())}`;
}

function renderujOstatnieOdczyty(odczyty) {
  listaOstatnichOdczytow.innerHTML = '';

  if (!odczyty || odczyty.length === 0) {
    const pusto = document.createElement('p');
    pusto.className = 'komunikat-pusto';
    pusto.textContent = 'Brak zapisanych odczytów.';
    listaOstatnichOdczytow.appendChild(pusto);
    return;
  }

  odczyty.forEach((o) => {
    const opisMedium = MEDIA[o.medium];
    const wiersz = document.createElement('div');
    wiersz.className = 'wiersz-odczytu';
    wiersz.innerHTML = `
      <span class="wiersz-odczytu__data">${formatujDataGodzinePodgladu(o.data_godzina)}</span>
      <span class="wiersz-odczytu__medium">${opisMedium ? opisMedium.nazwa : o.medium}</span>
      <span class="wiersz-odczytu__stan">${o.stan}${opisMedium ? ' ' + opisMedium.jednostka : ''}</span>
    `;
    listaOstatnichOdczytow.appendChild(wiersz);
  });
}

// Kolumny (czujniki) budujemy z tego, co faktycznie przyszło w danych,
// zamiast zaszywać nazwy na sztywno — czujników przybywało w przeszłości
// (patrz historia w temp_doba) i mogą dojść kolejne.
function renderujTemperaturyDobowe(dni) {
  tabelaTemperatur.innerHTML = '';

  if (!dni || dni.length === 0) {
    tabelaTemperatur.innerHTML = '<tr><td class="komunikat-pusto">Brak danych o temperaturach.</td></tr>';
    return;
  }

  const czujniki = Array.from(new Set(dni.flatMap((d) => Object.keys(d.czujniki || {})))).sort();

  const naglowek = document.createElement('tr');
  naglowek.innerHTML = '<th>Data</th>' + czujniki.map((cz) => `<th>${cz}</th>`).join('');
  const thead = document.createElement('thead');
  thead.appendChild(naglowek);
  tabelaTemperatur.appendChild(thead);

  const tbody = document.createElement('tbody');
  dni.forEach((d) => {
    const wiersz = document.createElement('tr');
    const komorki = czujniki.map((cz) => {
      const wartosc = d.czujniki ? d.czujniki[cz] : undefined;
      return `<td>${typeof wartosc === 'number' ? wartosc.toFixed(1) + '°' : '—'}</td>`;
    }).join('');
    wiersz.innerHTML = `<td>${d.data}</td>${komorki}`;
    tbody.appendChild(wiersz);
  });
  tabelaTemperatur.appendChild(tbody);
}

// Wiersz statusu pod nagłówkiem bloku. rodzaj: 'wczytywanie' | 'info' | 'blad'
// (steruje wyglądem przez klasę status-bloku--<rodzaj>); null chowa wiersz.
function ustawStatusBloku(element, tekst, rodzaj) {
  element.className = 'status-bloku';
  if (!tekst) {
    element.classList.add('ukryty');
    element.textContent = '';
    return;
  }
  element.classList.add('status-bloku--' + rodzaj);
  element.textContent = tekst;
}

// Wczytuje jeden blok ekranu Podgląd według wzorca "pokaż stare, odśwież
// w tle" (BACKLOG pkt 12): jeśli w buforze (js/bufor.js) jest poprzednia
// odpowiedź, rysujemy ją OD RAZU i dopiero potem odpytujemy webhook; świeża
// odpowiedź podmienia widok. Dzięki temu ekran nie jest pusty przez 1–2 s
// (a czasem kilkanaście) po każdym otwarciu. Bez bufora — jak dotąd:
// "Wczytywanie…" i czekanie.
//
// Mierzymy też czas odpowiedzi i pokazujemy go po wczytaniu — dane do oceny,
// czy bufor rzeczywiście pomaga; z telefonu nie zajrzymy do konsoli.
// Spóźniona odpowiedź z poprzedniego otwarcia ekranu jest ignorowana
// (licznik generacji, jak w ekranie Kocioł).
//
// Używana też przez sekcję historii na ekranie Kocioł — stąd `czyAktualny`:
// każdy ekran sprawdza aktualność swoim licznikiem generacji.
async function wczytajBlokPodgladu(czyAktualny, blok) {
  const start = performance.now();
  const zBufora = odczytajBufor(blok.klucz);

  if (zBufora) {
    blok.renderuj(zBufora.dane);
    ustawStatusBloku(blok.status,
      `Z pamięci (${opiszWiek(zBufora.czas)}) — odświeżam…`, 'wczytywanie');
  } else {
    ustawStatusBloku(blok.status, 'Wczytywanie…', 'wczytywanie');
  }

  // Błąd przy odświeżaniu NIE kasuje tego, co już pokazaliśmy z bufora —
  // lepiej stare dane z uczciwym ostrzeżeniem niż pusty ekran.
  const pokazBlad = (powod) => {
    const doTego = zBufora ? ` Pokazuję dane z pamięci (${opiszWiek(zBufora.czas)}).` : '';
    ustawStatusBloku(blok.status, `Nie udało się odświeżyć (${powod}).${doTego}`, 'blad');
  };

  try {
    const wynik = await blok.pobierz();
    if (!czyAktualny()) return;

    if (wynik.ok) {
      zapiszBufor(blok.klucz, wynik);
      // Jeśli świeże dane są takie same jak z bufora, nie rysujemy drugi raz.
      if (!zBufora || JSON.stringify(zBufora.dane) !== JSON.stringify(wynik)) {
        blok.renderuj(wynik);
      }
      const sekundy = ((performance.now() - start) / 1000).toFixed(1).replace('.', ',');
      ustawStatusBloku(blok.status, `Wczytano w ${sekundy} s`, 'info');
    } else {
      pokazBlad(wynik.blad || 'błąd webhooka');
    }
  } catch (blad) {
    if (!czyAktualny()) return;
    console.error('Nie udało się wczytać bloku podglądu:', blad);
    pokazBlad('brak połączenia');
  }
}

// Ile pozycji pokazuje Podgląd: ostatnich wpisów z `odczyty` i ostatnich dni
// z `temp_doba`. Jedna stała dla obu bloków, żeby zmieniać to w jednym miejscu.
// 20 wystarcza do sprawdzenia z telefonu, co ostatnio poszło do arkusza,
// a krótsza lista szybciej się przewija i daje mniejszą odpowiedź webhooka.
const ILE_POZYCJI_PODGLADU = 20;

function otworzPodglad() {
  komunikatStart.classList.add('ukryty');
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;

  listaOstatnichOdczytow.innerHTML = '';
  tabelaTemperatur.innerHTML = '';
  pokazEkran(ekranPodglad);

  // Oba bloki startują jednocześnie, nie jeden po drugim — są niezależne,
  // więc czas oczekiwania to dłuższe z dwóch zapytań, a nie ich suma.
  const czyAktualny = () => generacja === generacjaPodgladu;
  wczytajBlokPodgladu(czyAktualny, {
    status: statusOdczytow,
    klucz: 'ostatnie_odczyty',
    pobierz: () => pobierzOstatnieOdczyty(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujOstatnieOdczyty(wynik.odczyty),
  });
  wczytajBlokPodgladu(czyAktualny, {
    status: statusTemperatur,
    klucz: 'temperatury_dobowe',
    pobierz: () => pobierzTemperaturyDobowe(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujTemperaturyDobowe(wynik.dni),
  });
}

przyciskPodglad.addEventListener('click', () => {
  if (!czyUstawieniaZapisane()) {
    otworzUstawienia();
    return;
  }
  otworzPodglad();
});

przyciskZamknijPodglad.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

// Puste pole -> null (nie NaN z parseFloat('')) — "krzywa grzewcza" i
// "przesunięcie" są null przy samym CWU (bez CO), zgodnie z archiwum.
function liczbaAlboNull(tekst) {
  return tekst === '' ? null : parseFloat(tekst);
}

// Do porównania "czy coś się zmieniło" — null, undefined i NaN (np. gdyby
// pole zawierało coś niepoprawnego) traktujemy jako ten sam, pusty stan.
function doPorownania(wartosc) {
  if (wartosc === null || wartosc === undefined) return '';
  if (typeof wartosc === 'number' && Number.isNaN(wartosc)) return '';
  return String(wartosc);
}

// Czy dwa zestawy nastaw kotła są takie same (bez daty obowiązywania).
// Wspólne dla formularza (czy w ogóle jest co wysłać) i kolejki offline
// (czy wpis z kolejki nie jest już w arkuszu — patrz czyNastawyJuzWArkuszu).
//
// Obie strony najpierw przez normalizujNastawy: formularz nie wyśle krzywej
// przy samym CWU, więc wpis z arkusza, który ją ma, nie może przez to
// wyglądać na „inny”.
function normalizujNastawy(n) {
  const obwody = obwodyTrybu(n.tryb);
  return {
    ...n,
    krzywa_grzewcza: obwody.co ? n.krzywa_grzewcza : null,
    przesuniecie: obwody.co ? n.przesuniecie : null,
    temp_cwu: obwody.cwu ? n.temp_cwu : null,
  };
}

function czyTeSameNastawy(pierwsze, drugie) {
  const a = normalizujNastawy(pierwsze);
  const b = normalizujNastawy(drugie);
  return a.tryb === b.tryb
    && doPorownania(a.krzywa_grzewcza) === doPorownania(b.krzywa_grzewcza)
    && doPorownania(a.przesuniecie) === doPorownania(b.przesuniecie)
    && doPorownania(a.temp_cwu) === doPorownania(b.temp_cwu)
    && a.cyrkulacja === b.cyrkulacja;
}

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

    komunikatStart.textContent = `Zapisano zmianę nastaw kotła: ${ETYKIETY_TRYBU[daneKotla.tryb] || daneKotla.tryb}.`;
    komunikatStart.classList.remove('ukryty');
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
    komunikatStart.textContent =
      `Nie udało się potwierdzić zapisu (${przyczyna}) — zmiana nastaw kotła ` +
      'zapisana lokalnie. Aplikacja wyśle ją sama albo sprawdzi, że już doszła.';
    komunikatStart.classList.remove('ukryty');
    pokazEkran(ekranStart);
  } finally {
    przyciskZapiszKociol.disabled = false;
    przyciskZapiszKociol.textContent = 'Zapisz zmianę';
  }
});

// Kliknięcie kafelka otwiera ekran potwierdzenia z bieżącą datą i godziną —
// użytkownik może je poprawić, gdy odczyt robi z opóźnieniem. `urlZdjecia`
// pokazuje podgląd zrobionego zdjęcia, żeby dało się z niego przepisać
// wskazanie — sam model wizyjny dojdzie w punkcie 6.
// Informacja pod polem daty: skąd wzięła się wpisana godzina. Tylko dla zdjęcia
// z galerii — przy ręcznym wpisie i zdjęciu z aparatu godzina to po prostu
// czas telefonu i nie ma o czym mówić. Pole zawsze zostaje edytowalne.
const UWAGI_CZASU = {
  exif: { tekst: 'Godzina ze zdjęcia (EXIF) — sprawdź, czy się zgadza.', przyblizona: false },
  plik: { tekst: 'Zdjęcie nie ma daty zrobienia — wpisana data pliku (przybliżona). Popraw, jeśli odczyt był o innej porze.', przyblizona: true },
  brak: { tekst: 'Nie znaleziono daty zdjęcia — wpisana bieżąca godzina. Popraw, jeśli odczyt był wcześniej.', przyblizona: true },
};

function ustawUwageCzasu(czasZdjecia) {
  const uwaga = czasZdjecia ? UWAGI_CZASU[czasZdjecia.zrodlo] : null;
  uwagaCzasu.classList.toggle('ukryty', !uwaga);
  uwagaCzasu.classList.toggle('uwaga-pola--przyblizona', Boolean(uwaga && uwaga.przyblizona));
  uwagaCzasu.textContent = uwaga ? uwaga.tekst : '';
}

function otworzPotwierdzenie(medium, metoda, urlZdjecia = null, czasZdjecia = null) {
  wybraneMedium = medium;
  metodaAktualnegoOdczytu = metoda;
  generacjaPotwierdzenia++;
  const opisMedium = MEDIA[medium];
  potwierdzenieTytul.textContent = opisMedium.nazwa;
  potwierdzenieJednostka.textContent = opisMedium.jednostka;
  poleStan.step = opisMedium.miejscaPoPrzecinku > 0
    ? (1 / 10 ** opisMedium.miejscaPoPrzecinku).toFixed(opisMedium.miejscaPoPrzecinku)
    : '1';
  poleStan.value = '';
  // Po przerwanym rozpoznawaniu (zamknięty ekran) poprzedni komunikat w polu
  // nie może przejść na kolejne, np. ręczne, otwarcie ekranu.
  poleStan.placeholder = '';
  // Zdjęcie z galerii: moment zrobienia zdjęcia zamiast "teraz" (js/aparat.js).
  poleDataGodzina.value = sformatujDataGodzinaLokalnie(
    czasZdjecia && czasZdjecia.data ? czasZdjecia.data : new Date());
  ustawUwageCzasu(czasZdjecia);
  komunikatStart.classList.add('ukryty');
  komunikatPotwierdzenia.classList.add('ukryty');

  zwolnijPodgladZdjecia();
  if (urlZdjecia) {
    adresUrlPodgladuZdjecia = urlZdjecia;
    podgladZdjecia.src = urlZdjecia;
    podgladZdjecia.classList.remove('ukryty');
  } else {
    podgladZdjecia.classList.add('ukryty');
  }

  pokazEkran(ekranPotwierdzenia);
}

kafelki.forEach((kafelek) => {
  kafelek.addEventListener('click', () => {
    if (!czyUstawieniaZapisane()) {
      otworzUstawienia();
      return;
    }
    wybraneMedium = kafelek.dataset.medium;
    if (MEDIA_ZE_ZDJECIEM.includes(wybraneMedium)) {
      wyborMetodyTytul.textContent = MEDIA[wybraneMedium].nazwa;
      pokazEkran(ekranWyboruMetody);
    } else {
      otworzPotwierdzenie(wybraneMedium, 'reczny');
    }
  });
});

przyciskRecznie.addEventListener('click', () => {
  otworzPotwierdzenie(wybraneMedium, 'reczny');
});

przyciskAnulujWybor.addEventListener('click', () => {
  pokazEkran(ekranStart);
});

// Kompresja i zmniejszenie zdjęcia są w js/aparat.js — tu tylko wybieramy
// źródło (aparat albo galeria), otwieramy ekran potwierdzenia z podglądem
// i od razu w tle wysyłamy zdjęcie do rozpoznania (akcja "odczytaj_foto").
async function obslozWyborZdjecia(pobierzZdjecie) {
  let wynikZdjecia;
  try {
    wynikZdjecia = await pobierzZdjecie(wybraneMedium);
  } catch (blad) {
    console.error('Nie udało się uzyskać zdjęcia:', blad);
    pokazEkran(ekranStart);
    return;
  }

  const { medium, blob, url, czasZdjecia } = wynikZdjecia;
  otworzPotwierdzenie(medium, 'foto', url, czasZdjecia);
  await rozpoznajIWypelnij(medium, blob, generacjaPotwierdzenia);
}

// Model niczego nie zapisuje — tylko proponuje wartość do pola, które i tak
// trzeba zatwierdzić ręcznie. Przy niskiej pewności albo niedopasowanym
// zdjęciu (pasuje: false) pole zostaje puste i pokazujemy ostrzeżenie,
// zamiast po cichu przyjąć niepewny wynik (zgodnie z CLAUDE.md).
async function rozpoznajIWypelnij(medium, blob, generacja) {
  // Rozpoznawanie trwa od kilku do kilkudziesięciu sekund (model bywa
  // przeciążony), więc pola NIE blokujemy — można od razu wpisać wartość
  // z podglądu zdjęcia. Jeśli ktoś zdążył coś wpisać, spóźniony wynik modelu
  // nie nadpisuje tego i nie pokazuje żadnych komunikatów.
  poleStan.placeholder = 'Rozpoznaję… (możesz wpisać ręcznie)';

  try {
    const obrazBase64 = await blobDoBase64(blob);
    const wynik = await rozpoznajZdjecie(medium, obrazBase64);

    if (generacja !== generacjaPotwierdzenia) return; // ekran zdążył się zmienić
    if (poleStan.value !== '') return;                // użytkownik wpisał sam

    if (wynik.ok && wynik.pasuje && wynik.pewnosc !== 'niska' && typeof wynik.stan === 'number') {
      poleStan.value = wynik.stan;
      if (wynik.pewnosc === 'srednia') {
        pokazBladPotwierdzenia('Średnia pewność odczytu — sprawdź wartość na zdjęciu przed zatwierdzeniem.');
      }
    } else if (wynik.ok) {
      const powod = wynik.problem || 'nie udało się jednoznacznie odczytać wskazania';
      pokazBladPotwierdzenia(`Model nie jest pewny odczytu (${powod}) — sprawdź zdjęcie i wpisz wartość ręcznie.`);
    } else {
      // Błąd po stronie usługi rozpoznawania (przeciążenie, limit) — to nie
      // "niepewność modelu", więc mówimy o tym wprost.
      pokazBladPotwierdzenia(`Rozpoznawanie nie powiodło się (${wynik.blad || 'błąd webhooka'}) — wpisz wartość ręcznie.`);
    }
  } catch (blad) {
    console.error('Nie udało się rozpoznać zdjęcia:', blad);
    if (generacja === generacjaPotwierdzenia && poleStan.value === '') {
      pokazBladPotwierdzenia('Nie udało się rozpoznać zdjęcia — wpisz odczyt ręcznie.');
    }
  } finally {
    if (generacja === generacjaPotwierdzenia) poleStan.placeholder = '';
  }
}

przyciskZdjecie.addEventListener('click', () => obslozWyborZdjecia(zrobZdjecie));
przyciskGaleria.addEventListener('click', () => obslozWyborZdjecia(wybierzZGalerii));

function zwolnijPodgladZdjecia() {
  if (adresUrlPodgladuZdjecia) {
    URL.revokeObjectURL(adresUrlPodgladuZdjecia);
    adresUrlPodgladuZdjecia = null;
  }
}

przyciskAnulujPotwierdzenie.addEventListener('click', () => {
  zwolnijPodgladZdjecia();
  pokazEkran(ekranStart);
});

function pokazBladPotwierdzenia(tresc) {
  komunikatPotwierdzenia.textContent = tresc;
  komunikatPotwierdzenia.classList.remove('ukryty');
}

function aktualizujKomunikatKolejki() {
  const ile = liczbaWKolejce();
  if (ile > 0) {
    komunikatKolejka.textContent = `W kolejce offline: ${ile} wpisów do wysłania — pójdą same, gdy wróci internet.`;
    komunikatKolejka.classList.remove('ukryty');
  } else {
    komunikatKolejka.classList.add('ukryty');
  }
}

// Krótki, czytelny opis wpisu z kolejki do komunikatów o wysyłce/odrzuceniu.
function opiszWpisKolejki(wpis) {
  if (wpis.akcja === 'zmiana_kotla') {
    return `Kocioł: ${ETYKIETY_TRYBU[wpis.tryb] || wpis.tryb}`;
  }
  return `${(MEDIA[wpis.medium] || {}).nazwa || wpis.medium} ${wpis.stan}`;
}

// Wysyła po kolei to, co czeka w kolejce offline, od najstarszego wpisu —
// webhook sprawdza chronologię per medium, więc kolejność się liczy.
// Błąd sieci przerywa pętlę (spróbujemy przy następnej okazji); odrzucenie
// przez webhook (np. nieaktualna już chronologia) usuwa wpis z kolejki —
// nie da się tego naprawić automatycznym powtórzeniem, więc informujemy
// zamiast próbować bez końca.
let przetwarzanieKolejkiWToku = false;

// Czy odczyt odrzucony przy wysyłce z kolejki jest już w arkuszu?
//
// Typowy scenariusz: pierwsza wysyłka DOSZŁA i webhook zapisał wiersz, ale
// odpowiedź nie wróciła do telefonu (Apps Script odpowiada przez
// przekierowanie, które potrafi zwrócić przejściowe 404/500, albo zasięg
// zniknął w trakcie). Aplikacja uznała to za brak połączenia i odłożyła
// odczyt do kolejki. Ponowna wysyłka trafia wtedy na własny, już zapisany
// wiersz, a webhook odrzuca ją jako „data nie jest późniejsza” — więc
// zamiast prosić o ręczne wpisanie, sprawdzamy, czy wpis o tym samym
// medium, dacie i stanie już tam jest. Webhook sam duplikatów nie wykrywa,
// a kontraktu nie zmieniamy — używamy istniejącej akcji ostatnie_odczyty.
//
// `pamiec` to obiekt wspólny dla jednego przebiegu kolejki, żeby przy kilku
// odrzuconych wpisach pobrać listę z arkusza tylko raz.
const ILE_ODCZYTOW_DO_SPRAWDZENIA = 50;

async function czyOdczytJestJuzWArkuszu(wpis, pamiec) {
  if (wpis.akcja !== 'odczyt') return false;
  if (!pamiec.odczyty) {
    const wynik = await pobierzOstatnieOdczyty(ILE_ODCZYTOW_DO_SPRAWDZENIA);
    if (!wynik.ok) return false;
    pamiec.odczyty = wynik.odczyty;
  }
  return pamiec.odczyty.some((o) =>
    o.medium === wpis.medium &&
    o.data_godzina === wpis.data_godzina &&
    // Stan porównujemy z tolerancją, bo liczba z arkusza może wrócić
    // z drobnym błędem zmiennoprzecinkowym (np. 110.90599999).
    Math.abs(Number(o.stan) - Number(wpis.stan)) < 0.0005
  );
}

// To samo dla zmiany nastaw kotła, ale z jedną ważną różnicą: webhook
// `zmiana_kotla` niczego nie odrzuca — zapisuje wszystko, co dostanie.
// Ponowna wysyłka zmiany, która już doszła, nie dałaby więc błędu, tylko
// po cichu dopisała drugi, identyczny wiersz w `kociol`. Dlatego sprawdzamy
// PRZED wysłaniem, a nie po odrzuceniu: jeśli ostatni wpis w arkuszu ma tę
// samą datę obowiązywania i te same nastawy, to jest to nasz wpis.
//
// Zwraca true (już jest), false (nie ma — trzeba wysłać) albo rzuca wyjątek
// przy braku sieci. Gdy webhook zwróci błąd, zwracamy false i wysyłamy —
// ewentualny duplikat jest mniejszym złem niż zgubiona zmiana nastaw.
async function czyNastawyJuzWArkuszu(wpis) {
  const ostatnie = await pobierzOstatnieNastawyKotla();
  if (!ostatnie.ok || ostatnie.brak) return false;
  return ostatnie.obowiazuje_od === wpis.obowiazuje_od && czyTeSameNastawy(ostatnie, wpis);
}

async function przetworzKolejkeOffline() {
  if (przetwarzanieKolejkiWToku) return;
  przetwarzanieKolejkiWToku = true;

  let wyslanychOk = 0;
  const juzWArkuszu = [];
  const odrzucone = [];
  const pamiecSprawdzania = {};

  try {
    while (pobierzKolejke().length > 0) {
      const [pierwszy] = pobierzKolejke();

      if (pierwszy.akcja === 'zmiana_kotla') {
        let jestJuz;
        try {
          jestJuz = await czyNastawyJuzWArkuszu(pierwszy);
        } catch (blad) {
          console.error('Kolejka offline: wciąż brak połączenia.', blad);
          break;
        }
        if (jestJuz) {
          usunPierwszyZKolejki();
          juzWArkuszu.push(pierwszy);
          continue;
        }
      }

      let odpowiedz;
      try {
        odpowiedz = await wyslij(pierwszy);
      } catch (blad) {
        console.error('Kolejka offline: wciąż brak połączenia.', blad);
        break;
      }

      if (odpowiedz.ok) {
        usunPierwszyZKolejki();
        wyslanychOk++;
        continue;
      }

      // Odrzucony — zanim uznamy go za problem, sprawdzamy, czy nie jest to
      // po prostu wpis, który wcześniej doszedł (patrz czyOdczytJestJuzWArkuszu).
      let jestJuz = false;
      try {
        jestJuz = await czyOdczytJestJuzWArkuszu(pierwszy, pamiecSprawdzania);
      } catch (blad) {
        // Sprawdzenie się nie udało (znów brak sieci) — wpis zostaje
        // w kolejce i wrócimy do niego przy następnej okazji, zamiast
        // pochopnie kazać wpisywać go ręcznie.
        console.error('Kolejka offline: nie udało się sprawdzić, czy wpis już jest w arkuszu.', blad);
        break;
      }

      usunPierwszyZKolejki();
      if (jestJuz) {
        juzWArkuszu.push(pierwszy);
      } else {
        odrzucone.push({ ...pierwszy, blad: odpowiedz.blad });
      }
    }
  } finally {
    przetwarzanieKolejkiWToku = false;
  }

  aktualizujKomunikatKolejki();
  // Wysłane z kolejki wpisy zmieniły zawartość arkusza — patrz uwaga przy zapisie.
  // Przy wpisach, które już były w arkuszu, też czyścimy bufor: Podgląd
  // mógł zapamiętać listę sprzed ich pierwszej (udanej) wysyłki.
  if (wyslanychOk > 0 || juzWArkuszu.length > 0) wyczyscBuforKlucz('ostatnie_odczyty');

  const czesci = [];
  if (wyslanychOk > 0) {
    czesci.push(`Wysłano z kolejki offline: ${wyslanychOk} wpis(ów).`);
  }
  if (juzWArkuszu.length > 0) {
    const opis = juzWArkuszu.map(opiszWpisKolejki).join(', ');
    const jeden = juzWArkuszu.length === 1;
    czesci.push(
      `${opis} — ${jeden ? 'był' : 'były'} już w arkuszu (pierwsza wysyłka ` +
      `doszła, zabrakło tylko potwierdzenia). Nic nie trzeba robić.`
    );
  }
  if (odrzucone.length > 0) {
    const opis = odrzucone
      .map((o) => `${opiszWpisKolejki(o)} (${o.blad})`)
      .join('; ');
    czesci.push(`Webhook odrzucił ${odrzucone.length} wpis(ów) z kolejki — wpisz ponownie ręcznie: ${opis}`);
  }
  if (czesci.length > 0) {
    komunikatStart.textContent = czesci.join(' ');
    komunikatStart.classList.remove('ukryty');
  }
}

formularzPotwierdzenia.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const opisMedium = MEDIA[wybraneMedium];
  const odczyt = {
    medium: wybraneMedium,
    stan: parseFloat(poleStan.value),
    data_godzina: `${poleDataGodzina.value}:00`,
    metoda: metodaAktualnegoOdczytu,
    foto_url: '',
    uwagi: '',
  };

  komunikatPotwierdzenia.classList.add('ukryty');
  przyciskZatwierdz.disabled = true;
  przyciskZatwierdz.textContent = 'Wysyłanie…';

  try {
    const odpowiedz = await wyslijOdczyt(odczyt);

    if (!odpowiedz.ok) {
      // wymaga_potwierdzenia = stan niższy niż poprzedni odczyt — zostajemy
      // na ekranie, żeby użytkownik mógł poprawić wartość i spróbować ponownie.
      pokazBladPotwierdzenia(odpowiedz.blad || 'Webhook odrzucił odczyt.');
      return;
    }

    // Lista ostatnich odczytów w buforze jest już nieaktualna (doszedł nowy
    // wpis) — wyrzucamy ją, żeby Podgląd nie pokazał najpierw listy bez niego.
    wyczyscBuforKlucz('ostatnie_odczyty');
    komunikatStart.textContent =
      `Zapisano: ${opisMedium.nazwa} — ${poleStan.value} ${opisMedium.jednostka} ` +
      `(poprzedni stan: ${odpowiedz.poprzedni_stan}, przyrost: ${odpowiedz.przyrost}).`;
    komunikatStart.classList.remove('ukryty');
    zwolnijPodgladZdjecia();
    pokazEkran(ekranStart);
  } catch (blad) {
    // Nie dostaliśmy odpowiedzi webhooka (a nie odrzucenie przez niego) —
    // zamiast zmuszać do czekania, zapisujemy lokalnie i wysyłamy
    // automatycznie przy najbliższej okazji (patrz js/kolejka.js).
    // To NIE musi znaczyć braku internetu: przejściowy błąd HTTP
    // przekierowania Apps Script też tu trafia, a wtedy wiersz bywa już
    // zapisany. Komunikat mówi więc uczciwie „nie potwierdzono”, a kolejka
    // przy ponownej wysyłce rozpozna taki wpis (czyOdczytJestJuzWArkuszu).
    console.error('Nie udało się wysłać odczytu, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'odczyt', ...odczyt });
    aktualizujKomunikatKolejki();
    const przyczyna = navigator.onLine ? 'brak odpowiedzi serwera' : 'brak połączenia';
    komunikatStart.textContent =
      `Nie udało się potwierdzić zapisu (${przyczyna}) — ${opisMedium.nazwa} ` +
      `${poleStan.value} ${opisMedium.jednostka} zapisane lokalnie. Aplikacja ` +
      'wyśle je sama albo sprawdzi, że już doszło.';
    komunikatStart.classList.remove('ukryty');
    zwolnijPodgladZdjecia();
    pokazEkran(ekranStart);
  } finally {
    przyciskZatwierdz.disabled = false;
    przyciskZatwierdz.textContent = 'Zatwierdź';
  }
});

// Przy pierwszym uruchomieniu, bez zapisanych ustawień, od razu pokazujemy
// ekran ustawień — bez adresu i tokenu wysyłka i tak by się nie udała.
pokazEkran(czyUstawieniaZapisane() ? ekranStart : ekranUstawien);
if (!czyUstawieniaZapisane()) {
  przyciskAnuluj.classList.add('ukryty');
}

// Kolejka offline: pokaż, ile czeka, i spróbuj wysłać od razu przy starcie
// (na wypadek, gdyby zasięg wrócił, zanim ktoś znów otworzył aplikację),
// a potem przy każdym powrocie połączenia — bez czekania na kolejny start.
aktualizujKomunikatKolejki();
if (czyUstawieniaZapisane()) {
  przetworzKolejkeOffline();
}
// Telefon trzyma zainstalowaną aplikację w tle godzinami — po powrocie na
// pierwszy plan odświeżamy nastawy kotła (throttling wewnątrz funkcji) i tylko
// wtedy, gdy widać ekran startowy; inaczej odświeży je powrót na start.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // Powrót z tła to jedyny moment, w którym zainstalowana aplikacja „budzi
  // się” bez przeładowania strony — sprawdzamy więc przy nim, czy na
  // serwerze nie ma nowej wersji (patrz rejestracja service workera niżej).
  sprawdzAktualizacjeAplikacji();
  if (!ekranStart.classList.contains('ukryty')) {
    if (czekaNaPrzeladowanie && czyMoznaBezpieczniePrzeladowac()) {
      window.location.reload();
      return;
    }
    odswiezNastawyKotlaWTle();
  }
});
window.addEventListener('online', () => {
  if (czyUstawieniaZapisane()) {
    przetworzKolejkeOffline();
  }
});

// Rejestracja service workera — pozwala otworzyć aplikację bez zasięgu.
//
// Aktualizacja do nowej wersji. Service worker serwuje wszystko z cache,
// więc otwarta strona zostaje w starej wersji, dopóki (1) przeglądarka nie
// zauważy nowego sw.js na serwerze i (2) strona się nie przeładuje.
// Przeglądarka sama sprawdza sw.js głównie przy pełnym otwarciu strony,
// a zainstalowana PWA zwykle tylko wraca z tła — stąd jawne update() przy
// powrocie z tła. Nowy worker przejmuje stronę od razu (skipWaiting
// i clients.claim w sw.js), co zgłasza zdarzenie `controllerchange`;
// wtedy przeładowujemy stronę, żeby wczytała nowe pliki z nowego cache.
let rejestracjaSW = null;
let czekaNaPrzeladowanie = false;

function sprawdzAktualizacjeAplikacji() {
  if (!rejestracjaSW) return;
  rejestracjaSW.update().catch(() => {
    // Brak zasięgu albo chwilowy błąd serwera — spróbujemy przy następnym
    // powrocie z tła; aplikacja działa dalej na wersji z cache.
  });
}

// Przeładowanie w trakcie wpisywania odczytu albo nastaw zgubiłoby to, co
// użytkownik wpisał — więc tylko na ekranie startowym i nie wtedy, gdy
// widać na nim komunikat o właśnie zapisanym odczycie.
function czyMoznaBezpieczniePrzeladowac() {
  return !ekranStart.classList.contains('ukryty') &&
    komunikatStart.classList.contains('ukryty');
}

if ('serviceWorker' in navigator) {
  // Czy stroną zarządzał już jakiś worker? Przy pierwszej instalacji
  // `controllerchange` też przychodzi, ale wtedy nie ma czego podmieniać —
  // strona i tak jest świeża z sieci.
  const bylKontroler = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!bylKontroler || czekaNaPrzeladowanie) return;
    czekaNaPrzeladowanie = true;
    if (czyMoznaBezpieczniePrzeladowac()) {
      window.location.reload();
    }
    // W przeciwnym razie przeładowanie nastąpi przy najbliższym powrocie
    // z tła na ekranie startowym (obsługa visibilitychange wyżej).
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((rejestracja) => { rejestracjaSW = rejestracja; })
      .catch((blad) => {
        console.error('Nie udało się zarejestrować service workera:', blad);
      });
  });
}
