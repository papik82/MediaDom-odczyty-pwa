// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków,
// formularza ustawień, ekranu potwierdzenia odczytu i wysyłki do webhooka.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import { MEDIA, MEDIA_ZE_ZDJECIEM } from './media.js';
import { wyslijOdczyt, rozpoznajZdjecie } from './webhook.js';
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

let wybraneMedium = null;
let metodaAktualnegoOdczytu = 'reczny';
let adresUrlPodgladuZdjecia = null;
// Rośnie przy każdym otwarciu ekranu potwierdzenia — pozwala rozpoznajIWypelnij
// poznać, że użytkownik zdążył zamknąć ten ekran (albo otworzyć kolejny),
// zanim odpowiedź modelu wróciła, i nie wpisywać wyniku w złe miejsce.
let generacjaPotwierdzenia = 0;

function pokazEkran(ekranDoPokazania) {
  for (const ekran of [ekranStart, ekranUstawien, ekranWyboruMetody, ekranPotwierdzenia]) {
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
    komunikatKolejka.textContent = `W kolejce offline: ${ile} odczytów do wysłania — pójdą same, gdy wróci internet.`;
    komunikatKolejka.classList.remove('ukryty');
  } else {
    komunikatKolejka.classList.add('ukryty');
  }
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
        odpowiedz = await wyslijOdczyt(pierwszy);
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
      .map((o) => `${(MEDIA[o.medium] || {}).nazwa || o.medium} ${o.stan} (${o.blad})`)
      .join('; ');
    komunikatStart.textContent =
      `Kolejka offline: wysłano ${wyslanychOk}, odrzucono ${odrzucone.length} — ` +
      `wpisz ponownie ręcznie: ${opis}`;
    komunikatStart.classList.remove('ukryty');
  } else if (wyslanychOk > 0) {
    komunikatStart.textContent = `Wysłano z kolejki offline: ${wyslanychOk} odczyt(ów).`;
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
    dodajDoKolejki(odczyt);
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
