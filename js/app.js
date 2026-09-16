// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków,
// formularza ustawień, ekranu potwierdzenia odczytu i wysyłki do webhooka.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import { MEDIA, MEDIA_ZE_ZDJECIEM } from './media.js';
import {
  wyslij, wyslijOdczyt, rozpoznajZdjecie, zapiszKociol, pobierzOstatnieNastawyKotla,
  pobierzOstatnieOdczyty, pobierzTemperaturyDobowe,
} from './webhook.js';
import { zrobZdjecie, wybierzZGalerii, blobDoBase64 } from './aparat.js';
import { dodajDoKolejki, liczbaWKolejce, pobierzKolejke, usunPierwszyZKolejki } from './kolejka.js';

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
const kafelki = document.querySelectorAll('.kafelek');

const potwierdzenieTytul = document.getElementById('potwierdzenie-tytul');
const potwierdzenieJednostka = document.getElementById('potwierdzenie-jednostka');
const formularzPotwierdzenia = document.getElementById('formularz-potwierdzenia');
const poleStan = document.getElementById('pole-stan');
const poleDataGodzina = document.getElementById('pole-data-godzina');
const przyciskAnulujPotwierdzenie = document.getElementById('przycisk-anuluj-potwierdzenie');
const przyciskZatwierdz = document.getElementById('przycisk-zatwierdz');
const komunikatPotwierdzenia = document.getElementById('komunikat-potwierdzenia');

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

const ekranPodglad = document.getElementById('ekran-podglad');
const przyciskPodglad = document.getElementById('przycisk-podglad');
const przyciskZamknijPodglad = document.getElementById('przycisk-zamknij-podglad');
const listaOstatnichOdczytow = document.getElementById('lista-ostatnich-odczytow');
const tabelaTemperatur = document.getElementById('tabela-temperatur');
const komunikatPodgladu = document.getElementById('komunikat-podgladu');

const ETYKIETY_TRYBU = { off: 'Wyłączony', cwu: 'CWU', co: 'CO', cwu_co: 'CWU + CO' };

// Nastawy pobrane z webhooka przy otwarciu ekranu — punkt odniesienia do
// wykrywania, czy formularz w ogóle się różni (wpis ma sens tylko wtedy).
// null = brak punktu odniesienia (pusty arkusz albo offline) — wtedy nie
// blokujemy wysyłki, bo nie ma z czym porównać.
let ostatnieNastawyKotla = null;
// Rośnie przy każdym otwarciu karty „Kocioł” — pozwala wczytajOstatnieNastawyKotla
// poznać, że użytkownik zdążył zamknąć/otworzyć ekran ponownie, zanim
// odpowiedź webhooka wróciła, i nie nadpisywać pól nieaktualną odpowiedzią.
let generacjaKotla = 0;

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
  opcjeTrybu.forEach((p) => { p.disabled = wTrakcie; });
  poleKrzywa.disabled = wTrakcie;
  polePrzesuniecie.disabled = wTrakcie;
  poleTempCwu.disabled = wTrakcie;
  przyciskDodajPrzedzial.disabled = wTrakcie;
  przyciskZapiszKociol.disabled = wTrakcie;
  if (wTrakcie) {
    komunikatKotla.textContent = 'Wczytywanie ostatnich nastaw…';
    komunikatKotla.classList.remove('ukryty');
  } else {
    komunikatKotla.classList.add('ukryty');
  }
}

