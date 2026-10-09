// Kocioł: historia zmian nastaw (paski CO/CWU i oś ostatnich zmian) —
// sekcja tylko do odczytu pod formularzem Kotła.

import { pobierzHistorieKotla } from '../webhook.js';
import { element, liczbaPL, formatujDataGodzinePodgladu, wczytajBlokPodgladu } from '../wspolne.js';
import { obwodyTrybu, wartoscPusta, rozne } from '../nastawy.js';

const statusHistoriiKotla = document.getElementById('status-historii-kotla');
const historiaKotla = document.getElementById('historia-kotla');

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

// Wczytuje historię (przez bufor) przy otwarciu ekranu Kotła. `czyAktualny`
// to sprawdzenie licznika generacji ekranu — spóźniona odpowiedź z poprzedniego
// otwarcia nie może nic narysować.
export function otworzHistorieKotla(czyAktualny) {
  historiaKotla.innerHTML = '';
  wczytajBlokPodgladu(czyAktualny, {
    status: statusHistoriiKotla,
    klucz: 'historia_kotla',
    pobierz: () => pobierzHistorieKotla(DNI_HISTORII_KOTLA, ILE_ZMIAN_KOTLA),
    renderuj: renderujHistorieKotla,
  });
}
