// Wysyłka kolejki offline i komunikat o jej stanie. Zapis do kolejki robią
// ekrany (js/kolejka.js to tylko magazyn w localStorage); tu są: licznik
// na ekranie startowym i przetwarzanie od najstarszego wpisu.

import { MEDIA } from './media.js';
import { wyslij, pobierzOstatnieOdczyty, pobierzOstatnieNastawyKotla } from './webhook.js';
import { liczbaWKolejce, pobierzKolejke, usunPierwszyZKolejki } from './kolejka.js';
import { wyczyscBuforKlucz } from './bufor.js';
import { ETYKIETY_TRYBU, czyTeSameNastawy } from './nastawy.js';
import { pokazKomunikatStart } from './nawigacja.js';

const komunikatKolejka = document.getElementById('komunikat-kolejka');

export function aktualizujKomunikatKolejki() {
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

export async function przetworzKolejkeOffline() {
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
    pokazKomunikatStart(czesci.join(' '));
  }
}