async function wczytajOstatnieNastawyKotla(generacja) {
  try {
    const wynik = await pobierzOstatnieNastawyKotla();
    if (generacja !== generacjaKotla) return; // ekran zdążył się zmienić

    if (!wynik.ok || wynik.brak) {
      ostatnieNastawyKotla = null; // pusty arkusz — nie ma punktu odniesienia
      return;
    }

    ustawTryb(wynik.tryb || 'off');
    poleKrzywa.value = wynik.krzywa_grzewcza ?? '';
    polePrzesuniecie.value = wynik.przesuniecie ?? '';
    poleTempCwu.value = wynik.temp_cwu ?? '';
    listaCyrkulacji.innerHTML = '';
    sparsujCyrkulacje(wynik.cyrkulacja).forEach((p) => dodajPrzedzialCyrkulacji(p.od, p.do));

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
  ostatnieNastawyKotla = null;
  pokazEkran(ekranKociol);
  // Wskaźnik trybu liczy swoją pozycję z realnych wymiarów przycisku
  // (offsetLeft/offsetWidth) — musi więc zostać ustawiony PO pokazEkran,
  // bo ukryty (display: none) ekran zwraca zerowe wymiary.
  ustawTryb('off');
  ustawWczytywanieKotla(true);
  wczytajOstatnieNastawyKotla(generacjaKotla);
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

async function otworzPodglad() {
  komunikatStart.classList.add('ukryty');
  generacjaPodgladu++;
  const generacja = generacjaPodgladu;

  listaOstatnichOdczytow.innerHTML = '';
  tabelaTemperatur.innerHTML = '';
  komunikatPodgladu.classList.add('ukryty');
  pokazEkran(ekranPodglad);

  const bledy = [];

  try {
    const wynik = await pobierzOstatnieOdczyty(15);
    if (generacja !== generacjaPodgladu) return;
    if (wynik.ok) {
      renderujOstatnieOdczyty(wynik.odczyty);
    } else {
      bledy.push('odczytów (' + (wynik.blad || 'błąd webhooka') + ')');
    }
  } catch (blad) {
    if (generacja !== generacjaPodgladu) return;
    console.error('Nie udało się pobrać ostatnich odczytów:', blad);
    bledy.push('odczytów (brak połączenia)');
  }

  try {
    const wynik = await pobierzTemperaturyDobowe(14);
    if (generacja !== generacjaPodgladu) return;
    if (wynik.ok) {
      renderujTemperaturyDobowe(wynik.dni);
    } else {
      bledy.push('temperatur (' + (wynik.blad || 'błąd webhooka') + ')');
    }
  } catch (blad) {
    if (generacja !== generacjaPodgladu) return;
    console.error('Nie udało się pobrać temperatur dobowych:', blad);
    bledy.push('temperatur (brak połączenia)');
  }

  if (generacja === generacjaPodgladu && bledy.length > 0) {
    komunikatPodgladu.textContent = 'Nie udało się wczytać: ' + bledy.join(', ') + '.';
    komunikatPodgladu.classList.remove('ukryty');
  }
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

  const bezZmian = ostatnieNastawyKotla
    && ostatnieNastawyKotla.tryb === daneKotla.tryb
    && doPorownania(ostatnieNastawyKotla.krzywa_grzewcza) === doPorownania(daneKotla.krzywa_grzewcza)
    && doPorownania(ostatnieNastawyKotla.przesuniecie) === doPorownania(daneKotla.przesuniecie)
    && doPorownania(ostatnieNastawyKotla.temp_cwu) === doPorownania(daneKotla.temp_cwu)
    && ostatnieNastawyKotla.cyrkulacja === daneKotla.cyrkulacja;

  if (bezZmian) {
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
    pokazEkran(ekranStart);
  } catch (blad) {
    // Brak sieci — jak przy odczytach, dokładamy do wspólnej kolejki offline.
    console.error('Nie udało się wysłać zmiany nastaw kotła, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'zmiana_kotla', ...daneKotla });
    aktualizujKomunikatKolejki();
    komunikatStart.textContent =
      'Brak połączenia — zmiana nastaw kotła zapisana lokalnie, wyśle się sama, gdy wróci internet.';
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
function otworzPotwierdzenie(medium, metoda, urlZdjecia = null) {
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
  poleDataGodzina.value = sformatujDataGodzinaLokalnie(new Date());
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

  const { medium, blob, url } = wynikZdjecia;
  otworzPotwierdzenie(medium, 'foto', url);
  await rozpoznajIWypelnij(medium, blob, generacjaPotwierdzenia);
}

// Model niczego nie zapisuje — tylko proponuje wartość do pola, które i tak
// trzeba zatwierdzić ręcznie. Przy niskiej pewności albo niedopasowanym
// zdjęciu (pasuje: false) pole zostaje puste i pokazujemy ostrzeżenie,
// zamiast po cichu przyjąć niepewny wynik (zgodnie z CLAUDE.md).
async function rozpoznajIWypelnij(medium, blob, generacja) {
  poleStan.disabled = true;
  poleStan.placeholder = 'Rozpoznawanie odczytu…';
  przyciskZatwierdz.disabled = true;

  try {
    const obrazBase64 = await blobDoBase64(blob);
    const wynik = await rozpoznajZdjecie(medium, obrazBase64);

    if (generacja !== generacjaPotwierdzenia) return; // ekran zdążył się zmienić

    if (wynik.ok && wynik.pasuje && wynik.pewnosc !== 'niska' && typeof wynik.stan === 'number') {
      poleStan.value = wynik.stan;
      if (wynik.pewnosc === 'srednia') {
        pokazBladPotwierdzenia('Średnia pewność odczytu — sprawdź wartość na zdjęciu przed zatwierdzeniem.');
      }
    } else {
      const powod = (wynik.ok ? wynik.problem : wynik.blad) || 'nie udało się jednoznacznie odczytać wskazania';
      pokazBladPotwierdzenia(`Model nie jest pewny odczytu (${powod}) — sprawdź zdjęcie i wpisz wartość ręcznie.`);
    }
  } catch (blad) {
    console.error('Nie udało się rozpoznać zdjęcia:', blad);
    if (generacja === generacjaPotwierdzenia) {
      pokazBladPotwierdzenia('Nie udało się rozpoznać zdjęcia — wpisz odczyt ręcznie.');
    }
  } finally {
    if (generacja === generacjaPotwierdzenia) {
      poleStan.disabled = false;
      poleStan.placeholder = '';
      przyciskZatwierdz.disabled = false;
    }
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

async function przetworzKolejkeOffline() {
  if (przetwarzanieKolejkiWToku) return;
  przetwarzanieKolejkiWToku = true;

  let wyslanychOk = 0;
  const odrzucone = [];

  try {
    while (pobierzKolejke().length > 0) {
      const [pierwszy] = pobierzKolejke();
      let odpowiedz;
      try {
        odpowiedz = await wyslij(pierwszy);
      } catch (blad) {
        console.error('Kolejka offline: wciąż brak połączenia.', blad);
        break;
      }

      usunPierwszyZKolejki();
      if (odpowiedz.ok) {
        wyslanychOk++;
      } else {
        odrzucone.push({ ...pierwszy, blad: odpowiedz.blad });
      }
    }
  } finally {
    przetwarzanieKolejkiWToku = false;
  }

  aktualizujKomunikatKolejki();

  if (odrzucone.length > 0) {
    const opis = odrzucone
      .map((o) => `${opiszWpisKolejki(o)} (${o.blad})`)
      .join('; ');
    komunikatStart.textContent =
      `Kolejka offline: wysłano ${wyslanychOk}, odrzucono ${odrzucone.length} — ` +
      `wpisz ponownie ręcznie: ${opis}`;
    komunikatStart.classList.remove('ukryty');
  } else if (wyslanychOk > 0) {
    komunikatStart.textContent = `Wysłano z kolejki offline: ${wyslanychOk} wpis(ów).`;
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

    komunikatStart.textContent =
      `Zapisano: ${opisMedium.nazwa} — ${poleStan.value} ${opisMedium.jednostka} ` +
      `(poprzedni stan: ${odpowiedz.poprzedni_stan}, przyrost: ${odpowiedz.przyrost}).`;
    komunikatStart.classList.remove('ukryty');
    zwolnijPodgladZdjecia();
    pokazEkran(ekranStart);
  } catch (blad) {
    // Brak sieci (a nie odrzucenie przez webhook) — zamiast zmuszać do
    // czekania na zasięg, zapisujemy lokalnie i wysyłamy automatycznie
    // przy najbliższej okazji (patrz js/kolejka.js).
    console.error('Nie udało się wysłać odczytu, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'odczyt', ...odczyt });
    aktualizujKomunikatKolejki();
    komunikatStart.textContent =
      `Brak połączenia — ${opisMedium.nazwa} ${poleStan.value} ${opisMedium.jednostka} ` +
      'zapisane lokalnie, wyśle się samo, gdy wróci internet.';
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
window.addEventListener('online', () => {
  if (czyUstawieniaZapisane()) {
    przetworzKolejkeOffline();
  }
});

// Rejestracja service workera — pozwala otworzyć aplikację bez zasięgu.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((blad) => {
      console.error('Nie udało się zarejestrować service workera:', blad);
    });
  });
}
