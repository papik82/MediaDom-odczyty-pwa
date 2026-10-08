// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków,
// formularza ustawień, ekranu potwierdzenia odczytu i wysyłki do webhooka.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import { MEDIA, MEDIA_ZE_ZDJECIEM, MEDIA_Z_OCR, POZYCJE_PRADU } from './media.js';
import {
  wyslij, wyslijOdczyt, rozpoznajZdjecie, zapiszKociol, pobierzOstatnieNastawyKotla,
  pobierzOstatnieOdczyty, pobierzTemperaturyDobowe, pobierzTemperaturyGodzinowe, pobierzAlarmy, pobierzHistorieKotla,
  pobierzStanZbieracza, zapiszPomysl, pobierzPomysly, odczytajFakture, zapiszFakture,
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

const ekranPrad = document.getElementById('ekran-prad');
const przyciskPrad = document.getElementById('przycisk-prad');
const formularzPradu = document.getElementById('formularz-pradu');
const poleDataPradu = document.getElementById('pole-data-pradu');
const uwagaCzasuPradu = document.getElementById('uwaga-czasu-pradu');
const kontenerWierszyPradu = document.getElementById('wiersze-pradu');
const szablonWierszaPradu = document.getElementById('szablon-wiersza-pradu');
const przyciskZapiszPrad = document.getElementById('przycisk-zapisz-prad');
const przyciskAnulujPrad = document.getElementById('przycisk-anuluj-prad');
const komunikatPradu = document.getElementById('komunikat-pradu');

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

const ekranOdczyty = document.getElementById('ekran-odczyty');
const ekranTemperatury = document.getElementById('ekran-temperatury');
const przyciskOdczyty = document.getElementById('przycisk-odczyty');
const przyciskTemperatury = document.getElementById('przycisk-temperatury');
const przyciskZamknijOdczyty = document.getElementById('przycisk-zamknij-odczyty');
const przyciskZamknijTemperatury = document.getElementById('przycisk-zamknij-temperatury');
const listaOstatnichOdczytow = document.getElementById('lista-ostatnich-odczytow');
const tabelaTemperatur = document.getElementById('tabela-temperatur');
const statusOdczytow = document.getElementById('status-odczytow');
const statusTemperatur = document.getElementById('status-temperatur');
const ekranZbieracz = document.getElementById('ekran-zbieracz');
const przyciskZbieracz = document.getElementById('przycisk-zbieracz');
const przyciskZamknijZbieracz = document.getElementById('przycisk-zamknij-zbieracz');
const statusZbieracza = document.getElementById('status-zbieracza');
const stanZbieraczaKontener = document.getElementById('stan-zbieracza');
const ekranPomysly = document.getElementById('ekran-pomysly');
const przyciskPomysly = document.getElementById('przycisk-pomysly');
const przyciskZamknijPomysly = document.getElementById('przycisk-zamknij-pomysly');
const formularzPomyslu = document.getElementById('formularz-pomyslu');
const polePomysl = document.getElementById('pole-pomysl');
const poleObszarPomyslu = document.getElementById('pole-obszar-pomyslu');
const przyciskZapiszPomysl = document.getElementById('przycisk-zapisz-pomysl');
const komunikatPomyslu = document.getElementById('komunikat-pomyslu');
const statusPomyslow = document.getElementById('status-pomyslow');
const listaPomyslow = document.getElementById('lista-pomyslow');
const ekranFaktura = document.getElementById('ekran-faktura');
const przyciskFaktura = document.getElementById('przycisk-faktura');
const przyciskPdfFaktury = document.getElementById('przycisk-pdf-faktury');
const przyciskFakturaRecznie = document.getElementById('przycisk-faktura-recznie');
const plikFaktury = document.getElementById('plik-faktury');
const statusFaktury = document.getElementById('status-faktury');
const formularzFaktury = document.getElementById('formularz-faktury');
const ciagloscFaktury = document.getElementById('ciaglosc-faktury');
const poleNrFaktury = document.getElementById('pole-nr-faktury');
const poleBruttoFaktury = document.getElementById('pole-brutto-faktury');
const okresyFaktury = document.getElementById('okresy-faktury');
const przyciskDodajOkres = document.getElementById('przycisk-dodaj-okres');
const kontrolaFaktury = document.getElementById('kontrola-faktury');
const przyciskZapiszFakture = document.getElementById('przycisk-zapisz-fakture');
const komunikatFaktury = document.getElementById('komunikat-faktury');
const przyciskZamknijFakture = document.getElementById('przycisk-zamknij-fakture');
const szablonOkresuFaktury = document.getElementById('szablon-okresu-faktury');

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
  for (const ekran of [ekranStart, ekranUstawien, ekranWyboruMetody, ekranPotwierdzenia, ekranPrad, ekranKociol, ekranOdczyty, ekranTemperatury, ekranZbieracz, ekranPomysly, ekranFaktura]) {
    ekran.classList.toggle('ukryty', ekran !== ekranDoPokazania);
  }
  // Każdy powrót na ekran startowy (i start aplikacji) to okazja, żeby
  // z wyprzedzeniem odświeżyć nastawy kotła — patrz odswiezNastawyKotlaWTle —
  // i sprawdzić alarmy zbierania temperatur (pasek nad kartami).
  if (ekranDoPokazania === ekranStart) {
    odswiezNastawyKotlaWTle();
    odswiezAlarmy();
  }
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
  zamknijEkranPradu();
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
  return przedzialy.map((p) => `${skrocGodzine(p.od)} - ${skrocGodzine(p.do)}`).join('; ');
}

