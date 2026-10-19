// Karta „Zbieracz” — stan zbierania temperatur na telefonie.

import { pobierzStanZbieracza, pobierzListeLuk, oznaczLuke, przywrocLuke } from '../webhook.js';
import { wyczyscBuforKlucz } from '../bufor.js';
import { element, liczbaPL, formatujDataGodzinePodgladu, wczytajBlokPodgladu } from '../wspolne.js';
import { pokazEkran, ekranStart, ukryjKomunikatStart, powiadomOZmianieDanych } from '../nawigacja.js';
import { poUstawieniach } from './ustawienia.js';
import { kolorCzujnika } from './wykres-doby.js';

const ekranZbieracz = document.getElementById('ekran-zbieracz');
const przyciskZbieracz = document.getElementById('przycisk-zbieracz');
const przyciskZamknijZbieracz = document.getElementById('przycisk-zamknij-zbieracz');
const statusZbieracza = document.getElementById('status-zbieracza');
const stanZbieraczaKontener = document.getElementById('stan-zbieracza');
const naglowekLuk = document.getElementById('naglowek-luk');
const statusLuk = document.getElementById('status-luk');
const lukiKontener = document.getElementById('luki-zbieracza');

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

// Bateria czujnika poniżej tylu procent — dopisek wyróżniony. Ta sama wartość
// co PROG_BATERII_CZUJNIKA w apps-script/luki.js (tam uwaga w pasku alarmów).
export const PROG_BATERII_CZUJNIKA = 20;

// „bateria 59% · sygnał −72 dBm (dobry)”. Ocena sygnału Zigbee jest
// orientacyjna (bliżej zera = lepiej): od −75 dBm dobry, do −85 średni,
// poniżej słaby — przy słabym czujnik częściej gubi połączenie z bramką.
function opiszStanCzujnika(c) {
  const czesci = [];
  if (typeof c.bateria === 'number') czesci.push(`bateria ${c.bateria}%`);
  if (typeof c.rssi === 'number') {
    const ocena = c.rssi >= -75 ? 'dobry' : c.rssi >= -85 ? 'średni' : 'słaby';
    czesci.push(`sygnał ${String(c.rssi).replace('-', '−')} dBm (${ocena})`);
  }
  return czesci.join(' · ');
}

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
    // Bateria i sygnał Sonoffa (od 1.4.0, z pulsu zbieracza 1.4); BleBox ich
    // nie ma. Osobna linia na całą szerokość wiersza — w prawej kolumnie
    // długi opis rozpychał wiersz poza kartę.
    const stanCzujnika = opiszStanCzujnika(c);
    if (stanCzujnika) {
      const niska = c.bateria !== null && c.bateria !== undefined && c.bateria < PROG_BATERII_CZUJNIKA;
      wiersz.classList.add('zbieracz__wiersz-czujnika');
      wiersz.appendChild(element('span', `zbieracz__stan-czujnika${niska ? ' zbieracz__stan-czujnika--uwaga' : ''}`, stanCzujnika));
    }
    listaCzujnikow.appendChild(wiersz);
  });

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

// --- Luki w temperaturach: lista i oznaczanie (BACKLOG pkt 48) ---------------
//
// Lista z akcji lista_luk (liczy webhook; PWA tylko wyświetla): otwarte luki do
// uzupełnienia importem i znane (nieuzupełnialne), które nie wchodzą już do
// upomnień. „Oznacz jako znaną” wymaga powodu; zasada z decyzje.md D4: znaną
// oznacza się lukę, której nie ma też w eksporcie chmurowym — sprawdzone, nie
// założone. Luki, która jeszcze trwa, nie wolno oznaczać. W arkuszu luka zostaje
// luką — oznaczenie wyłącza tylko upomnienia (raport, pasek, karta).

const NAZWY_STATUSOW_LUKI = { otwarta: 'otwarta', znana: 'znana' };

// Klucz godziny „2026-10-09T06” → Date (czas lokalny).
function dataZKlucza(klucz) {
  const [dzien, godz] = klucz.split('T');
  const [r, m, d] = dzien.split('-').map(Number);
  return new Date(r, m - 1, d, Number(godz), 0, 0);
}

const dwie = (n) => String(n).padStart(2, '0');

