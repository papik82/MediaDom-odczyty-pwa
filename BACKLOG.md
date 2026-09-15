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
6. [x] Akcja `odczytaj_foto` w Apps Script i podpięcie Gemini.
7. [x] Kolejka offline.

Cały plan z CLAUDE.md zrealizowany. Dalsze pomysły — patrz backlog niżej.

## Backlog — pomysły i decyzje na przyszłość

Nierozstrzygnięte pytania i pomysły spisane, żeby nie zgubić kontekstu
między sesjami. Nic z poniższego nie jest jeszcze zaimplementowane, chyba
że przy punkcie jest wyraźna adnotacja „Rozstrzygnięcie”.

### 1. PWA: wpisy zmiany stanu kotła
[x] Zrobione w całości (2026-09-15) — PWA (karta „Kocioł”, formularz
z podpowiedzią ostatnich nastaw, wysyłka tylko przy faktycznej zmianie,
kolejka offline współdzielona z odczytami) i Apps Script (`zmiana_kotla` /
`ostatni_kociol`, zakładka `kociol` z realną strukturą kolumn) działają
end-to-end — przetestowane wielokrotnie na żywo, bezpośrednio na
prawdziwym arkuszu, nie tylko mockiem.

Przy okazji tych testów znaleziony i naprawiony osobny, niezwiązany bug:
kolumna `nr_gaz` w `odczyty` nie wypełniała się dla nowych wpisów z PWA
(przez co `sezon` też się nie aktualizował) — `zapiszOdczyt` nigdy jej nie
zapisywał. Patrz punkt 7 (uwaga techniczna) po szczegóły ostatecznego
rozwiązania.

Otwarte:
- BUG (zgłoszone 2026-09-15): formularz nie zawsze wypełnia się poprawnie
  ostatnimi nastawami po otwarciu karty „Kocioł” — do zbadania. Podejrzane
  miejsca: `otworzKociol()` / `wczytajOstatnieNastawyKotla()` w
  [js/app.js](js/app.js) — zależność od tego, czy `ostatni_kociol` zdąży
  odpowiedzieć zanim ekran się pokaże, obsługa `brak`/błędu połączenia,
  parsowanie `cyrkulacja` (`sparsujCyrkulacje`) dla nietypowych formatów.
- Konwencja daty: `obowiazuje_od` = moment faktycznej zmiany nastawy, BEZ przesunięcia o jeden odczyt wstecz.
  Uwaga: archiwum ma przesunięcie o jeden odczyt wstecz (wpisy opisywały okres kończący się danym odczytem).
  Stare i nowe wpisy znaczą co innego — wymaga rozstrzygnięcia przy migracji.
  PWA już implementuje konwencję bez przesunięcia (`obowiazuje_od` = czas
  faktycznej zmiany) — rozstrzygnięcie dotyczy tylko migracji archiwum,
  nie nowych wpisów.

### 2. PWA: trzy ścieżki wpisywania odczytu
1. [x] Wpis ręczny.
2. [x] Zdjęcie licznika + automatyczny odczyt wskazania (OCR) — Gemini przez
   Apps Script, akcja `odczytaj_foto` (2026-09-14).
3. [x] Otwarcie istniejącego zdjęcia (z galerii) i ręczne przepisanie z niego.

Wszystkie trzy ścieżki działają dla wszystkich czterech mediów — ekran
wyboru metody ma „Zrób zdjęcie” / „Wybierz z galerii” / „Wpisz ręcznie”,
obie ścieżki ze zdjęciem (świeże i z galerii) przechodzą przez ten sam OCR.
Model niczego nie zapisuje sam — tylko podpowiada wartość w polu „Stan
licznika”, którą trzeba zatwierdzić; przy `pasuje: false` albo pewności
`niska` pole zostaje puste z ostrzeżeniem zamiast cichej akceptacji.
Webhook na razie nie rozróżnia zdjęcia świeżego od wybranego z galerii —
obie idą jako `metoda: "foto"`. Poniższe wymagania (kolumna `zrodlo`, link
do zdjęcia na Dysku) jeszcze nie są zrobione — dotyczą dalszych zmian
w Apps Script, nie samego OCR.

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

### 6. PWA: zakładka podglądu wpisanych odczytów
Ekran (osobna karta, nie kafelek medium) pokazujący ostatnio zapisane
odczyty z arkusza — żeby sprawdzić z telefonu, co poszło, bez wchodzenia
do Arkusza Google.

Wymaga nowej akcji odczytu w Apps Script (np. `lista_odczytow`) — kontrakt
webhooka na razie zna tylko zapis (`odczyt`) i podpowiedź ostatnich nastaw
kotła (`ostatni_kociol`), nie ma nic do pobierania historii odczytów.
Do ustalenia: zakres (np. ostatnie N wpisów na medium, czy z filtrem
medium), które kolumny pokazać (stan, data_godzina, metoda, przyrost),
czy wynik ma nadpisywać kolejkę offline czy być z niej niezależny.

### 7. Uwaga techniczna: nie pisz formuł do arkusza przez Apps Script
Ustalone empirycznie (2026-09-15) przy naprawie kolumny `nr_gaz`
w `odczyty`: zapis formuły przez `Range.setValue(s)` do wiersza, do
którego w tym samym wywołaniu webhooka trafiają też dane, kończył się
błędem parsowania („Błąd analizowania formuły” — formuła widoczna
nieprzetłumaczona, `#ERROR!` w komórce). Sprawdzone i wykluczone jako
przyczyna: kolejność `copyTo`/`setValues`, zakres kolumn w `copyTo`,
`SpreadsheetApp.flush()` po `insertRowsAfter`, format liczbowy komórki
(był poprawny, nie „Zwykły tekst”), świeżość wiersza (psuło się nawet
w wierszu istniejącym od dawna). Rzeczywistej przyczyny nie udało się
jednoznacznie ustalić mimo kilku niezależnych testów bezpośrednio
w arkuszu na żywo.

Przyjęte rozwiązanie: `nr_gaz` w `odczyty` ma formułę wpisaną ręcznie
z wyprzedzeniem, na zapas wierszy utrzymywany ręcznie w arkuszu —
`zapiszOdczyt` pisze tylko do kolumn A-F, nigdy do G.

Dotyczy każdej przyszłej kolumny z formułą w arkuszach, do których pisze
webhook — np. gdyby `zrodlo` (punkt 2) albo coś w `kociol` miało kiedyś
być formułą, a nie stałą wartością: ta sama pułapka by tam wróciła.
