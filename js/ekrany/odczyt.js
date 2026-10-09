// Odczyt pojedynczego medium (gaz, woda): wybór metody (zdjęcie / galeria /
// ręcznie), ekran potwierdzenia z datą i godziną, rozpoznawanie zdjęcia (OCR)
// i zapis. Prąd ma osobny ekran (prad.js).

import { MEDIA, MEDIA_ZE_ZDJECIEM, MEDIA_Z_OCR } from '../media.js';
import { czyUstawieniaZapisane } from '../ustawienia.js';
import { wyslijOdczyt, rozpoznajZdjecie } from '../webhook.js';
import { zrobZdjecie, wybierzZGalerii, blobDoBase64 } from '../aparat.js';
import { dodajDoKolejki } from '../kolejka.js';
import { aktualizujKomunikatKolejki } from '../kolejka-wysylka.js';
import { wyczyscBuforKlucz } from '../bufor.js';
import { sformatujDataGodzinaLokalnie, zrodloOdczytu, ustawUwageCzasu } from '../wspolne.js';
import { pokazEkran, ekranStart, pokazKomunikatStart, ukryjKomunikatStart } from '../nawigacja.js';
import { otworzUstawienia } from './ustawienia.js';

const ekranWyboruMetody = document.getElementById('ekran-wybor-metody');
const ekranPotwierdzenia = document.getElementById('ekran-potwierdzenia');
const wyborMetodyTytul = document.getElementById('wybor-metody-tytul');
const przyciskZdjecie = document.getElementById('przycisk-zdjecie');
const przyciskGaleria = document.getElementById('przycisk-galeria');
const przyciskRecznie = document.getElementById('przycisk-recznie');
const przyciskAnulujWybor = document.getElementById('przycisk-anuluj-wybor');
const podgladZdjecia = document.getElementById('podglad-zdjecia');
// Kafelki mediów (Gaz, Woda na pulpicie) rozpoznajemy po atrybucie data-medium.
// Prąd ma własny ekran zbiorczy (prad.js), Kocioł i reszta nie są mediami.
const kafelki = document.querySelectorAll('[data-medium]');
const potwierdzenieTytul = document.getElementById('potwierdzenie-tytul');
const potwierdzenieJednostka = document.getElementById('potwierdzenie-jednostka');
const formularzPotwierdzenia = document.getElementById('formularz-potwierdzenia');
const poleStan = document.getElementById('pole-stan');
const poleDataGodzina = document.getElementById('pole-data-godzina');
const przyciskAnulujPotwierdzenie = document.getElementById('przycisk-anuluj-potwierdzenie');
const przyciskZatwierdz = document.getElementById('przycisk-zatwierdz');
const komunikatPotwierdzenia = document.getElementById('komunikat-potwierdzenia');
const uwagaCzasu = document.getElementById('uwaga-czasu');

let wybraneMedium = null;
let metodaAktualnegoOdczytu = 'reczny';
// Wartość, którą wpisało rozpoznawanie (OCR) na ekranie potwierdzenia, albo
// null. Przy zapisie porównujemy ją z polem — tak powstaje `zrodlo` odczytu.
let wartoscZOcr = null;
let adresUrlPodgladuZdjecia = null;
// Rośnie przy każdym otwarciu ekranu potwierdzenia — pozwala rozpoznajIWypelnij
// poznać, że użytkownik zdążył zamknąć ten ekran (albo otworzyć kolejny),
// zanim odpowiedź modelu wróciła, i nie wpisywać wyniku w złe miejsce.
let generacjaPotwierdzenia = 0;

// Kliknięcie kafelka otwiera ekran potwierdzenia z bieżącą datą i godziną —
// użytkownik może je poprawić, gdy odczyt robi z opóźnieniem. `urlZdjecia`
// pokazuje podgląd zrobionego zdjęcia, żeby dało się z niego przepisać
// wskazanie — sam model wizyjny dojdzie w punkcie 6.
function otworzPotwierdzenie(medium, metoda, urlZdjecia = null, czasZdjecia = null) {
  wybraneMedium = medium;
  metodaAktualnegoOdczytu = metoda;
  wartoscZOcr = null;
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
  ustawUwageCzasu(czasZdjecia, uwagaCzasu);
  ukryjKomunikatStart();
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
      wartoscZOcr = wynik.stan;
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

export function zwolnijPodgladZdjecia() {
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

formularzPotwierdzenia.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const opisMedium = MEDIA[wybraneMedium];
  const odczyt = {
    medium: wybraneMedium,
    stan: parseFloat(poleStan.value),
    data_godzina: `${poleDataGodzina.value}:00`,
    metoda: metodaAktualnegoOdczytu,
    zrodlo: zrodloOdczytu(metodaAktualnegoOdczytu === 'foto', wartoscZOcr, parseFloat(poleStan.value)),
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
    pokazKomunikatStart(`Zapisano: ${opisMedium.nazwa} — ${poleStan.value} ${opisMedium.jednostka} ` +
      `(poprzedni stan: ${odpowiedz.poprzedni_stan}, przyrost: ${odpowiedz.przyrost}).`);
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
    pokazKomunikatStart(`Nie udało się potwierdzić zapisu (${przyczyna}) — ${opisMedium.nazwa} ` +
      `${poleStan.value} ${opisMedium.jednostka} zapisane lokalnie. Aplikacja ` +
      'wyśle je sama albo sprawdzi, że już doszło.');
    zwolnijPodgladZdjecia();
    pokazEkran(ekranStart);
  } finally {
    przyciskZatwierdz.disabled = false;
    przyciskZatwierdz.textContent = 'Zatwierdź';
  }
});
