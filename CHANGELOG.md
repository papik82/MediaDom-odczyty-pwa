# Dziennik zmian

Format na podstawie [Keep a Changelog](https://keepachangelog.com/pl/), wersje
zgodne z numerem w `js/wersja.js`.

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
