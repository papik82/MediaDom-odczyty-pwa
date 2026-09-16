# Dziennik zmian

Format na podstawie [Keep a Changelog](https://keepachangelog.com/pl/), wersje
zgodne z numerem w `js/wersja.js`.

## 0.13.1 — 2026-09-16

### Zmienione
- Zakres ekranu „Podgląd” rozszerzony z dwóch tygodni do miesiąca: lista
  ostatnich odczytów pokazuje teraz 30 wpisów (było 15), a tabela
  temperatur dobowych obejmuje ostatnie 30 dni (było 14) — nagłówek
  zmieniony na „ostatni miesiąc”. Zmiana wyłącznie po stronie PWA
  (`js/app.js`, `js/webhook.js`) — istniejące akcje `ostatnie_odczyty`
  i `temperatury_dobowe` już przyjmowały parametr z liczbą, więc backend
  nie wymagał zmian.

## 0.13.0 — 2026-09-16

### Dodane
- Nowa karta **„Podgląd”** na ekranie startowym (punkt 6 backlogu) — tylko
  do odczytu, bez wpływu na kolejkę offline ani zapis danych. Dwa
  niezależne bloki:
  - **Ostatnie odczyty** — 15 najnowszych wpisów z `odczyty` (wszystkie
    media razem, najnowsze pierwsze): data i godzina, medium, stan
    z jednostką.
  - **Temperatury dobowe** — ostatnie 14 dni z `temp_doba`, tabela
    z kolumną na każdy czujnik. Kolumny budowane dynamicznie z danych
    odpowiedzi (nie na sztywno „parter/pietro/zewn”), więc przyszła zmiana
    zestawu czujników nie wymaga zmian w PWA.
  - Każdy blok wczytuje się i może zawieść niezależnie od drugiego —
    błąd jednego nie blokuje wyświetlenia drugiego.
- `js/webhook.js`: `pobierzOstatnieOdczyty(ile)` i `pobierzTemperaturyDobowe(dni)`
  — akcje `ostatnie_odczyty` / `temperatury_dobowe`, kontrakt opisany
  w CLAUDE.md. Wdrożone po stronie Apps Script i zweryfikowane na żywo.
- `ikony/podglad.svg` — nowa ikona (mini wykres słupkowy w kółku, w stylu
  reszty ikon aplikacji).

Przetestowane najpierw z mockowanym fetchem (renderowanie, dynamiczne
kolumny czujników, komunikat błędu, pusty stan), a po wdrożeniu akcji
w Apps Script — na żywo, z prawdziwymi danymi z arkusza (w tym poprawne
zaokrąglanie „brzydkich” zmiennoprzecinkowych wartości temp_sr).

## 0.12.0 — 2026-09-16

### Zmienione
- Pole „Tryb” w formularzu kotła zastąpione segmentowym przełącznikiem
  (cztery przyciski w jednym rzędzie: Wył./CWU/CO/CWU+CO) zamiast natywnego
  `<select>` — czytelniejsze i szybsze w obsłudze kciukiem, z przesuwającym
  się wskaźnikiem pod aktualnie wybraną opcją, stylistycznie dopasowanym do
  koloru przewodniego aplikacji. Pozycja i szerokość wskaźnika liczone
  w `js/app.js` z realnych wymiarów przycisku (`offsetLeft`/`offsetWidth`),
  nie ze sztywnych procentów, więc nie rozjedzie się przy innej szerokości
  ekranu. Reszta logiki formularza (podpowiedź ostatnich nastaw, blokada
  na czas wczytywania, wykrywanie zmian) bez zmian — `pole-tryb` zastąpione
  przez `segment-tryb` z tym samym miejscem w przepływie danych.

## 0.11.2 — 2026-09-16

### Naprawione
- Formularz „Kocioł” pokazywał domyślne, puste pola natychmiast po otwarciu,
  a podpowiedź ostatnich nastaw (`ostatni_kociol`) wypełniała je dopiero po
  odpowiedzi webhooka — bez oczekiwania i bez zabezpieczenia. Na wolniejszym
  połączeniu użytkownik mógł zdążyć zacząć wpisywać wartości, które
  spóźniona odpowiedź po cichu nadpisywała (zgłoszony bug: „formularz nie
  zawsze wypełnia się poprawnie”). Teraz pola są zablokowane z komunikatem
  „Wczytywanie ostatnich nastaw…” do czasu odpowiedzi, a licznik generacji
  (analogicznie do `generacjaPotwierdzenia` przy OCR zdjęć) chroni przed
  nadpisaniem nowszego stanu przez nieaktualną, spóźnioną odpowiedź.

## 0.11.1 — 2026-09-14

### Zmienione
- Format zapisu cyrkulacji dopasowany do stylu już istniejącego w arkuszu
  (`kociol`, zaimportowane z archiwum): `"4:30 - 22:00"` — bez zera
  wiodącego przy godzinie, spacje wokół myślnika — zamiast wcześniejszego
  `"04:30-22:00"`. Kilka przedziałów nadal łączone przecinkiem (rozszerzenie
  PWA, w archiwum zawsze był jeden przedział na wiersz).

### Naprawione
- Pola „Krzywa grzewcza” i „Przesunięcie” w formularzu kotła były oznaczone
  jako wymagane, ale w archiwum tryb `cwu` (sama ciepła woda, bez CO)
  legalnie ma je puste — natywna walidacja przeglądarki blokowała wysyłkę
  formularza w tym trybie, zanim doszło do jakiejkolwiek naszej logiki.
  Znalezione przy okazji testowania zmiany formatu cyrkulacji.
- Puste pole liczbowe dawało `NaN` (z `parseFloat('')`), a nie `null` —
  psuło to zarówno wykrywanie „czy coś się zmieniło” (nigdy nie zgadzało
  się z podpowiedzią), jak i sam zapis (`Number(NaN)` w Apps Script). Teraz
  puste pole to wprost `null` w wysyłanym JSON-ie.

## 0.11.0 — 2026-09-14

### Dodane
- Nowy moduł: **dziennik zmian nastaw kotła** (backlog, punkt 1). Osobna
  karta „Kocioł" na ekranie startowym, wyraźnie odróżniona od kafelków
  mediów — to dziennik zmian, nie okresowy odczyt.
- Formularz: tryb (off/cwu/co/cwu_co), krzywa grzewcza, przesunięcie,
  temperatura CWU, cyrkulacja jako lista przedziałów czasu (można dodać
  kilka na dobę, każdy z osobnym polem od–do). Przy otwarciu formularz
  pyta webhook o ostatnio zapisane nastawy (`ostatni_kociol`) i wypełnia
  się nimi — zmieniasz tylko to, co faktycznie inne.
- Wysyłka (`zmiana_kotla`) idzie tylko, gdy formularz różni się od
  podpowiedzianych nastaw — inaczej komunikat „Brak zmian… nic nie
  wysłano" bez zbędnego wiersza w arkuszu.
- `js/webhook.js`: wydzielona generyczna funkcja `wyslij()`, używana teraz
  przez odczyty, OCR i kocioł; `js/kolejka.js` (bez zmian API) obsługuje
  oba typy wpisów jednolicie — offline działa tak samo dla kotła jak dla
  odczytów.
- CLAUDE.md: opisany kontrakt `zmiana_kotla` / `ostatni_kociol` (akcje do
  dopisania w Apps Script) oraz wymagana zakładka `kociol` z nagłówkiem
  i kolejnością kolumn. Przy okazji poprawiona nieaktualna struktura
  katalogów (był tam plik `walidacja.js`, który nigdy nie powstał —
  zastąpiony rzeczywistą listą, w tym `kolejka.js`).

Przetestowane (mockowany fetch — akcje jeszcze nie istnieją w Apps Script,
użytkownik dopisze je sam): podpowiedź z poprzednich nastaw łącznie
z odtworzeniem kilku przedziałów cyrkulacji z tekstu, wykrycie braku zmian,
wysyłka po zmianie jednego pola, kolejkowanie offline i późniejsza
automatyczna wysyłka przez tę samą, wspólną kolejkę co odczyty.

## 0.10.0 — 2026-09-14

### Dodane
- Kolejka offline (punkt 7 planu prac — ostatni z głównego planu z
  CLAUDE.md). Gdy wysyłka odczytu zawiedzie z powodu braku sieci (nie
  odrzucenia przez webhook), odczyt trafia do `localStorage`
  (`js/kolejka.js`) zamiast wymuszać czekanie na zasięg. Wysyłka
  automatyczna: przy starcie aplikacji i przy każdym powrocie połączenia
  (`window.addEventListener('online', …)`), zawsze od najstarszego wpisu —
  webhook sprawdza chronologię per medium, więc kolejność się liczy.
- Ekran startowy pokazuje, ile odczytów czeka w kolejce. Po wysłaniu:
  komunikat ile poszło; jeśli webhook odrzucił któryś wpis (np. nieaktualna
  już chronologia), pole zostaje usunięte z kolejki (dalsze automatyczne
  próby i tak by nie pomogły) i użytkownik dostaje jasny opis, żeby wpisać
  go ponownie ręcznie — zamiast cichej utraty albo nieskończonych retry.

Przetestowane: błąd sieci → wpis w kolejce + komunikat; powrót "online" →
poprawna wysyłka i czyszczenie kolejki; dwa wpisy w kolejce z jednym
odrzuceniem → zachowana kolejność FIFO, jeden wysłany, drugi zgłoszony
z powodem odrzucenia.

## 0.9.0 — 2026-09-14

### Dodane
- Piąte medium: **Prąd suma** (`prad_suma`), kWh, bez miejsc po przecinku —
  ta sama funkcjonalność co reszta (zdjęcie/galeria/ręcznie, własny
  poprzedni stan i kontrola chronologii). Dodanie sprowadziło się do
  jednego wpisu w `js/media.js` (`MEDIA` i `MEDIA_ZE_ZDJECIEM`) plus
  kafelka w `index.html` — dokładnie tak, jak zakładała architektura
  z CLAUDE.md. Ikona kafelka: ta sama błyskawica co Prąd T1/T2.
  CLAUDE.md zaktualizowane (tabela mediów, lista wartości `medium`).

Backend nie wymagał zmian — `zapiszOdczyt` w Apps Script nie waliduje
`medium` względem sztywnej listy, przyjmuje dowolny ciąg znaków.

## 0.8.2 — 2026-09-14

### Naprawione
- **Błąd cache service workera**: strategia „cache-first + aktualizuj w tle”
  aktualizowała każdy plik osobno przy okazji zwykłych żądań, więc telefon
  mógł dostać niespójną mieszankę wersji — np. nowy `index.html` (z nowymi
  ikonami) razem ze starym `css/styl.css` (bez reguły ich rozmiaru) i starym
  `js/wersja.js` (stąd np. widoczny numer wersji nie zgadzający się z tym,
  co faktycznie było na ekranie). Objaw zgłoszony przez użytkownika:
  „olbrzymie” ikony na kafelkach mimo poprawnego kodu w repozytorium.
  `sw.js` działa teraz na czystym cache-first bez podmiany pojedynczych
  plików w locie — cache zmienia się wyłącznie całością, przy instalacji
  nowej wersji. Jeśli telefon nadal pokazuje starą/zepsutą wersję po tej
  aktualizacji, jednorazowo wyczyść dane strony (albo usuń i dodaj PWA
  ponownie do ekranu głównego), żeby wyjść ze starego, zepsutego cache.

## 0.8.1 — 2026-09-14

### Zmienione
- Emoji na ekranie wyboru metody wpisu (📷🖼️✏️) zastąpione ikonami SVG
  w tej samej stylistyce: `ikony/aparat.svg` (biała, na niebieskim
  przycisku), `ikony/galeria.svg` i `ikony/recznie.svg` (ciemne, na
  szarych przyciskach). Przyciski `.przycisk-glowny`/`.przycisk-drugorzedny`
  teraz flex (ikona + tekst wyśrodkowane w rzędzie).

## 0.8.0 — 2026-09-14

### Zmienione
- Emoji na kafelkach mediów (🔥💧⚡) i w nagłówku (🏠⚙) zastąpione własnymi
  ikonami SVG w tej samej stylistyce co ikona aplikacji (grube, zaokrąglone
  linie): `ikony/gaz.svg`, `ikony/woda.svg`, `ikony/prad.svg` (wspólna dla
  obu taryf), `ikony/home.svg`, `ikony/ustawienia.svg`. Emoji renderują się
  różnie zależnie od systemu/przeglądarki — własne ikony wyglądają tak samo
  wszędzie i spójnie z ikoną aplikacji.

## 0.7.2 — 2026-09-14

### Zmienione
- Ikona aplikacji: dach domu nad manometrem (zamiast samego manometru).
  Kilka iteracji dopracowanych wspólnie z użytkownikiem — dach wyżej
  i wyraźnie odsunięty od łuku, krótkie symboliczne ścianki dokładnie nad
  podstawami łuku (bez dotykania go), strzałka skrócona, żeby nie wchodziła
  w pas łuku, okap grubości łuku wystający poza ścianę. Manometr sam
  w sobie bez zmian kształtu/rozmiaru przez całą iterację.

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