// Odporne na format z zera wiodącym i bez niego, ze spacjami wokół myślnika
// albo bez — split('-') i trim() ogarniają obie wersje (nasza i archiwalna).
// Przedziały dzielimy po średniku ORAZ po przecinku: średnik to obowiązujący
// format, przecinek zostaje na wszelki wypadek (tak sklejała PWA do 1.1.0;
// w arkuszu takich wpisów nie ma — sprawdzone na migawce 2026-10-07).
function sparsujCyrkulacje(tekst) {
  if (!tekst) return [];
  return String(tekst).split(/[;,]/).map((kawalek) => kawalek.trim()).filter(Boolean).map((kawalek) => {
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

// ---------------------------------------------------------------------------
// Pasek alarmów na ekranie startowym (od 0.23.0). Akcja webhooka `alarmy`
// zwraca to, co dziś przychodzi mailem: niską baterię i brak pulsu telefonu,
// ciszę czujników i luki do uzupełnienia importem. Sprawdzamy przy starcie,
// przy każdym powrocie na ekran startowy i przy powrocie aplikacji z tła —
// nie częściej niż raz na minutę (ten sam powód co przy nastawach kotła).
//
// Nic nie trafia do localStorage: stary alarm z bufora mógłby straszyć
// czymś, co już minęło. Gdy sprawdzenie się nie uda (offline), pasek
// zostaje taki, jaki był — nie dokładamy alarmu „brak połączenia”, bo
// o tym mówi już kolejka offline.
// ---------------------------------------------------------------------------
const pasekAlarmow = document.getElementById('pasek-alarmow');
let czasOstatniegoSprawdzeniaAlarmow = 0;
let sprawdzanieAlarmowWToku = false;

function odswiezAlarmy() {
  if (!czyUstawieniaZapisane()) return;
  if (sprawdzanieAlarmowWToku) return;
  if (Date.now() - czasOstatniegoSprawdzeniaAlarmow < MIN_ODSTEP_POBRANIA_MS) return;
  sprawdzanieAlarmowWToku = true;
  czasOstatniegoSprawdzeniaAlarmow = Date.now();
  pobierzAlarmy()
    .then((wynik) => { if (wynik.ok) renderujAlarmy(wynik.alarmy || []); })
    .catch((blad) => console.error('Sprawdzenie alarmów nie powiodło się:', blad))
    .finally(() => { sprawdzanieAlarmowWToku = false; });
}

function renderujAlarmy(alarmy) {
  pasekAlarmow.innerHTML = '';
  pasekAlarmow.classList.toggle('ukryty', alarmy.length === 0);
  // Najpierw to, co dzieje się teraz („alarm”), potem rzeczy do zrobienia
  // przy okazji („uwaga”).
  const kolejnosc = { alarm: 0, uwaga: 1 };
  [...alarmy]
    .sort((a, b) => (kolejnosc[a.poziom] ?? 2) - (kolejnosc[b.poziom] ?? 2))
    .forEach((a) => {
      const wiersz = element('p', `pasek-alarmow__pozycja pasek-alarmow__pozycja--${a.poziom === 'alarm' ? 'alarm' : 'uwaga'}`);
      wiersz.appendChild(element('span', 'pasek-alarmow__znak', a.poziom === 'alarm' ? '⚠' : 'ℹ'));
      wiersz.appendChild(element('span', 'pasek-alarmow__tekst', a.tekst));
      pasekAlarmow.appendChild(wiersz);
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

  // Dodatkowa, wąska kolumna na strzałkę rozwijania (od 0.21.0).
  naglowek.insertAdjacentHTML('beforeend', '<th aria-hidden="true"></th>');

  const tbody = document.createElement('tbody');
  dni.forEach((d) => {
    const wiersz = document.createElement('tr');
    wiersz.className = 'wiersz-dnia';
    wiersz.dataset.data = d.data;
    // Wiersz działa jak przycisk: stuknięcie (albo Enter na klawiaturze)
    // rozwija pod nim wykres temperatur z tej doby.
    wiersz.tabIndex = 0;
    wiersz.setAttribute('role', 'button');
    wiersz.setAttribute('aria-expanded', 'false');
    const komorki = czujniki.map((cz) => {
      const wartosc = d.czujniki ? d.czujniki[cz] : undefined;
      return `<td>${typeof wartosc === 'number' ? wartosc.toFixed(1) + '°' : '—'}</td>`;
    }).join('');
    wiersz.innerHTML = `<td>${d.data}</td>${komorki}<td class="wiersz-dnia__strzalka" aria-hidden="true">▾</td>`;
    wiersz.addEventListener('click', () => przelaczWykresDoby(wiersz, czujniki.length + 2));
    wiersz.addEventListener('keydown', (zdarzenie) => {
      if (zdarzenie.key === 'Enter' || zdarzenie.key === ' ') {
        zdarzenie.preventDefault();
        przelaczWykresDoby(wiersz, czujniki.length + 2);
      }
    });
    tbody.appendChild(wiersz);
  });
  tabelaTemperatur.appendChild(tbody);

  // Tabela bywa rysowana dwa razy (najpierw z bufora, potem ze świeżej
  // odpowiedzi) — jeśli jakiś dzień był rozwinięty, rozwijamy go ponownie,
  // żeby podmiana danych nie zamykała wykresu pod palcem.
  if (rozwinietyDzien) {
    const wiersz = tbody.querySelector(`tr[data-data="${rozwinietyDzien}"]`);
    rozwinietyDzien = null;
    if (wiersz) przelaczWykresDoby(wiersz, czujniki.length + 2);
  }
}

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

function kolorCzujnika(nazwa, indeks) {
  return KOLORY_CZUJNIKOW[nazwa] || KOLORY_ZAPASOWE[indeks % KOLORY_ZAPASOWE.length];
}

function przelaczWykresDoby(wiersz, liczbaKolumn) {
  const data = wiersz.dataset.data;
  const bylOtwarty = rozwinietyDzien === data;

  // Zamykamy to, co było otwarte (jeden dzień naraz).
  tabelaTemperatur.querySelectorAll('.wiersz-wykresu').forEach((w) => w.remove());
  tabelaTemperatur.querySelectorAll('.wiersz-dnia--rozwiniety').forEach((w) => {
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
  wczytajGodzinyDoby(data, komorka);
}

async function wczytajGodzinyDoby(data, komorka) {
  const generacja = generacjaPodgladu;
  try {
    const wynik = await pobierzTemperaturyGodzinowe(data);
    // Ekran zamknięty albo w międzyczasie rozwinięty inny dzień — nie rysujemy.
    if (generacja !== generacjaPodgladu || rozwinietyDzien !== data || !komorka.isConnected) return;
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

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(znacznik, atrybuty = {}, tekst) {
  const el = document.createElementNS(SVG_NS, znacznik);
  for (const [k, v] of Object.entries(atrybuty)) el.setAttribute(k, v);
  if (tekst !== undefined) el.textContent = tekst;
  return el;
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

// Ile pozycji pokazują ekrany podglądu: ostatnich wpisów z `odczyty`
// i ostatnich dni z `temp_doba`. Jedna stała dla obu, żeby zmieniać to
// w jednym miejscu. 20 wystarcza do sprawdzenia z telefonu, co ostatnio
// poszło do arkusza, a krótsza lista daje mniejszą odpowiedź webhooka.
const ILE_POZYCJI_PODGLADU = 20;

// Od 0.22.0 podgląd to dwa osobne ekrany — każdy pobiera tylko swoje dane
// (wcześniej jeden ekran czekał na dwa zapytania naraz). Wspólny licznik
// generacji wystarcza, bo naraz widać najwyżej jeden z tych ekranów:
// spóźniona odpowiedź z poprzedniego otwarcia nie narysuje się w nowym.
function otworzOdczyty() {
  komunikatStart.classList.add('ukryty');
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;
  listaOstatnichOdczytow.innerHTML = '';
  pokazEkran(ekranOdczyty);

  wczytajBlokPodgladu(() => generacja === generacjaPodgladu, {
    status: statusOdczytow,
    klucz: 'ostatnie_odczyty',
    pobierz: () => pobierzOstatnieOdczyty(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujOstatnieOdczyty(wynik.odczyty),
  });
}

function otworzTemperatury() {
  komunikatStart.classList.add('ukryty');
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;
  tabelaTemperatur.innerHTML = '';
  // Każde otwarcie zaczyna ze zwiniętą tabelą. Pamięć godzin czyścimy,
  // bo dzień importu mógł w międzyczasie dostać nowe godziny.
  rozwinietyDzien = null;
  pamiecGodzin.clear();
  pokazEkran(ekranTemperatury);

  wczytajBlokPodgladu(() => generacja === generacjaPodgladu, {
    status: statusTemperatur,
    klucz: 'temperatury_dobowe',
    pobierz: () => pobierzTemperaturyDobowe(ILE_POZYCJI_PODGLADU),
    renderuj: (wynik) => renderujTemperaturyDobowe(wynik.dni),
  });
}

// Bez zapisanego adresu i tokenu nie ma skąd pobrać danych — wtedy
// najpierw ekran ustawień, jak przy pozostałych kartach.
function poUstawieniach(otworz) {
  return () => {
    if (!czyUstawieniaZapisane()) {
      otworzUstawienia();
      return;
    }
    otworz();
  };
}

przyciskOdczyty.addEventListener('click', poUstawieniach(otworzOdczyty));
przyciskTemperatury.addEventListener('click', poUstawieniach(otworzTemperatury));
przyciskZamknijOdczyty.addEventListener('click', () => pokazEkran(ekranStart));
przyciskZamknijTemperatury.addEventListener('click', () => pokazEkran(ekranStart));

// --- Zbieracz temperatur na telefonie (BACKLOG pkt 19, od 1.1.0) ---
//
// Tylko do odczytu, z akcji stan_zbieracza. Werdykt NIE jest liczony tutaj:
// liczy go webhook tymi samymi regułami (progi, okno luk) co pasek alarmów
// na ekranie startowym — dzięki temu karta i pasek nie mogą sobie przeczyć.
// Bufor w localStorage jak w Odczytach i Temperaturach: stary stan widać od
// razu, a wiersz statusu mówi, z kiedy jest, dopóki nie przyjdzie świeży.

const WERDYKTY_ZBIERACZA = {
  ok:       { tekst: 'Zbieracz działa', opis: 'Telefon i wszystkie czujniki przysyłają dane.' },
  uwaga:    { tekst: 'Działa, są uwagi', opis: 'Nic pilnego — szczegóły niżej.' },
  problem:  { tekst: 'Problem ze zbieraniem', opis: 'Coś wymaga sprawdzenia teraz.' },
  nieznany: { tekst: 'Stan nieznany', opis: 'Pilnowanie luk nie jest włączone (właściwość LUKI_OD).' },
};

// Opisy ról czujników. Nieznana rola pokaże się pod własną nazwą —
// listy czujników nie zaszywamy, przychodzi z webhooka.
const NAZWY_ROL = { zewn: 'Na zewnątrz', parter: 'Parter', pietro: 'Piętro' };

// Stan ładowania tak, jak podaje go termux-battery-status.
const STANY_LADOWANIA = {
  Charging: 'ładuje się', Discharging: 'rozładowuje się',
  Full: 'naładowana', 'Not charging': 'nie ładuje',
};

let generacjaZbieracza = 0;

// „5 min temu”, „3 h 20 min temu” — wiek liczymy na telefonie od znacznika
// czasu, a nie z pola wiek_min odpowiedzi, bo stan z bufora może mieć
// kilka godzin, a wtedy wiek z odpowiedzi byłby nieaktualny.
function opiszOdKiedy(tekstIso) {
  const czas = tekstIso ? new Date(tekstIso) : null;
  if (!czas || Number.isNaN(czas.getTime())) return '';
  const minut = Math.max(Math.round((Date.now() - czas.getTime()) / 60000), 0);
  if (minut < 60) return `${minut} min temu`;
  const godzin = Math.floor(minut / 60);
  if (godzin < 48) return `${godzin} h${minut % 60 ? ` ${minut % 60} min` : ''} temu`;
  return `${Math.floor(godzin / 24)} dni temu`;
}

// Jeden wiersz „etykieta — wartość” w stylu listy odczytów.
function wierszZbieracza(etykieta, wartosc, dopisek) {
  const wiersz = element('div', 'wiersz-odczytu');
  wiersz.appendChild(element('span', 'wiersz-odczytu__medium', etykieta));
  const prawa = element('span', 'wiersz-odczytu__stan', wartosc);
  if (dopisek) prawa.appendChild(element('span', 'zbieracz__dopisek', dopisek));
  wiersz.appendChild(prawa);
  return wiersz;
}

function sekcjaZbieracza(tytul) {
  stanZbieraczaKontener.appendChild(element('h3', 'podglad__naglowek', tytul));
  const lista = element('div', 'lista-odczytow');
  stanZbieraczaKontener.appendChild(lista);
  return lista;
}

function renderujStanZbieracza(wynik) {
  stanZbieraczaKontener.innerHTML = '';

  // Werdykt — duża plakietka na górze.
  const werdykt = WERDYKTY_ZBIERACZA[wynik.werdykt] || WERDYKTY_ZBIERACZA.nieznany;
  const plakietka = element('div', `zbieracz__werdykt zbieracz__werdykt--${wynik.werdykt in WERDYKTY_ZBIERACZA ? wynik.werdykt : 'nieznany'}`);
  plakietka.appendChild(element('strong', 'zbieracz__werdykt-tytul', werdykt.tekst));
  plakietka.appendChild(element('span', 'zbieracz__werdykt-opis',
    `${werdykt.opis} Sprawdzono ${formatujDataGodzinePodgladu(wynik.sprawdzono)}.`));
  stanZbieraczaKontener.appendChild(plakietka);

  // Alarmy zbieracza — ten sam wygląd co pasek na ekranie startowym.
  const alarmy = wynik.alarmy || [];
  if (alarmy.length > 0) {
    const lista = element('div', 'pasek-alarmow');
    const kolejnosc = { alarm: 0, uwaga: 1 };
    [...alarmy]
      .sort((a, b) => (kolejnosc[a.poziom] ?? 2) - (kolejnosc[b.poziom] ?? 2))
      .forEach((a) => {
        const poziom = a.poziom === 'alarm' ? 'alarm' : 'uwaga';
        const wiersz = element('p', `pasek-alarmow__pozycja pasek-alarmow__pozycja--${poziom}`);
        wiersz.appendChild(element('span', 'pasek-alarmow__znak', poziom === 'alarm' ? '⚠' : 'ℹ'));
        wiersz.appendChild(element('span', 'pasek-alarmow__tekst', a.tekst));
        lista.appendChild(wiersz);
      });
    stanZbieraczaKontener.appendChild(lista);
  }

  // Telefon — z ostatniego pulsu (wysyłany co godzinę).
  const listaTelefonu = sekcjaZbieracza('Telefon');
  const t = wynik.telefon;
  if (!t) {
    listaTelefonu.appendChild(element('p', 'komunikat-pusto', 'Telefon nie wysłał jeszcze pulsu.'));
  } else {
    listaTelefonu.appendChild(wierszZbieracza('Ostatni puls',
      formatujDataGodzinePodgladu(t.czas), opiszOdKiedy(t.czas)));
    if (t.bateria !== null && t.bateria !== undefined) {
      listaTelefonu.appendChild(wierszZbieracza('Bateria', `${t.bateria} %`,
        STANY_LADOWANIA[t.ladowanie] || t.ladowanie || ''));
    }
    if (t.temp_baterii !== null && t.temp_baterii !== undefined) {
      listaTelefonu.appendChild(wierszZbieracza('Temperatura baterii', `${liczbaPL(t.temp_baterii)} °C`));
    }
    if (t.kolejka !== null && t.kolejka !== undefined) {
      listaTelefonu.appendChild(wierszZbieracza('Kolejka do wysłania',
        t.kolejka === 0 ? 'pusta' : `${t.kolejka} pomiarów`));
    }
    if (t.wersja) listaTelefonu.appendChild(wierszZbieracza('Wersja', t.wersja));
  }

  // Czujniki — ostatnia godzina, która doszła do temp_raw. Wiersz godzinowy
  // ma znacznik POCZĄTKU godziny i przychodzi po jej zamknięciu, więc
  // „17:00” o 18:40 to stan prawidłowy.
  const listaCzujnikow = sekcjaZbieracza('Czujniki — ostatnia godzina w arkuszu');
  const czujniki = Object.entries(wynik.czujniki || {});
  if (czujniki.length === 0) {
    listaCzujnikow.appendChild(element('p', 'komunikat-pusto', 'Brak danych o czujnikach.'));
  }
  czujniki.forEach(([rola, c], indeks) => {
    const wiersz = element('div', 'wiersz-odczytu');
    const nazwa = element('span', 'wiersz-odczytu__medium zbieracz__czujnik', NAZWY_ROL[rola] || rola);
    nazwa.style.setProperty('--kolor', kolorCzujnika(rola, indeks));
    wiersz.appendChild(nazwa);
    wiersz.appendChild(element('span', 'wiersz-odczytu__data',
      c.ostatni ? formatujDataGodzinePodgladu(c.ostatni) : 'brak'));
    const prawa = element('span', 'wiersz-odczytu__stan',
      c.temp !== null && c.temp !== undefined ? `${liczbaPL(c.temp)} °C` : '—');
    if (c.zrodlo) prawa.appendChild(element('span', 'zbieracz__dopisek', c.zrodlo));
    wiersz.appendChild(prawa);
    listaCzujnikow.appendChild(wiersz);
  });

  // Luki — godziny bez wiersza w oknie raportu tygodniowego.
  const listaLuk = sekcjaZbieracza(`Luki w ostatnich ${wynik.luki_okno_dni || 28} dniach`);
  const luki = Object.entries(wynik.luki || {});
  if (!wynik.od) {
    listaLuk.appendChild(element('p', 'komunikat-pusto', 'Nie liczone — brak LUKI_OD.'));
  } else if (luki.every(([, godzin]) => !godzin)) {
    listaLuk.appendChild(element('p', 'komunikat-pusto',
      `Brak luk od początku zbierania (${formatujDataGodzinePodgladu(wynik.od)}).`));
  } else {
    luki.forEach(([rola, godzin]) => {
      listaLuk.appendChild(wierszZbieracza(NAZWY_ROL[rola] || rola, godzin ? `${godzin} h` : 'brak'));
    });
  }

  // eWeLink — tokeny Sonoffów wygasają; datę wpisuje się ręcznie we
  // właściwości skryptu EWELINK_WYGASA po każdym odnowieniu.
  const listaEwelink = sekcjaZbieracza('eWeLink (Sonoffy)');
  const e = wynik.ewelink;
  if (!e) {
    listaEwelink.appendChild(element('p', 'komunikat-pusto',
      'Data wygaśnięcia tokenów nieustawiona (właściwość EWELINK_WYGASA).'));
  } else {
    listaEwelink.appendChild(wierszZbieracza('Tokeny ważne do', e.wygasa,
      e.dni < 0 ? 'wygasły' : `za ${e.dni} dni`));
  }
}

function otworzZbieracz() {
  komunikatStart.classList.add('ukryty');
  generacjaZbieracza++;
  const generacja = generacjaZbieracza;
  stanZbieraczaKontener.innerHTML = '';
  pokazEkran(ekranZbieracz);

  wczytajBlokPodgladu(() => generacja === generacjaZbieracza, {
    status: statusZbieracza,
    klucz: 'stan_zbieracza',
    pobierz: pobierzStanZbieracza,
    renderuj: renderujStanZbieracza,
  });
}

przyciskZbieracz.addEventListener('click', poUstawieniach(otworzZbieracz));
przyciskZamknijZbieracz.addEventListener('click', () => pokazEkran(ekranStart));

// --- Notatnik pomysłów (BACKLOG pkt 5, od 1.2.0) ---
//
// Hasło zapisane tutaj trafia do zakładki `pomysly` (akcja zapisz_pomysl),
// skąd Claude na żądanie przenosi je do backlogu i oznacza status. Zapis
// idzie jak odczyty: od razu, a bez odpowiedzi — do kolejki offline.
// `id` nadajemy tutaj, przed pierwszą próbą, i zostaje ten sam w kolejce —
// webhook rozpoznaje powtórkę po id, więc pomysł, który doszedł bez
// potwierdzenia, nie zapisze się drugi raz.

const ILE_POMYSLOW_NA_LISCIE = 10;
const OBSZARY_POMYSLOW = { pwa: 'PWA', arkusz: 'arkusz', analiza: 'analiza', telefon: 'telefon', inne: 'inne' };
const STATUSY_POMYSLOW = { nowy: 'nowy', przeniesiony: 'w backlogu', odrzucony: 'odrzucony' };
let generacjaPomyslow = 0;
// Ostatnio pobrana lista z arkusza (null = jeszcze nic). Pozwala dorysować
// pomysły z kolejki od razu, bez czekania na webhook — także bez zasięgu.
let ostatniePomysly = null;

function nowyIdPomyslu() {
  // crypto.randomUUID działa tylko w bezpiecznym kontekście (HTTPS, localhost) —
  // na GitHub Pages jest; zapas na wszelki wypadek: czas + losowy ogon.
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function wierszPomyslu(tresc, data, obszar, status, statusTekst) {
  const wiersz = element('div', 'pomysl');
  wiersz.appendChild(element('p', 'pomysl__tresc', tresc));
  const opis = element('div', 'pomysl__opis');
  opis.appendChild(element('span', `pomysl__status pomysl__status--${status}`, statusTekst));
  if (data) opis.appendChild(element('span', '', formatujDataGodzinePodgladu(data)));
  if (obszar) opis.appendChild(element('span', '', OBSZARY_POMYSLOW[obszar] || obszar));
  wiersz.appendChild(opis);
  return wiersz;
}

// Lista: najpierw pomysły czekające w kolejce offline (arkusz ich jeszcze nie
// zna, a bez tego zapisany bez zasięgu pomysł „znikałby”), potem te z arkusza.
function renderujPomysly(pomysly) {
  if (pomysly) ostatniePomysly = pomysly;
  listaPomyslow.innerHTML = '';
  const wKolejce = pobierzKolejke().filter((w) => w.akcja === 'zapisz_pomysl');
  wKolejce.slice().reverse().forEach((p) => {
    listaPomyslow.appendChild(wierszPomyslu(p.tresc, p.data, p.obszar, 'kolejka', 'czeka na wysłanie'));
  });
  const idWKolejce = new Set(wKolejce.map((p) => p.id));
  (ostatniePomysly || []).filter((p) => !idWKolejce.has(p.id)).forEach((p) => {
    let statusTekst = STATUSY_POMYSLOW[p.status] || p.status;
    if (p.status === 'przeniesiony' && p.punkt_backlogu) statusTekst = `backlog pkt ${p.punkt_backlogu}`;
    const wiersz = wierszPomyslu(p.tresc, p.data, p.obszar, STATUSY_POMYSLOW[p.status] ? p.status : 'nowy', statusTekst);
    if (p.uwagi) wiersz.appendChild(element('p', 'pomysl__opis', p.uwagi));
    listaPomyslow.appendChild(wiersz);
  });
  // „Pusto” tylko gdy wiemy to z arkusza — w trakcie pierwszego wczytywania
  // (ostatniePomysly === null) lista zostaje pusta, a status mówi „Wczytywanie…”.
  if (!listaPomyslow.firstChild && ostatniePomysly) {
    listaPomyslow.appendChild(element('p', 'komunikat-pusto', 'Jeszcze nie ma pomysłów.'));
  }
}

function wczytajPomysly() {
  generacjaPomyslow++;
  const generacja = generacjaPomyslow;
  wczytajBlokPodgladu(() => generacja === generacjaPomyslow, {
    status: statusPomyslow,
    klucz: 'pomysly',
    pobierz: () => pobierzPomysly(ILE_POMYSLOW_NA_LISCIE),
    renderuj: (wynik) => renderujPomysly(wynik.pomysly),
  });
}

function otworzPomysly() {
  komunikatStart.classList.add('ukryty');
  komunikatPomyslu.classList.add('ukryty');
  polePomysl.value = '';
  poleObszarPomyslu.value = '';
  renderujPomysly(null);   // od razu to, co czeka w kolejce (bufor dorysuje resztę)
  pokazEkran(ekranPomysly);
  wczytajPomysly();
  polePomysl.focus();
}

// rodzaj: 'blad' (czerwony), 'sukces' (zielony), 'kolejka' (żółty) — te same
// klasy co komunikaty odczytów na ekranie startowym.
function pokazKomunikatPomyslu(tekst, rodzaj = 'blad') {
  komunikatPomyslu.className = rodzaj === 'sukces' ? 'komunikat-sukces' : rodzaj === 'kolejka' ? 'komunikat-kolejka' : 'komunikat';
  komunikatPomyslu.textContent = tekst;
}

formularzPomyslu.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const tresc = polePomysl.value.trim();
  if (!tresc) {
    pokazKomunikatPomyslu('Wpisz kilka słów.');
    return;
  }
  const pomysl = {
    id: nowyIdPomyslu(),
    data: `${sformatujDataGodzinaLokalnie(new Date())}:00`,
    obszar: poleObszarPomyslu.value,
    tresc,
  };

  przyciskZapiszPomysl.disabled = true;
  przyciskZapiszPomysl.textContent = 'Wysyłanie…';
  try {
    const odpowiedz = await zapiszPomysl(pomysl);
    if (!odpowiedz.ok) {
      pokazKomunikatPomyslu(odpowiedz.blad || 'Webhook odrzucił pomysł.');
      return;
    }
    pokazKomunikatPomyslu('Zapisano pomysł.', 'sukces');
  } catch (blad) {
    // Brak odpowiedzi — do kolejki offline z tym samym id (patrz wyżej).
    console.error('Nie udało się wysłać pomysłu, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'zapisz_pomysl', ...pomysl });
    aktualizujKomunikatKolejki();
    pokazKomunikatPomyslu('Pomysł zapisany w telefonie — brak odpowiedzi serwera, pójdzie sam, gdy wróci internet.', 'kolejka');
  } finally {
    przyciskZapiszPomysl.disabled = false;
    przyciskZapiszPomysl.textContent = 'Zapisz pomysł';
  }
  polePomysl.value = '';
  poleObszarPomyslu.value = '';
  renderujPomysly(null);   // pomysł z kolejki widać od razu, nawet gdy odświeżenie się nie uda
  wyczyscBuforKlucz('pomysly');
  wczytajPomysly();
});

przyciskPomysly.addEventListener('click', poUstawieniach(otworzPomysly));
przyciskZamknijPomysly.addEventListener('click', () => pokazEkran(ekranStart));

// --- Faktura za gaz z PDF (od 1.3.0) ---
//
// PDF → akcja odczytaj_fakture (Gemini proponuje wiersze, nic nie zapisuje)
// → formularz do sprawdzenia → zapisz_fakture. Jak przy zdjęciu licznika:
// model tylko podpowiada, zapis zawsze po świadomym zatwierdzeniu.
// Dwie kontrole na ekranie, bo pomyłka modelu w jednej cyfrze psuje koszty:
//  - ciągłość z ostatnią fakturą w arkuszu (data i odczyt początkowy),
//  - brutto wyliczone z pól (jak formuły zakładki `faktury`) vs kwota z faktury.
// Bez kolejki offline: ten sam numer drugi raz webhook odrzuca jako duplikat,
// więc ponowienie po braku odpowiedzi jest bezpieczne — robi to sam Paweł.

const MAKS_ROZMIAR_PDF = 8 * 1024 * 1024;   // Apps Script i Gemini przyjmą więcej, ale base64 rośnie o 1/3
const MAKS_OKRESOW_FAKTURY = 4;
let generacjaFaktury = 0;
// Ostatnia faktura z arkusza i zapas wierszy z formułami — z odpowiedzi
// odczytaj_fakture (przy wpisie ręcznym brak, wtedy ciągłości nie sprawdzamy).
let stanArkuszaFaktur = null;

function plikDoBase64(plik) {
  return new Promise((rozwiaz, odrzuc) => {
    const czytnik = new FileReader();
    czytnik.onload = () => rozwiaz(String(czytnik.result).split(',')[1]);
    czytnik.onerror = () => odrzuc(czytnik.error);
    czytnik.readAsDataURL(plik);
  });
}

// Liczba w polu: przecinek i kropka jako separator (polska klawiatura).
function liczbaZPola(pole) {
  const tekst = String(pole.value).trim().replace(',', '.');
  if (tekst === '') return null;
  const liczba = Number(tekst);
  return Number.isFinite(liczba) ? liczba : null;
}

function dodajOkresFaktury(okres = {}) {
  const fragment = szablonOkresuFaktury.content.cloneNode(true);
  const blok = fragment.querySelector('.faktura__okres');
  blok.querySelectorAll('[data-pole]').forEach((pole) => {
    const wartosc = okres[pole.dataset.pole];
    if (wartosc === null || wartosc === undefined) return;
    // VAT przychodzi jako ułamek (0.23), w formularzu jest w procentach.
    pole.value = 'procent' in pole.dataset ? Math.round(wartosc * 10000) / 100 : wartosc;
  });
  blok.querySelector('.faktura__usun').addEventListener('click', () => {
    blok.remove();
    ponumerujOkresy();
    przeliczKontroleFaktury();
  });
  blok.addEventListener('input', przeliczKontroleFaktury);
  okresyFaktury.appendChild(blok);
  ponumerujOkresy();
}

function ponumerujOkresy() {
  const bloki = [...okresyFaktury.querySelectorAll('.faktura__okres')];
  bloki.forEach((b, i) => {
    b.querySelector('.faktura__nr').textContent = bloki.length > 1 ? `${i + 1} z ${bloki.length}` : '';
    b.querySelector('.faktura__usun').classList.toggle('ukryty', bloki.length === 1);
  });
  przyciskDodajOkres.classList.toggle('ukryty', bloki.length >= MAKS_OKRESOW_FAKTURY);
}

function odczytajOkresy() {
  return [...okresyFaktury.querySelectorAll('.faktura__okres')].map((blok) => {
    const okres = {};
    blok.querySelectorAll('[data-pole]').forEach((pole) => {
      const nazwa = pole.dataset.pole;
      if (pole.type === 'date' || nazwa === 'uwagi') {
        okres[nazwa] = pole.value.trim() || null;
      } else {
        const v = liczbaZPola(pole);
        okres[nazwa] = v === null ? null : ('procent' in pole.dataset ? Math.round(v * 100) / 10000 : v);
      }
    });
    return okres;
  });
}

// Brutto okresu dokładnie jak formuły zakładki `faktury`: kWh zaokrąglone
// do całości, składniki netto do groszy, brutto okresu do groszy.
function bruttoOkresu(o) {
  const pola = ['odczyt_od', 'odczyt_do', 'wsp_konwersji', 'cena_paliwo', 'vat_paliwo',
    'cena_dystr', 'vat_dystr', 'abonament', 'dystr_stala', 'vat_stale'];
  if (pola.some((p) => o[p] === null)) return null;
  const grosze = (x) => Math.round(x * 100) / 100;
  const kwh = Math.round((o.odczyt_do - o.odczyt_od) * o.wsp_konwersji);
  const paliwo = grosze(kwh * o.cena_paliwo);
  const dystr = grosze(kwh * o.cena_dystr);
  const stale = o.abonament + o.dystr_stala;
  return grosze(paliwo * (1 + o.vat_paliwo) + dystr * (1 + o.vat_dystr) + stale * (1 + o.vat_stale));
}

function zlotowki(x) {
  return `${x.toFixed(2).replace('.', ',')} zł`;
}

function dzienPo(tekstDaty) {
  const [r, m, d] = tekstDaty.split('-').map(Number);
  const data = new Date(Date.UTC(r, m - 1, d + 1));
  return data.toISOString().slice(0, 10);
}

// Ciągłość z poprzednią fakturą i kontrola brutto — przeliczane przy każdej
// zmianie pola. Tylko ostrzeżenia: zapis zostaje możliwy (wymiana gazomierza
// czy korekta faktury potrafią celowo złamać ciągłość).
function przeliczKontroleFaktury() {
  const okresy = odczytajOkresy();
  const uwagi = [];
  const p = stanArkuszaFaktur && stanArkuszaFaktur.poprzednia;
  if (p && okresy.length > 0) {
    const pierwszy = okresy[0];
    if (p.okres_do && pierwszy.okres_od && pierwszy.okres_od !== dzienPo(p.okres_do)) {
      uwagi.push(`Poprzednia faktura (${p.nr_faktury}) kończy się ${p.okres_do} — ten okres powinien zacząć się ${dzienPo(p.okres_do)}.`);
    }
    if (p.odczyt_do !== null && pierwszy.odczyt_od !== null && Math.abs(pierwszy.odczyt_od - p.odczyt_do) > 0.0005) {
      uwagi.push(`Poprzednia faktura kończy się odczytem ${p.odczyt_do} m³, ta zaczyna od ${pierwszy.odczyt_od} m³ (w porządku tylko przy wymianie gazomierza).`);
    }
  }
  for (let i = 1; i < okresy.length; i++) {
    const a = okresy[i - 1], b = okresy[i];
    if (a.okres_do && b.okres_od && b.okres_od !== dzienPo(a.okres_do)) {
      uwagi.push(`Okres ${i + 1} powinien zacząć się ${dzienPo(a.okres_do)} (dzień po końcu okresu ${i}).`);
    }
  }
  if (stanArkuszaFaktur && stanArkuszaFaktur.wolnych_wierszy < okresy.length) {
    uwagi.push(`W zakładce faktury jest ${stanArkuszaFaktur.wolnych_wierszy} wolnych wierszy z formułami, a faktura potrzebuje ${okresy.length} — przeciągnij formuły (kolumny P–AE) w dół przed zapisem.`);
  }

  ciagloscFaktury.innerHTML = '';
  uwagi.forEach((u) => ciagloscFaktury.appendChild(element('p', 'pasek-alarmow__pozycja pasek-alarmow__pozycja--uwaga', u)));

  const brutta = okresy.map(bruttoOkresu);
  const deklarowane = liczbaZPola(poleBruttoFaktury);
  if (brutta.every((b) => b !== null) && brutta.length > 0) {
    const suma = Math.round(brutta.reduce((s, b) => s + b, 0) * 100) / 100;
    if (deklarowane === null) {
      kontrolaFaktury.textContent = `Brutto wyliczone z pól: ${zlotowki(suma)}.`;
      kontrolaFaktury.className = 'faktura__kontrola';
    } else {
      const roznica = Math.round((deklarowane - suma) * 100) / 100;
      const zgodne = Math.abs(roznica) <= 0.05;
      kontrolaFaktury.textContent = zgodne
        ? `Brutto wyliczone z pól: ${zlotowki(suma)} — zgadza się z fakturą.`
        : `Brutto wyliczone z pól: ${zlotowki(suma)}, na fakturze ${zlotowki(deklarowane)} — różnica ${zlotowki(roznica)}. Sprawdź ceny, VAT i odczyty.`;
      kontrolaFaktury.className = `faktura__kontrola faktura__kontrola--${zgodne ? 'ok' : 'roznica'}`;
    }
  } else {
    kontrolaFaktury.textContent = 'Uzupełnij wszystkie pola okresów, żeby sprawdzić brutto.';
    kontrolaFaktury.className = 'faktura__kontrola';
  }
}

function pokazFormularzFaktury(dane = {}) {
  poleNrFaktury.value = dane.nr_faktury || '';
  poleBruttoFaktury.value = dane.faktura_brutto ?? '';
  okresyFaktury.innerHTML = '';
  const okresy = dane.okresy && dane.okresy.length ? dane.okresy : [{}];
  okresy.forEach((o) => dodajOkresFaktury(o));
  formularzFaktury.classList.remove('ukryty');
  przeliczKontroleFaktury();
}

function otworzFakture() {
  komunikatStart.classList.add('ukryty');
  generacjaFaktury++;
  stanArkuszaFaktur = null;
  formularzFaktury.classList.add('ukryty');
  komunikatFaktury.classList.add('ukryty');
  ustawStatusBloku(statusFaktury, '', 'info');
  plikFaktury.value = '';
  pokazEkran(ekranFaktura);
}

przyciskPdfFaktury.addEventListener('click', () => plikFaktury.click());
przyciskFakturaRecznie.addEventListener('click', () => {
  ustawStatusBloku(statusFaktury, '', 'info');
  pokazFormularzFaktury();
});

plikFaktury.addEventListener('change', async () => {
  const plik = plikFaktury.files && plikFaktury.files[0];
  if (!plik) return;
  if (plik.size > MAKS_ROZMIAR_PDF) {
    ustawStatusBloku(statusFaktury, 'Plik jest za duży (ponad 8 MB) — to raczej nie e-faktura.', 'blad');
    return;
  }
  const generacja = ++generacjaFaktury;
  formularzFaktury.classList.add('ukryty');
  komunikatFaktury.classList.add('ukryty');
  ustawStatusBloku(statusFaktury, 'Rozpoznawanie faktury… (zwykle kilkanaście sekund)', 'wczytywanie');
  przyciskPdfFaktury.disabled = true;
  try {
    const wynik = await odczytajFakture(await plikDoBase64(plik));
    if (generacja !== generacjaFaktury) return;
    if (!wynik.ok) {
      ustawStatusBloku(statusFaktury, `Nie udało się rozpoznać: ${wynik.blad}. Możesz wpisać fakturę ręcznie.`, 'blad');
      return;
    }
    stanArkuszaFaktur = { poprzednia: wynik.poprzednia, wolnych_wierszy: wynik.wolnych_wierszy };
    if (!wynik.pasuje) {
      ustawStatusBloku(statusFaktury, `To nie wygląda na fakturę za gaz z rozliczeniem${wynik.problem ? ` (${wynik.problem})` : ''}.`, 'blad');
      return;
    }
    const pewnosc = { wysoka: 'wysoka', srednia: 'średnia', niska: 'niska' }[wynik.pewnosc] || wynik.pewnosc;
    ustawStatusBloku(statusFaktury,
      `Rozpoznano (pewność: ${pewnosc})${wynik.problem ? ` — ${wynik.problem}` : ''}. Sprawdź pola z fakturą.`,
      wynik.pewnosc === 'wysoka' && !wynik.problem ? 'info' : 'blad');
    pokazFormularzFaktury(wynik);
  } catch (blad) {
    if (generacja !== generacjaFaktury) return;
    console.error('Nie udało się wysłać faktury do rozpoznania:', blad);
    ustawStatusBloku(statusFaktury, 'Brak połączenia z serwerem — spróbuj ponownie albo wpisz fakturę ręcznie.', 'blad');
  } finally {
    przyciskPdfFaktury.disabled = false;
    plikFaktury.value = '';
  }
});

przyciskDodajOkres.addEventListener('click', () => {
  // Nowy okres zaczyna się dzień po końcu poprzedniego i od jego odczytu —
  // najczęstszy przypadek (zmiana ceny w środku rozliczenia).
  const okresy = odczytajOkresy();
  const ost = okresy[okresy.length - 1] || {};
  dodajOkresFaktury({
    okres_od: ost.okres_do ? dzienPo(ost.okres_do) : null,
    odczyt_od: ost.odczyt_do, wsp_konwersji: ost.wsp_konwersji,
    vat_paliwo: ost.vat_paliwo, vat_dystr: ost.vat_dystr, vat_stale: ost.vat_stale,
  });
  przeliczKontroleFaktury();
});

poleBruttoFaktury.addEventListener('input', przeliczKontroleFaktury);

formularzFaktury.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const faktura = {
    nr_faktury: poleNrFaktury.value.trim(),
    faktura_brutto: liczbaZPola(poleBruttoFaktury),
    okresy: odczytajOkresy(),
  };
  przyciskZapiszFakture.disabled = true;
  przyciskZapiszFakture.textContent = 'Zapisywanie…';
  try {
    const wynik = await zapiszFakture(faktura);
    if (!wynik.ok) {
      komunikatFaktury.className = 'komunikat';
      komunikatFaktury.textContent = wynik.blad || 'Webhook odrzucił fakturę.';
      return;
    }
    komunikatStart.textContent = wynik.duplikat
      ? `Faktura ${faktura.nr_faktury} już jest w arkuszu — nic nie zapisano.`
      : `Zapisano fakturę ${faktura.nr_faktury} (${faktura.okresy.length === 1 ? 'wiersz' : 'wiersze'} ` +
        `${wynik.wiersz_od}${wynik.wiersz_do !== wynik.wiersz_od ? `–${wynik.wiersz_do}` : ''} zakładki faktury).`;
    komunikatStart.classList.remove('ukryty');
    pokazEkran(ekranStart);
  } catch (blad) {
    console.error('Nie udało się zapisać faktury:', blad);
    komunikatFaktury.className = 'komunikat';
    komunikatFaktury.textContent = 'Brak odpowiedzi serwera. Zapisz ponownie — jeśli faktura już doszła, ' +
      'aplikacja to rozpozna i nie zapisze jej drugi raz.';
  } finally {
    przyciskZapiszFakture.disabled = false;
    przyciskZapiszFakture.textContent = 'Zapisz fakturę';
  }
});

przyciskFaktura.addEventListener('click', poUstawieniach(otworzFakture));
przyciskZamknijFakture.addEventListener('click', () => pokazEkran(ekranStart));

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

// `element` pozwala użyć tej samej uwagi na ekranie potwierdzenia
// i na ekranie prądu (każdy ma własny akapit pod polem daty).
function ustawUwageCzasu(czasZdjecia, element = uwagaCzasu) {
  const uwaga = czasZdjecia ? UWAGI_CZASU[czasZdjecia.zrodlo] : null;
  element.classList.toggle('ukryty', !uwaga);
  element.classList.toggle('uwaga-pola--przyblizona', Boolean(uwaga && uwaga.przyblizona));
  element.textContent = uwaga ? uwaga.tekst : '';
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
  // Rozpoznawanie tylko dla mediów, dla których backend ma podpowiedź OCR
  // (MEDIA_Z_OCR w js/media.js). Dla pozostałych (na dziś woda) zdjęcie
  // służy wyłącznie jako podgląd do przepisania — bez tego warunku każde
  // zdjęcie kończyło się komunikatem „Brak podpowiedzi OCR” (do 0.20.0).
  if (MEDIA_Z_OCR.includes(medium)) {
    await rozpoznajIWypelnij(medium, blob, generacjaPotwierdzenia);
  }
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
  if (wpis.akcja === 'zapisz_pomysl') {
    const tresc = String(wpis.tresc || '');
    return `Pomysł „${tresc.length > 30 ? `${tresc.slice(0, 30)}…` : tresc}”`;
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
  if (wyslanychOk > 0 || juzWArkuszu.length > 0) {
    wyczyscBuforKlucz('ostatnie_odczyty');
    wyczyscBuforKlucz('pomysly');   // pomysł z kolejki doszedł — lista w buforze jest stara
  }

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

// ---------------------------------------------------------------------------
// Ekran prądu (od 0.20.0) — T1, T2 i suma na jednym ekranie.
//
// Licznik prądu pokazuje te trzy wartości na zmianę, dość szybko, więc
// wygodnie jest zrobić najpierw trzy zdjęcia pod rząd, a dopiero potem
// przepisać wartości. Każdy wiersz ma własne zdjęcie, pole stanu i status;
// data i godzina są wspólne, bo to jeden moment odczytu licznika.
//
// Zapis to trzy zwykłe żądania "odczyt" wysyłane po kolei, z tym samym
// data_godzina — kontrakt webhooka się nie zmienia, a każde medium dalej
// ma własną kontrolę chronologii po stronie webhooka.
// ---------------------------------------------------------------------------

// Stan wierszy, kluczowany medium: elementy DOM + zdjęcie + czy zapisany.
const wierszePradu = {};
// Licznik otwarć ekranu — spóźniony wynik aparatu albo OCR z poprzedniego
// otwarcia nie może trafić do nowego (ten sam wzorzec co przy Kotle).
let generacjaPradu = 0;
// Data pochodzi z pierwszego zdjęcia zrobionego na tym ekranie (to jest
// moment odczytu licznika), chyba że ktoś sam poprawił pole — wtedy
// kolejne zdjęcia już jej nie ruszają.
let dataPraduZeZdjecia = false;
let dataPraduZmienionaRecznie = false;

function zbudujWierszePradu() {
  for (const { medium, opis } of POZYCJE_PRADU) {
    const opisMedium = MEDIA[medium];
    const wezel = szablonWierszaPradu.content.firstElementChild.cloneNode(true);
    wezel.querySelector('.wiersz-pradu__nazwa').textContent = opisMedium.nazwa;
    wezel.querySelector('.wiersz-pradu__opis').textContent = opis;
    wezel.querySelector('.wiersz-pradu__etykieta').textContent = `Stan (${opisMedium.jednostka})`;
    wezel.querySelector('.wiersz-pradu__zdjecie').alt = `Zdjęcie licznika — ${opisMedium.nazwa}`;
    const pole = wezel.querySelector('.wiersz-pradu__stan');
    pole.step = opisMedium.miejscaPoPrzecinku > 0
      ? (1 / 10 ** opisMedium.miejscaPoPrzecinku).toFixed(opisMedium.miejscaPoPrzecinku)
      : '1';

    const wiersz = {
      medium,
      wezel,
      pole,
      zdjecie: wezel.querySelector('.wiersz-pradu__zdjecie'),
      status: wezel.querySelector('.wiersz-pradu__status'),
      komunikat: wezel.querySelector('.wiersz-pradu__komunikat'),
      przyciskRozpoznaj: wezel.querySelector('[data-akcja="rozpoznaj"]'),
      przyciski: Array.from(wezel.querySelectorAll('.wiersz-pradu__przyciski button')),
      blob: null,
      url: null,
      zapisany: false,   // zapisany albo odłożony do kolejki — nie wysyłać ponownie
      wynik: null,       // 'zapisano' | 'kolejka' — do podsumowania na ekranie startowym
    };
    wierszePradu[medium] = wiersz;

    wezel.querySelector('[data-akcja="zdjecie"]')
      .addEventListener('click', () => zdjecieDoWierszaPradu(wiersz, zrobZdjecie));
    wezel.querySelector('[data-akcja="galeria"]')
      .addEventListener('click', () => zdjecieDoWierszaPradu(wiersz, wybierzZGalerii));
    wiersz.przyciskRozpoznaj.addEventListener('click', () => rozpoznajWierszPradu(wiersz));
    // Nowa wartość wpisana po odrzuceniu — stary komunikat błędu już nie dotyczy.
    pole.addEventListener('input', () => wiersz.komunikat.classList.add('ukryty'));

    kontenerWierszyPradu.appendChild(wezel);
  }
}
zbudujWierszePradu();

poleDataPradu.addEventListener('input', () => { dataPraduZmienionaRecznie = true; });

function zwolnijZdjecieWiersza(wiersz) {
  if (wiersz.url) URL.revokeObjectURL(wiersz.url);
  wiersz.url = null;
  wiersz.blob = null;
  wiersz.zdjecie.removeAttribute('src');
  wiersz.zdjecie.classList.add('ukryty');
  wiersz.przyciskRozpoznaj.classList.add('ukryty');
}

function ustawStatusWiersza(wiersz, tekst, rodzaj) {
  wiersz.status.textContent = tekst;
  wiersz.status.className = `wiersz-pradu__status wiersz-pradu__status--${rodzaj}`;
  wiersz.status.classList.toggle('ukryty', !tekst);
}

function pokazKomunikatWiersza(wiersz, tresc) {
  wiersz.komunikat.textContent = tresc;
  wiersz.komunikat.classList.toggle('ukryty', !tresc);
}

// Wiersz zapisany (albo odłożony do kolejki) jest zamrożony — żeby nie
// dało się go przypadkiem wysłać drugi raz przy „Zapisz pozostałe”.
function zablokujWiersz(wiersz, zablokuj) {
  wiersz.pole.disabled = zablokuj;
  wiersz.przyciski.forEach((p) => { p.disabled = zablokuj; });
  wiersz.wezel.classList.toggle('wiersz-pradu--zapisany', zablokuj);
}

function otworzEkranPradu() {
  generacjaPradu++;
  for (const wiersz of Object.values(wierszePradu)) {
    zwolnijZdjecieWiersza(wiersz);
    wiersz.pole.value = '';
    wiersz.pole.placeholder = '';
    wiersz.zapisany = false;
    wiersz.wynik = null;
    zablokujWiersz(wiersz, false);
    ustawStatusWiersza(wiersz, '', 'info');
    pokazKomunikatWiersza(wiersz, '');
  }
  poleDataPradu.value = sformatujDataGodzinaLokalnie(new Date());
  poleDataPradu.disabled = false;
  dataPraduZeZdjecia = false;
  dataPraduZmienionaRecznie = false;
  ustawUwageCzasu(null, uwagaCzasuPradu);
  komunikatPradu.classList.add('ukryty');
  komunikatStart.classList.add('ukryty');
  przyciskZapiszPrad.textContent = 'Zapisz wszystkie trzy';
  pokazEkran(ekranPrad);
}

// Sprzątanie przy wyjściu z ekranu (Anuluj, home, koniec zapisu) —
// zwalniamy URL-e zdjęć, a licznik generacji unieważnia trwające jeszcze
// wybory zdjęć i rozpoznawania.
function zamknijEkranPradu() {
  generacjaPradu++;
  Object.values(wierszePradu).forEach(zwolnijZdjecieWiersza);
}

async function zdjecieDoWierszaPradu(wiersz, pobierzZdjecie) {
  const generacja = generacjaPradu;
  let wynik;
  try {
    wynik = await pobierzZdjecie(wiersz.medium);
  } catch (blad) {
    // Zamknięty aparat albo brak wyboru — zostajemy na ekranie bez zmian
    // (w przeciwieństwie do pojedynczego odczytu nie wracamy na start,
    // żeby nie stracić zdjęć zrobionych w pozostałych wierszach).
    console.error('Nie udało się uzyskać zdjęcia:', blad);
    return;
  }
  if (generacja !== generacjaPradu) {
    URL.revokeObjectURL(wynik.url);
    return;
  }

  zwolnijZdjecieWiersza(wiersz);
  wiersz.blob = wynik.blob;
  wiersz.url = wynik.url;
  wiersz.zdjecie.src = wynik.url;
  wiersz.zdjecie.classList.remove('ukryty');
  pokazKomunikatWiersza(wiersz, '');
  // Rozpoznawanie tylko tam, gdzie backend ma podpowiedź (MEDIA_Z_OCR).
  wiersz.przyciskRozpoznaj.classList.toggle('ukryty', !MEDIA_Z_OCR.includes(wiersz.medium));

  // Pierwsze zdjęcie na tym ekranie wyznacza wspólną datę odczytu. Aparat
  // w aplikacji daje zdjęcie „teraz” (czasZdjecia = null), galeria — moment
  // zrobienia zdjęcia z EXIF albo daty pliku (js/aparat.js).
  if (!dataPraduZeZdjecia && !dataPraduZmienionaRecznie && !poleDataPradu.disabled) {
    const czas = wynik.czasZdjecia;
    poleDataPradu.value = sformatujDataGodzinaLokalnie(czas && czas.data ? czas.data : new Date());
    ustawUwageCzasu(czas, uwagaCzasuPradu);
    dataPraduZeZdjecia = true;
  }
}

// Ten sam sposób postępowania co rozpoznajIWypelnij na ekranie
// potwierdzenia: model tylko proponuje wartość, pole zostaje edytowalne,
// a wpis użytkownika ma pierwszeństwo przed spóźnionym wynikiem.
async function rozpoznajWierszPradu(wiersz) {
  if (!wiersz.blob) return;
  const generacja = generacjaPradu;
  const blob = wiersz.blob;
  wiersz.przyciskRozpoznaj.disabled = true;
  wiersz.pole.placeholder = 'Rozpoznaję… (możesz wpisać ręcznie)';
  pokazKomunikatWiersza(wiersz, '');
  try {
    const wynik = await rozpoznajZdjecie(wiersz.medium, await blobDoBase64(blob));
    if (generacja !== generacjaPradu || wiersz.blob !== blob) return;
    if (wiersz.pole.value !== '') return;
    if (wynik.ok && wynik.pasuje && wynik.pewnosc !== 'niska' && typeof wynik.stan === 'number') {
      wiersz.pole.value = wynik.stan;
      if (wynik.pewnosc === 'srednia') {
        pokazKomunikatWiersza(wiersz, 'Średnia pewność odczytu — sprawdź wartość na zdjęciu.');
      }
    } else if (wynik.ok) {
      pokazKomunikatWiersza(wiersz, `Model nie jest pewny odczytu (${wynik.problem || 'nieczytelne wskazanie'}) — wpisz wartość ręcznie.`);
    } else {
      pokazKomunikatWiersza(wiersz, `Rozpoznawanie nie powiodło się (${wynik.blad || 'błąd webhooka'}) — wpisz wartość ręcznie.`);
    }
  } catch (blad) {
    console.error('Nie udało się rozpoznać zdjęcia:', blad);
    if (generacja === generacjaPradu) pokazKomunikatWiersza(wiersz, 'Nie udało się rozpoznać zdjęcia — wpisz wartość ręcznie.');
  } finally {
    if (generacja === generacjaPradu) {
      wiersz.przyciskRozpoznaj.disabled = wiersz.zapisany;
      wiersz.pole.placeholder = '';
    }
  }
}

// "2026-09-29T17:30" -> "29.09 17:30" do komunikatu na ekranie startowym.
function krotkaDataGodzina(wartoscPola) {
  const [data, godzina] = wartoscPola.split('T');
  const [, miesiac, dzien] = data.split('-');
  return `${dzien}.${miesiac} ${godzina}`;
}

formularzPradu.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const generacja = generacjaPradu;
  const dataGodzina = `${poleDataPradu.value}:00`;
  const doWyslania = POZYCJE_PRADU.map(({ medium }) => wierszePradu[medium]).filter((w) => !w.zapisany);

  komunikatPradu.classList.add('ukryty');
  przyciskZapiszPrad.disabled = true;
  przyciskZapiszPrad.textContent = 'Wysyłanie…';

  // Wynik każdego wiersza trafia do wiersz.wynik: 'zapisano' (webhook
  // potwierdził) albo 'kolejka' (bez odpowiedzi, odłożony do kolejki offline).
  const zapisane = [];
  let odrzuconych = 0;

  try {
    // Po kolei, nie równolegle: Apps Script przy serii szybkich równoległych
    // żądań potrafi zwrócić przejściowe 404/500 (apps-script/CLAUDE.md),
    // a trzy żądania po ok. 2 s to i tak krótko.
    for (const wiersz of doWyslania) {
      const odczyt = {
        medium: wiersz.medium,
        stan: parseFloat(wiersz.pole.value),
        data_godzina: dataGodzina,
        metoda: wiersz.blob ? 'foto' : 'reczny',
        foto_url: '',
        uwagi: '',
      };
      ustawStatusWiersza(wiersz, 'Wysyłanie…', 'wczytywanie');
      pokazKomunikatWiersza(wiersz, '');
      try {
        const odpowiedz = await wyslijOdczyt(odczyt);
        if (odpowiedz.ok) {
          wiersz.zapisany = true;
          zablokujWiersz(wiersz, true);
          wiersz.wynik = 'zapisano';
          ustawStatusWiersza(wiersz, 'Zapisano', 'ok');
          zapisane.push(wiersz);
        } else {
          // Odrzucenie przez webhook (np. stan niższy od poprzedniego) —
          // wiersz zostaje do poprawy; pozostałe media wysyłamy dalej,
          // bo każde ma własną chronologię i nie zależą od siebie.
          odrzuconych++;
          ustawStatusWiersza(wiersz, 'Odrzucono', 'blad');
          pokazKomunikatWiersza(wiersz, odpowiedz.blad || 'Webhook odrzucił odczyt.');
        }
      } catch (blad) {
        // Brak odpowiedzi — jak przy pojedynczym odczycie: do kolejki offline,
        // która przy ponownej wysyłce rozpozna wpis, jeśli jednak doszedł.
        console.error('Nie udało się wysłać odczytu prądu, dokładam do kolejki offline:', blad);
        dodajDoKolejki({ akcja: 'odczyt', ...odczyt });
        wiersz.zapisany = true;
        zablokujWiersz(wiersz, true);
        wiersz.wynik = 'kolejka';
        ustawStatusWiersza(wiersz, 'W kolejce', 'kolejka');
      }
      // Pierwszy wysłany wiersz przesądza o dacie — przy „Zapisz pozostałe”
      // pozostałe muszą pójść z tą samą, więc pole daty blokujemy.
      if (wiersz.zapisany) poleDataPradu.disabled = true;
    }
  } finally {
    przyciskZapiszPrad.disabled = false;
  }

  if (zapisane.length > 0) wyczyscBuforKlucz('ostatnie_odczyty');
  aktualizujKomunikatKolejki();
  if (generacja !== generacjaPradu) return; // ktoś wyszedł z ekranu w trakcie

  if (odrzuconych === 0) {
    // Podsumowanie całego ekranu, a nie tylko ostatniej wysyłki — przy
    // „Zapisz pozostałe” wcześniej zapisane wartości też mają być widać.
    const wszystkie = POZYCJE_PRADU.map(({ medium }) => wierszePradu[medium]);
    const opis = (lista) => lista
      .map((w) => `${MEDIA[w.medium].nazwa.replace('Prąd ', '')} ${w.pole.value}`)
      .join(', ');
    const potwierdzone = wszystkie.filter((w) => w.wynik === 'zapisano');
    const odlozone = wszystkie.filter((w) => w.wynik === 'kolejka');
    const czesci = [];
    if (potwierdzone.length > 0) {
      czesci.push(`Zapisano prąd (${krotkaDataGodzina(poleDataPradu.value)}): ${opis(potwierdzone)} kWh.`);
    }
    if (odlozone.length > 0) {
      czesci.push(`Nie udało się potwierdzić zapisu: ${opis(odlozone)} — zapisane lokalnie, aplikacja wyśle je sama albo sprawdzi, że już doszły.`);
    }
    if (wszystkie.every((w) => w.zapisany)) {
      komunikatStart.textContent = czesci.join(' ');
      komunikatStart.classList.remove('ukryty');
      zamknijEkranPradu();
      pokazEkran(ekranStart);
      return;
    }
  }

  const ileGotowych = Object.values(wierszePradu).filter((w) => w.zapisany).length;
  komunikatPradu.textContent =
    `Zapisano ${ileGotowych} z ${POZYCJE_PRADU.length}. Popraw zaznaczone wartości ` +
    'i naciśnij „Zapisz pozostałe” — pójdą z tą samą datą i godziną.';
  komunikatPradu.classList.remove('ukryty');
  przyciskZapiszPrad.textContent = 'Zapisz pozostałe';
});

przyciskPrad.addEventListener('click', () => {
  if (!czyUstawieniaZapisane()) {
    otworzUstawienia();
    return;
  }
  otworzEkranPradu();
});

przyciskAnulujPrad.addEventListener('click', () => {
  zamknijEkranPradu();
  pokazEkran(ekranStart);
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
    odswiezAlarmy();
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
