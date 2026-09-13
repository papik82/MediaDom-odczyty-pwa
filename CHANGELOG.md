# Dziennik zmian

Format na podstawie [Keep a Changelog](https://keepachangelog.com/pl/), wersje
zgodne z numerem w `js/wersja.js`.

## 0.5.0 — 2026-09-13

### Dodane
- Aparat dla gazu (punkt 5 planu prac): kafelek Gazu pokazuje wybór
  „Zrób zdjęcie” / „Wpisz ręcznie” zamiast od razu iść do ręcznego wpisu —
  reszta mediów bez zmian, bo lista mediów ze zdjęciem (`MEDIA_ZE_ZDJECIEM`
  w `js/media.js`) na razie obejmuje tylko gaz.
- `js/aparat.js` — otwiera aparat telefonu (tylna kamera), zmniejsza zdjęcie
  do maks. 1000 px dłuższego boku i kompresuje do JPEG jakości 0.8 (test:
  zdjęcie 3000×2000/4,5 MB → 1000×667/8,4 KB).
- Ekran potwierdzenia pokazuje podgląd zrobionego zdjęcia, żeby dało się
  z niego przepisać wskazanie licznika. Model wizyjny (OCR) jeszcze nie
  istnieje — to punkt 6; na razie wartość zawsze wpisuje się ręcznie.
- Odczyt ze zdjęcia wysyła się z `metoda: "foto"` (zamiast `"reczny"`),
  `foto_url` zostaje puste — zdjęć na razie nie przechowujemy, zgodnie
  z CLAUDE.md.

## 0.4.0 — 2026-09-13

### Dodane
- `js/webhook.js` — rzeczywista wysyłka odczytu do webhooka Apps Script
  (`akcja: "odczyt"`), zamyka punkt 4 planu prac. Działa dla wszystkich
  czterech mediów wpisywanych ręcznie.
- Obsługa odpowiedzi webhooka na ekranie potwierdzenia: sukces wraca na
  ekran startowy z poprzednim stanem i przyrostem; odrzucenie (np. stan
  niższy niż poprzedni — `wymaga_potwierdzenia`) i błąd sieci zostają na
  ekranie potwierdzenia z komunikatem, żeby można było poprawić i wysłać
  ponownie bez przepisywania wszystkiego od nowa.
- Przycisk „Zatwierdź” blokuje się i pokazuje „Wysyłanie…” na czas żądania.

## 0.3.1 — 2026-09-13

### Zmienione
- Kolejność kafelków na ekranie startowym: pierwszy rząd Gaz i Woda, drugi
  rząd Prąd T1 i Prąd T2.

## 0.3.0 — 2026-09-13

### Dodane
- Ekran potwierdzenia odczytu: stan licznika (z krokiem dopasowanym do
  medium) oraz data i godzina odczytu, wypełniana automatycznie bieżącym
  czasem i edytowalna przed zatwierdzeniem.
- `js/media.js` — jedno miejsce z nazwą, jednostką i precyzją każdego medium,
  żeby dołożenie kolejnego medium (np. ze zdjęciem) nie wymagało przebudowy.
- Formularz potwierdzenia przygotowuje obiekt zgodny z kontraktem webhooka
  (`medium`, `stan`, `data_godzina`, `metoda`, `foto_url`, `uwagi`) i pokazuje
  go w konsoli oraz w komunikacie na ekranie startowym. Rzeczywista wysyłka
  do Apps Script jeszcze nie działa.

## 0.1.0 — 2026-09-13

### Dodane
- Szkielet PWA: manifest, service worker z cache powłoki aplikacji, ikona.
- Ekran startowy z czterema kafelkami mediów: Gaz, Prąd T1, Prąd T2, Woda.
- Ekran ustawień — adres webhooka i token zapisywane w `localStorage`,
  pokazywany automatycznie przy pierwszym uruchomieniu.
- Numer wersji aplikacji widoczny w stopce każdego ekranu.
