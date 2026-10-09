// Start aplikacji i zdarzenia globalne: wersja w stopce, przycisk „home”,
// kolejka offline, powrót z tła, aktualizacja przez service workera.
// Każdy ekran ma własny moduł w js/ekrany/ — tu tylko je ładujemy.

import { czyUstawieniaZapisane } from './ustawienia.js';
import { WERSJA_APLIKACJI } from './wersja.js';
import {
  pokazEkran, ekranStart, odswiezStanStartu, czyStartWidoczny, czyKomunikatStartWidoczny,
} from './nawigacja.js';
import { aktualizujKomunikatKolejki, przetworzKolejkeOffline } from './kolejka-wysylka.js';
import { otworzUstawienia } from './ekrany/ustawienia.js';
import { zwolnijPodgladZdjecia } from './ekrany/odczyt.js';
import { zamknijEkranPradu } from './ekrany/prad.js';
// Moduły bez eksportów używanych tutaj — wystarczy, że się załadują
// (rejestrują własne zdarzenia i haki powrotu na ekran startowy).
import './ekrany/alarmy.js';
import './ekrany/kociol.js';
import './ekrany/podglad.js';
import './ekrany/zbieracz.js';
import './ekrany/pomysly.js';
import './ekrany/faktura.js';

document.getElementById('numer-wersji').textContent = WERSJA_APLIKACJI;

// Przycisk „home” jest widoczny na każdym ekranie i zawsze wraca do
// kafelków — sprząta podgląd zdjęcia, żeby nie zostawiać wycieku URL-a,
// gdy ktoś wyjdzie w trakcie robienia zdjęcia.
document.getElementById('przycisk-home').addEventListener('click', () => {
  zwolnijPodgladZdjecia();
  zamknijEkranPradu();
  pokazEkran(ekranStart);
});

// Przy pierwszym uruchomieniu, bez zapisanych ustawień, od razu pokazujemy
// ekran ustawień — bez adresu i tokenu wysyłka i tak by się nie udała.
if (czyUstawieniaZapisane()) {
  pokazEkran(ekranStart);
} else {
  otworzUstawienia();
}

// Kolejka offline: pokaż, ile czeka, i spróbuj wysłać od razu przy starcie
// (na wypadek, gdyby zasięg wrócił, zanim ktoś znów otworzył aplikację),
// a potem przy każdym powrocie połączenia — bez czekania na kolejny start.
aktualizujKomunikatKolejki();
if (czyUstawieniaZapisane()) {
  przetworzKolejkeOffline();
}
// Telefon trzyma zainstalowaną aplikację w tle godzinami — po powrocie na
// pierwszy plan odświeżamy nastawy kotła i alarmy (throttling wewnątrz tych
// funkcji) i tylko wtedy, gdy widać ekran startowy; inaczej odświeży je
// powrót na start.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // Powrót z tła to jedyny moment, w którym zainstalowana aplikacja „budzi
  // się” bez przeładowania strony — sprawdzamy więc przy nim, czy na
  // serwerze nie ma nowej wersji (patrz rejestracja service workera niżej).
  sprawdzAktualizacjeAplikacji();
  if (czyStartWidoczny()) {
    if (czekaNaPrzeladowanie && czyMoznaBezpieczniePrzeladowac()) {
      window.location.reload();
      return;
    }
    odswiezStanStartu();
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
  return czyStartWidoczny() && !czyKomunikatStartWidoczny();
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
