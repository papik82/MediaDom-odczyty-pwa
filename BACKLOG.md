# Backlog

Notatki i decyzje do przyszłej pracy — nierozstrzygnięte pytania i pomysły
spisane, żeby nie zgubić kontekstu między sesjami. Nic z poniższego nie jest
jeszcze zaimplementowane.

## Backlog — 2026-09-13

### 1. PWA: wpisy zmiany stanu kotła
Aplikacja ma pozwalać dodawać wpisy do dziennika "kociol", nie tylko odczyty mediów.
Pola: tryb (off / cwu / co / cwu_co), krzywa grzewcza, przesunięcie, temperatura CWU, cyrkulacja.

Wymagania:
- Formularz podpowiada ostatnio obowiązujące nastawy; zmieniam jedno pole, reszta przepisuje się sama.
- Wpis powstaje tylko gdy coś się faktycznie zmieniło (to dziennik zmian, nie odczyt okresowy).
- Konwencja daty: `obowiazuje_od` = moment faktycznej zmiany nastawy, BEZ przesunięcia o jeden odczyt wstecz.
  Uwaga: archiwum ma przesunięcie o jeden odczyt wstecz (wpisy opisywały okres kończący się danym odczytem).
  Stare i nowe wpisy znaczą co innego — wymaga rozstrzygnięcia przy migracji.

### 2. PWA: trzy ścieżki wpisywania odczytu
1. Wpis ręczny.
2. Zdjęcie licznika + automatyczny odczyt wskazania (OCR).
3. Otwarcie istniejącego zdjęcia i ręczne przepisanie z niego.

Wymagania:
- Zdjęcie zapisywane niezależnie od ścieżki; w "odczyty" kolumna z linkiem do pliku na Dysku.
  Cel: możliwość weryfikacji wartości odstającej po miesiącach.
- Nowa kolumna `zrodlo`: `reczny` / `ocr` / `ze_zdjecia`.
  Odczyty z OCR mają inny profil błędu — przy szukaniu odstających trzeba rozróżniać populacje.
- OCR nigdy nie zapisuje po cichu: rozpoznana liczba zawsze do potwierdzenia przed zapisem.
  LCD BK-G4 (segmenty, podświetlenie budzone przyciskiem) jest wrażliwy na kąt i odbicia.

### 3. Rzeczywisty czas odczytu zamiast nominalnego 17:30
DECYZJA: nowe odczyty zapisują rzeczywisty czas.
- Ścieżka ze zdjęciem — czas z EXIF.
- Wpis ręczny — czas z zegara telefonu w momencie zapisu.
- Konsekwentnie we wszystkich ścieżkach, inaczej powstaną dwie populacje o różnej dokładności.

Uzasadnienie: przy odstępie 1-dniowym przesunięcie o 30 min to ok. 2% błędu na wartości
znormalizowanej do doby; przy 7-dniowym ok. 0,3%. Problem dotyczy więc sezonu grzewczego
z codziennymi odczytami — czyli dokładnie tam, gdzie liczona jest charakterystyka cieplna.

Historia 2019–2026: zostaje z czasem nominalnym 17:30, brak danych do odtworzenia faktycznych godzin.
"odczyty" potrzebuje sygnału, że czas jest nominalny — osobna kolumna albo data graniczna migracji.

**Rozstrzygnięcie (2026-09-13) dla wpisu ręcznego w PWA:** pole daty i godziny
jest zawsze edytowalne, domyślnie wypełnione bieżącym czasem telefonu w
momencie dokonywania wpisu (nie sztywno, bez możliwości korekty). Już tak
działa w ekranie potwierdzenia odczytu — nie wymaga zmian w kodzie. Dotyczy
wyłącznie ścieżki ręcznej; czas z EXIF dla ścieżki ze zdjęciem to osobna
sprawa (patrz punkt 2).

### 4. Do sprawdzenia przed migracją historii
Czy w starym pliku (układ: jedna zakładka na sezon) godzina odczytu była w ogóle zapisywana,
czy 17:30 to konwencja doklejona przy eksporcie. Jeśli to drugie — rzeczywisty rozrzut godzin
jest większy niż zakładane pół godziny i wpływa na wiarygodność historycznych wartości na dobę.

### 5. Pomysł na później: zakładka `pomysly`
Zakładka wypełniana ręcznie (kolumny: data, obszar, opis, status) jako miejsce zrzutu pomysłów z telefonu.
Docelowo webhook przyjmuje typ `pomysl` i dopisuje wiersz — PWA dostaje pole "notatka".
Niski priorytet.
