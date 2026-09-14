# Dziennik zmian

Format na podstawie [Keep a Changelog](https://keepachangelog.com/pl/), wersje
zgodne z numerem w `js/wersja.js`.

## 0.7.1 — 2026-09-14

### Zmienione
- Nowa ikona aplikacji (`ikony/ikona.svg`): zaokrąglony kwadrat w niebieskim
  gradiencie z prostym białym symbolem wskazówki miernika — czytelny nawet
  w bardzo małych rozmiarach, bezpieczny w masce kołowej (Android). Zmiana
  ma znaczenie tylko wizualne, format i użycie pliku bez zmian.

## 0.7.0 — 2026-09-14

### Dodane
- Model wizyjny (Gemini, po stronie Apps Script) rozpoznaje wskazanie
  licznika ze zdjęcia — zamyka punkt 6 planu prac. `js/webhook.js`:
  `rozpoznajZdjecie(medium, obrazBase64)` woła nową akcję `odczytaj_foto`.
  `js/aparat.js`: `blobDoBase64` koduje zmniejszone zdjęcie do base64.
- Po zrobieniu/wybraniu zdjęcia ekran potwierdzenia sam wysyła je do
  rozpoznania: pole „Stan licznika” pokazuje „Rozpoznawanie odczytu…”,
  a po odpowiedzi wypełnia się propozycją modelu — nadal trzeba kliknąć
  „Zatwierdź”, model niczego nie zapisuje sam.
- Gdy `pasuje` jest `false` albo `pewność` to `niska`, pole zostaje puste
  i pokazuje się komunikat z treścią `problem` — zgodnie z CLAUDE.md,
  niepewny wynik nigdy nie trafia do pola po cichu. Przy pewności
  `średniej` pole wypełnia się, ale z ostrzeżeniem do sprawdzenia.
- Zabezpieczenie przed wyścigiem: jeśli użytkownik zdąży zamknąć ekran
  potwierdzenia (Anuluj/home) zanim model odpowie, spóźniona odpowiedź
  jest ignorowana zamiast wpisać wartość w already-zamknięty ekran.

Zweryfikowane na żywo z prawdziwym webhookiem i kluczem Gemini (curl):
poprawne odrzucenie obrazu bez licznika (`pasuje: false`, `pewność: wysoka`)
oraz pełna ścieżka sukcesu przetestowana w przeglądarce z odpowiedzią
o kształcie zgodnym z tym, co faktycznie zwraca backend.

## 0.6.1 — 2026-09-14

### Dodane
- Przycisk „🏠” w nagłówku, widoczny na każdym ekranie — zawsze wraca do
  kafelków (sprząta po drodze podgląd zdjęcia, jeśli był otwarty).

## 0.6.0 — 2026-09-14

### Zmienione
- Ekran wyboru metody (zrób zdjęcie / wybierz z galerii / wpisz ręcznie)
  rozszerzony z samego gazu na wszystkie cztery media — zmiana jednej
  stałej `MEDIA_ZE_ZDJECIEM` w `js/media.js`, bez przebudowy reszty
  aplikacji, dokładnie jak zakładało CLAUDE.md. Model wizyjny (OCR) wciąż
  nie istnieje (punkt 6) — dla wszystkich mediów wartość na razie wpisuje
  się ręcznie, patrząc na podgląd zdjęcia.
- CLAUDE.md zaktualizowane: tabela mediów i opis „zdjęcie tylko dla gazu”
  odzwierciedlają nową decyzję.

## 0.5.1 — 2026-09-13

### Dodane
- Trzecia opcja na ekranie wyboru metody dla gazu: „🖼️ Wybierz z galerii” —
  do przepisania odczytu ze zdjęcia zrobionego wcześniej (np. przez kogoś
  innego), bez otwierania aparatu. Realizuje ścieżkę 3 z BACKLOG.md
  (sekcja „PWA: trzy ścieżki wpisywania odczytu”).
- `js/aparat.js`: wspólna funkcja wewnętrzna dla aparatu i galerii — różni
  je tylko obecność atrybutu `capture` na wejściu pliku. Zweryfikowane
  w teście, że ścieżka „z galerii” faktycznie nie ustawia `capture`.

Ścieżka 2 z tej samej sekcji backlogu (OCR) wciąż czeka na punkt 6.
`zrodlo` w arkuszu i zapis linku do zdjęcia na Dysku to osobna sprawa —
webhook i tak dostaje tylko `metoda: "foto"`, nie rozróżnia jeszcze,
czy zdjęcie było świeże czy z galerii.

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
