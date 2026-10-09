// Ekran prądu (od 0.20.0): T1, T2 i suma na jednym ekranie, wspólna data.

import { MEDIA, MEDIA_Z_OCR, POZYCJE_PRADU } from '../media.js';
import { czyUstawieniaZapisane } from '../ustawienia.js';
import { wyslijOdczyt, rozpoznajZdjecie } from '../webhook.js';
import { zrobZdjecie, wybierzZGalerii, blobDoBase64 } from '../aparat.js';
import { dodajDoKolejki } from '../kolejka.js';
import { aktualizujKomunikatKolejki } from '../kolejka-wysylka.js';
import { wyczyscBuforKlucz } from '../bufor.js';
import { sformatujDataGodzinaLokalnie, zrodloOdczytu, ustawUwageCzasu } from '../wspolne.js';
import { pokazEkran, ekranStart, pokazKomunikatStart, ukryjKomunikatStart } from '../nawigacja.js';
import { otworzUstawienia } from './ustawienia.js';

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
  wiersz.wartoscZOcr = null;   // nowe zdjęcie (albo jego brak) — stary wynik OCR nie dotyczy
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
  ukryjKomunikatStart();
  przyciskZapiszPrad.textContent = 'Zapisz wszystkie trzy';
  pokazEkran(ekranPrad);
}

// Sprzątanie przy wyjściu z ekranu (Anuluj, home, koniec zapisu) —
// zwalniamy URL-e zdjęć, a licznik generacji unieważnia trwające jeszcze
// wybory zdjęć i rozpoznawania.
export function zamknijEkranPradu() {
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
      wiersz.wartoscZOcr = wynik.stan;
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
        zrodlo: zrodloOdczytu(Boolean(wiersz.blob), wiersz.wartoscZOcr ?? null, parseFloat(wiersz.pole.value)),
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
      pokazKomunikatStart(czesci.join(' '));
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
