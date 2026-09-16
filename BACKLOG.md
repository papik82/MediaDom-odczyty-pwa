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

[x] BUG naprawiony (2026-09-16): przyczyną było to, że `otworzKociol()`
pokazywał ekran z pustymi/domyślnymi polami natychmiast, a podpowiedź
z `ostatni_kociol` wypełniała je dopiero po odpowiedzi webhooka — bez
oczekiwania i bez ochrony przed nieaktualną odpowiedzią. Na wolniejszym
połączeniu użytkownik mógł zdążyć coś wpisać, zanim spóźniona odpowiedź to
po cichu nadpisała. Naprawione: pola blokują się z komunikatem
„Wczytywanie ostatnich nastaw…” do czasu odpowiedzi, plus licznik generacji
(wzorem `generacjaPotwierdzenia` z ekranu OCR) chroni przed nadpisaniem
przez spóźnioną, nieaktualną odpowiedź przy szybkim ponownym otwarciu
ekranu. Zweryfikowane w przeglądarce (opóźniony i wyścigowy fetch).

Otwarte:
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

### 6. PWA: zakładka podglądu wpisanych odczytów i temperatur
[x] Zrobione w całości (2026-09-16) — karta „Podgląd” na ekranie startowym
(ta sama konwencja co Kocioł), dwa niezależne bloki: lista ostatnich 15
odczytów (wszystkie media razem, najnowsze pierwsze) i tabela temperatur
dobowych z ostatnich 14 dni (kolumna na czujnik — nazwy/liczba czujników
budowane z tego, co przyjdzie z webhooka, nie na sztywno). Każdy blok
wczytuje się i zawodzi niezależnie od drugiego. Kontrakt
(`ostatnie_odczyty` / `temperatury_dobowe`) opisany w CLAUDE.md — wdrożony
i zweryfikowany na żywo: oba zapytania zwracają prawdziwe dane z arkusza,
PWA poprawnie je renderuje (w tym zaokrąglanie zmiennoprzecinkowych
wartości temperatur do jednego miejsca po przecinku).

Świadomie pominięte na razie (można dołożyć później, gdy zajdzie potrzeba):
filtrowanie po medium, kolumna `przyrost` w liście odczytów, wykres zamiast
tabeli dla temperatur, edycja/usuwanie wpisów z tego ekranu (to tylko
podgląd, nie zarządzanie danymi).

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

### 8. Pomysł organizacyjny: pliki Apps Script w folderze projektu
Trzymać źródła Apps Script (webhook) jako pliki `.js`/`.gs` w repo PWA,
zamiast tylko w edytorze Apps Script online — Claude mógłby je samodzielnie
czytać i modyfikować lokalnie, a gotowe zmiany użytkownik ręcznie
przenosiłby (wklejał) do Apps Script w Google.

Do ustalenia: gdzie w strukturze katalogów (osobny folder np.
`apps-script/`, poza `js/`, bo to inny runtime — V8 Apps Script, nie
przeglądarka), czy trzymać tam też podpowiedzi dla modelu wizyjnego
(słownik kluczowany medium, patrz CLAUDE.md), i czy/jak pilnować, żeby
kopia w repo nie rozjechała się z tym, co faktycznie wdrożone w Google
(ręczne przenoszenie = ryzyko, że repo pokazuje starszą wersję niż produkcja).