// „09.10 06:00–15:00” albo „09.10 22:00 – 10.10 02:00” — koniec to granica
// po ostatniej brakującej godzinie.
function opiszZakresLuki(od, doKlucz) {
  const poczatek = dataZKlucza(od);
  const koniec = new Date(dataZKlucza(doKlucz).getTime() + 3600000);
  const dzien = (d) => `${dwie(d.getDate())}.${dwie(d.getMonth() + 1)}`;
  const godz = (d) => `${dwie(d.getHours())}:00`;
  return dzien(poczatek) === dzien(koniec)
    ? `${dzien(poczatek)} ${godz(poczatek)}–${godz(koniec)}`
    : `${dzien(poczatek)} ${godz(poczatek)} – ${dzien(koniec)} ${godz(koniec)}`;
}

function odswiezPoZmianieLuk() {
  // Zmieniły się alarm „luki”, werdykt i lista — nieaktualne bufory kasujemy,
  // a pulpit ma odświeżyć się od razu po powrocie na ekran startowy.
  ['luki_zbieracza', 'stan_zbieracza', 'pulpit'].forEach(wyczyscBuforKlucz);
  powiadomOZmianieDanych();
  wczytajKarteZbieracza();
}

// Formularz „Oznacz jako znaną” pod luką: powód obowiązkowy + przypomnienie zasady.
function formularzOznaczenia(luka, wiersz, przycisk) {
  const formularz = element('form', 'luka__formularz');
  formularz.appendChild(element('p', 'luka__zasada',
    'Oznacz tylko lukę, której nie ma też w eksporcie z chmury (BleBox, eWeLink) — '
    + 'sprawdzone, nie założone. Luka zostaje w arkuszu; znika tylko z upomnień '
    + '(raport, pasek, karta).'));
  const etykieta = element('label', 'pole-formularza', 'Powód (obowiązkowy)');
  const pole = element('input');
  pole.type = 'text';
  pole.maxLength = 300;
  pole.required = true;
  pole.placeholder = 'np. brak też w eksporcie eWeLink (sprawdzone dziś)';
  etykieta.appendChild(pole);
  formularz.appendChild(etykieta);
  const blad = element('p', 'komunikat ukryty');
  formularz.appendChild(blad);
  const akcje = element('div', 'przyciski-formularza');
  const zapisz = element('button', 'przycisk-glowny', 'Zapisz jako znaną');
  zapisz.type = 'submit';
  const anuluj = element('button', 'przycisk-drugorzedny', 'Anuluj');
  anuluj.type = 'button';
  akcje.append(zapisz, anuluj);
  formularz.appendChild(akcje);

  anuluj.addEventListener('click', () => {
    formularz.remove();
    przycisk.classList.remove('ukryty');
  });
  formularz.addEventListener('submit', async (zdarzenie) => {
    zdarzenie.preventDefault();
    const powod = pole.value.trim();
    if (!powod) {
      blad.textContent = 'Wpisz powód.';
      blad.classList.remove('ukryty');
      return;
    }
    zapisz.disabled = true;
    zapisz.textContent = 'Zapisywanie…';
    try {
      const odpowiedz = await oznaczLuke(luka.rola, luka.od, luka.do, powod);
      if (!odpowiedz.ok) throw new Error(odpowiedz.blad || 'webhook odrzucił oznaczenie');
      odswiezPoZmianieLuk();
    } catch (wyjatek) {
      blad.textContent = wyjatek.message === 'Failed to fetch'
        ? 'Brak połączenia — spróbuj ponownie.' : wyjatek.message;
      blad.classList.remove('ukryty');
      zapisz.disabled = false;
      zapisz.textContent = 'Zapisz jako znaną';
    }
  });
  wiersz.appendChild(formularz);
  pole.focus();
}

