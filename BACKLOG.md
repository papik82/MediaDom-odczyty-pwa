# Plan prac i backlog

Jedno miejsce na to, co zrobione, co w toku i co dalej — żeby nie trzymać
tego samego w dwóch plikach. Rzeczy już wydane trafiają do
[CHANGELOG.md](CHANGELOG.md); tu zostaje plan i otwarte pomysły/decyzje.

## Plan prac (kolejność wdrażania PWA)

1. [x] Szkielet PWA: manifest, service worker, ekran startowy z kafelkami.
2. [x] Ekran ustawień i zapis konfiguracji w `localStorage`.
3. [x] Ekran potwierdzenia: wartość, data i godzina, oba pola edytowalne.
4. [x] Ręczny wpis odczytu dla wszystkich czterech mediów. Sprawdza całą
   komunikację z webhookiem od początku do końca.
5. [x] Aparat dla gazu: zdjęcie, zmniejszenie, wysyłka — na razie z ręcznym
   wpisaniem wyniku, bez modelu.
6. [ ] Akcja `odczytaj_foto` w Apps Script i podpięcie Gemini.
7. [ ] Kolejka offline.

Po punkcie 4 aplikacja jest już użyteczna. Reszta to wygoda.

## Backlog — pomysły i decyzje na przyszłość

Nierozstrzygnięte pytania i pomysły spisane, żeby nie zgubić kontekstu
między sesjami. Nic z poniższego nie jest jeszcze zaimplementowane, chyba
że przy punkcie jest wyraźna adnotacja „Rozstrzygnięcie”.

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
1. [x] Wpis ręczny.
2. [ ] Zdjęcie licznika + automatyczny odczyt wskazania (OCR) — czeka na punkt 6.
3. [x] Otwarcie istniejącego zdjęcia (z galerii) i ręczne przepisanie z niego.

Ścieżki 1 i 3 działają dla wszystkich czterech mediów (2026-09-14 — lista
`MEDIA_ZE_ZDJECIEM` w `js/media.js` rozszerzona z samego gazu) — ekran
wyboru metody ma „Zrób zdjęcie” / „Wybierz z galerii” / „Wpisz ręcznie”.
Webhook na razie nie rozróżnia zdjęcia świeżego
od wybranego z galerii — obie idą jako `metoda: "foto"`. Poniższe wymagania
(kolumna `zrodlo`, link do zdjęcia na Dysku) jeszcze nie są zrobione —
dotyczą zmian w Apps Script, nie tylko w PWA.

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
działa w ekranie potwierdzenia odczytu (punkt 3 planu prac powyżej) — nie
wymaga zmian w kodzie. Dotyczy wyłącznie ścieżki ręcznej; czas z EXIF dla
ścieżki ze zdjęciem to osobna sprawa (patrz punkt 2).

### 4. Do sprawdzenia przed migracją historii
Czy w starym pliku (układ: jedna zakładka na sezon) godzina odczytu była w ogóle zapisywana,
czy 17:30 to konwencja doklejona przy eksporcie. Jeśli to drugie — rzeczywisty rozrzut godzin
jest większy niż zakładane pół godziny i wpływa na wiarygodność historycznych wartości na dobę.

### 5. Pomysł na później: zakładka `pomysly`
Zakładka wypełniana ręcznie (kolumny: data, obszar, opis, status) jako miejsce zrzutu pomysłów z telefonu.
Docelowo webhook przyjmuje typ `pomysl` i dopisuje wiersz — PWA dostaje pole "notatka".
Niski priorytet.
