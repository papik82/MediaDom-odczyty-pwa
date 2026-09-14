// Sterowanie ekranami aplikacji: przełączanie widoków, obsługa kafelków,
// formularza ustawień, ekranu potwierdzenia odczytu i wysyłki do webhooka.

import { odczytajUstawienia, zapiszUstawienia, czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import { MEDIA, MEDIA_ZE_ZDJECIEM } from './media.js';
import { wyslijOdczyt } from './webhook.js';
import { zrobZdjecie, wybierzZGalerii } from './aparat.js';

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
// źródło (aparat albo galeria). Wynik na razie trzeba przepisać ręcznie,
// patrząc na podgląd — model wizyjny dojdzie w punkcie 6.
async function obslozWyborZdjecia(pobierzZdjecie) {
  try {
    const { url } = await pobierzZdjecie(wybraneMedium);
    otworzPotwierdzenie(wybraneMedium, 'foto', url);
  } catch (blad) {
    console.error('Nie udało się uzyskać zdjęcia:', blad);
    pokazEkran(ekranStart);
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
    console.error('Nie udało się wysłać odczytu:', blad);
    pokazBladPotwierdzenia(
      'Nie udało się wysłać odczytu — sprawdź połączenie z internetem i spróbuj ponownie.'
    );
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

// Rejestracja service workera — pozwala otworzyć aplikację bez zasięgu.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((blad) => {
      console.error('Nie udało się zarejestrować service workera:', blad);
    });
  });
}