function wierszLuki(luka, indeks) {
  const trwa = luka.status === 'otwarta' && luka.trwa;
  const wiersz = element('div', `luka luka--${luka.status}${trwa ? ' luka--trwa' : ''}`);

  const gora = element('div', 'luka__gora');
  const nazwa = element('span', 'luka__rola zbieracz__czujnik', NAZWY_ROL[luka.rola] || luka.rola);
  nazwa.style.setProperty('--kolor', kolorCzujnika(luka.rola, indeks));
  gora.appendChild(nazwa);
  gora.appendChild(element('span', `luka__stan luka__stan--${luka.status}`,
    trwa ? 'trwa' : NAZWY_STATUSOW_LUKI[luka.status] || luka.status));
  wiersz.appendChild(gora);

  wiersz.appendChild(element('div', 'luka__zakres',
    `${opiszZakresLuki(luka.od, luka.do)} · ${luka.godzin} h`));
  if (luka.status === 'znana' && luka.powod) {
    wiersz.appendChild(element('div', 'luka__powod', luka.powod));
  }

  if (trwa) {
    wiersz.appendChild(element('div', 'luka__zakres',
      'Luka jeszcze trwa — oznaczyć ją można po zakończeniu.'));
  } else if (luka.status === 'otwarta') {
    const przycisk = element('button', 'przycisk-drugorzedny luka__przycisk', 'Oznacz jako znaną');
    przycisk.type = 'button';
    przycisk.addEventListener('click', () => {
      przycisk.classList.add('ukryty');
      formularzOznaczenia(luka, wiersz, przycisk);
    });
    wiersz.appendChild(przycisk);
  } else {
    const przycisk = element('button', 'przycisk-drugorzedny luka__przycisk', 'Przywróć');
    przycisk.type = 'button';
    przycisk.addEventListener('click', async () => {
      if (!window.confirm('Przywrócić tę lukę jako otwartą? Wróci do upomnień (raport, pasek, karta).')) return;
      przycisk.disabled = true;
      try {
        const odpowiedz = await przywrocLuke(luka.rola, luka.od, luka.do);
        if (!odpowiedz.ok) throw new Error(odpowiedz.blad || 'webhook odrzucił przywrócenie');
        odswiezPoZmianieLuk();
      } catch (wyjatek) {
        przycisk.disabled = false;
        statusLuk.textContent = wyjatek.message === 'Failed to fetch' ? 'Brak połączenia — spróbuj ponownie.' : wyjatek.message;
        statusLuk.className = 'status-bloku status-bloku--blad';
      }
    });
    wiersz.appendChild(przycisk);
  }
  return wiersz;
}

function renderujLuki(wynik) {
  lukiKontener.innerHTML = '';
  naglowekLuk.textContent = `Luki w ostatnich ${wynik.okno_dni || 28} dniach`;
  if (!wynik.od) {
    lukiKontener.appendChild(element('p', 'komunikat-pusto', 'Nie liczone — brak LUKI_OD.'));
    return;
  }
  const luki = wynik.luki || [];
  if (luki.length === 0) {
    lukiKontener.appendChild(element('p', 'komunikat-pusto',
      `Brak luk od początku zbierania (${formatujDataGodzinePodgladu(wynik.od)}).`));
    return;
  }
  const lista = element('div', 'lista-odczytow');
  luki.forEach((luka, indeks) => lista.appendChild(wierszLuki(luka, indeks)));
  lukiKontener.appendChild(lista);
}

// Karta ładuje dwa niezależne bloki: stan zbieracza (stan_zbieracza) i listę luk
// (lista_luk). Po oznaczeniu / przywróceniu luki odświeżamy oba — zmienia się
// też alarm „luki” i werdykt.
function wczytajKarteZbieracza() {
  generacjaZbieracza++;
  const generacja = generacjaZbieracza;
  const aktualna = () => generacja === generacjaZbieracza;

  wczytajBlokPodgladu(aktualna, {
    status: statusZbieracza,
    klucz: 'stan_zbieracza',
    pobierz: pobierzStanZbieracza,
    renderuj: renderujStanZbieracza,
  });
  wczytajBlokPodgladu(aktualna, {
    status: statusLuk,
    klucz: 'luki_zbieracza',
    pobierz: pobierzListeLuk,
    renderuj: renderujLuki,
  });
}

function otworzZbieracz() {
  ukryjKomunikatStart();
  stanZbieraczaKontener.innerHTML = '';
  lukiKontener.innerHTML = '';
  pokazEkran(ekranZbieracz);
  wczytajKarteZbieracza();
}

przyciskZbieracz.addEventListener('click', poUstawieniach(otworzZbieracz));
przyciskZamknijZbieracz.addEventListener('click', () => pokazEkran(ekranStart));
