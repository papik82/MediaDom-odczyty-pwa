# Dziennik zmian

Format na podstawie [Keep a Changelog](https://keepachangelog.com/pl/), wersje
zgodne z numerem w `js/wersja.js`.

## 1.1.1 — 2026-10-08

### Zmienione
- Kocioł: kilka przedziałów cyrkulacji sklejamy **średnikiem**
  (`4:30 - 9:00; 18:00 - 22:00`), tak jak w archiwum zakładki `kociol`
  (do 1.1.0 — przecinkiem; w arkuszu nie było żadnego takiego wpisu).
  Decyzja: `dokumentacja/decyzje.md` D5 (BACKLOG pkt 23).

### Naprawione
- Wczytanie ostatnich nastaw z cyrkulacją zapisaną średnikami (archiwum)
  dawało jeden zepsuty przedział — `sparsujCyrkulacje` dzieliła tylko po
  przecinku. Teraz dzieli po średniku i po przecinku.
- Inny zapis tej samej cyrkulacji (separator, zero wiodące) nie jest już
  traktowany jako zmiana nastaw — punkt odniesienia przechodzi przez tę samą
  normalizację co formularz.

## 1.1.0 — 2026-10-07

### Dodane
- Karta i ekran „Zbieracz” (BACKLOG pkt 19): stan zbierania temperatur na
  telefonie w jednym miejscu. Na górze werdykt — „Zbieracz działa” / „Działa,
  są uwagi” / „Problem ze zbieraniem” — liczony przez webhook tymi samymi
  regułami co pasek alarmów, więc oba miejsca mówią to samo. Pod nim alarmy
  zbieracza i szczegóły: ostatni puls (z „ile minut temu”), bateria i stan
  ładowania, temperatura baterii, kolejka, wersja zbieracza; ostatnia
  godzina każdego czujnika w arkuszu z temperaturą i źródłem; luki
  w oknie 28 dni; data wygaśnięcia tokenów eWeLink. Akcja `stan_zbieracza`
  (wersja wdrożenia 36), bufor w `localStorage` jak w Odczytach
  i Temperaturach. Nowa ikona `ikony/zbieracz.svg`.

## 1.0.1 — 2026-10-07

### Zmienione
- Wykres doby (ekran Temperatury): kropka na każdym odczycie, czyli na
  każdej średniej godzinowej, w kolorze czujnika. Widać, ile punktów stoi
  za linią i gdzie dokładnie zaczyna się luka (`narysujWykresDoby`,
  `js/app.js`). Większe kropki minimum i maksimum temperatury zewnętrznej
  bez zmian.

## 1.0.0 — 2026-10-07

Pierwsza wersja stabilna. Warunek ustalony przy 0.20.1 — prawdziwy odczyt
miesięczny z nowych ekranów — spełniony 2026-10-01: prąd (T1, T2, suma)
z jednym czasem, T1 + T2 = suma, woda ze zdjęcia. Kod aplikacji bez zmian
względem 0.23.0; zmienia się numer i obietnica: kontrakt z webhookiem
i zachowanie ekranów są stabilne, kolejne zmiany idą jako 1.x.

**Co obejmuje 1.0:**
- odczyty gazu i wody (zdjęcie, galeria, ręcznie; rozpoznawanie zdjęcia
  dla gazu), ekran Prąd — T1, T2 i suma naraz ze wspólną datą,
- data i godzina odczytu z EXIF zdjęcia z galerii,
- kolejka offline z rozpoznawaniem wpisów, które już doszły do arkusza,
- Kocioł: zmiana nastaw z podpowiedzią ostatnich, wyszarzanie zbędnych
  pól, historia zmian (paski CO/CWU z 12 miesięcy),
- Odczyty i Temperatury (z wykresem doby po stuknięciu dnia),
- pasek alarmów: bateria i puls telefonu ze zbieraczem temperatur, cisza
  czujników, luki do importu, a od wersji wdrożenia webhooka 35 także
  przypomnienia o odczytach (gaz po 3 / 10 dniach w sezonie / poza nim,
  prąd i woda od 1. dnia miesiąca),
- samoczynne przechodzenie na nową wersję po powrocie z tła.

### Zmienione
- `CLAUDE.md`: opis paska alarmów uzupełniony o przypomnienia o odczytach
  (logika po stronie Apps Script, `apps-script/przypomnienia.js`).

## 0.23.0 — 2026-10-04

### Dodane
- Pasek alarmów nad kartami ekranu startowego: niska bateria i brak pulsu
  telefonu ze zbieraczem temperatur, cisza czujników (brak danych > 3 h)
  — na czerwono; luki do uzupełnienia importem — na żółto. Dane z nowej
  akcji webhooka `alarmy` (wersja wdrożenia 34) — te same reguły co maile
  z `apps-script/luki.js` i `puls.js`. Pusta lista = pasek ukryty.
- Sprawdzanie przy starcie, przy każdym powrocie na ekran startowy
  i przy powrocie aplikacji z tła, nie częściej niż raz na minutę.
  Bez `localStorage` — stary alarm z bufora mógłby pokazywać coś, co już
  minęło; przy braku sieci pasek zostaje taki, jaki był.

## 0.22.2 — 2026-10-01

### Zmienione
- Ekran „Prąd”: kolejność wierszy suma → T1 → T2 (wcześniej T1 → T2 →
  suma). W tej samej kolejności idą wysyłki i podsumowanie na ekranie
  startowym. Zmiana tylko w `POZYCJE_PRADU` (`js/media.js`).

## 0.22.1 — 2026-09-29

### Zmienione
- Wykres doby: piętro ma kolor zielony (`#2e9e5b`) zamiast brązowo-
  pomarańczowego (`#ba7517`). Parter i piętro były dwoma odcieniami tej
  samej barwy, a ich linie leżą zwykle ok. 1°C od siebie, więc zlewały się
  w jedną. Teraz trzy wyraźnie różne barwy: parter pomarańczowy, piętro
  zielone, zewnątrz niebieski (`KOLORY_CZUJNIKOW` w `js/app.js`).

## 0.22.0 — 2026-09-29

### Zmienione
- „Podgląd” podzielony na dwa osobne ekrany z własnymi kartami na ekranie
  startowym: **Odczyty** (ostatnie wpisy liczników) i **Temperatury**
  (średnie dobowe z wykresem doby po stuknięciu dnia). Każdy ekran pobiera
  tylko swoje dane, więc otwiera się szybciej — wcześniej wspólny ekran
  czekał na dwa zapytania naraz. Bufor w `localStorage` i klucze bez zmian
  (`ostatnie_odczyty`, `temperatury_dobowe`), więc dane z poprzedniej
  wersji pojawiają się od razu.
- W `js/app.js` `otworzPodglad` zastąpione przez `otworzOdczyty`
  i `otworzTemperatury`.

### Dodane
- `ikony/termometr.svg` — ikona karty „Temperatury”, w stylu ikon Kotła
  i Odczytów (dopisana do cache w `sw.js`).

## 0.21.0 — 2026-09-29

### Dodane
- Podgląd: stuknięcie dnia w tabeli temperatur rozwija pod nim wykres
  temperatur w ciągu doby (ponowne stuknięcie zwija; otwarty jeden dzień
  naraz). Dane godzinowe z nowej akcji webhooka `temperatury_godzinowe`
  (`temp_godz`, wersja wdrożenia 31–32), pobierane dopiero na żądanie
  i trzymane w pamięci do zamknięcia Podglądu — ponowne rozwinięcie tego
  samego dnia jest natychmiastowe.
- Wykres to czysty SVG rysowany w `js/app.js` (`narysujWykresDoby`), bez
  biblioteki: linia na czujnik (wnętrze ciepłe kolory, zewnątrz niebieski),
  oś godzin 0–24, skala temperatur dobrana do dnia, podpisane minimum
  i maksimum temperatury zewnętrznej. Brakujące godziny przerywają linię
  (bez łączenia ponad luką), a przy niepełnej dobie legenda pokazuje np.
  „20 z 24 godzin”. Zestaw czujników i kolory biorą się z danych — nowy
  czujnik dostanie kolor z zapasu.
- Wiersze dni mają strzałkę rozwijania i działają też z klawiatury
  (Enter / spacja).

## 0.20.1 — 2026-09-29

### Naprawione
- Woda: zdjęcie licznika (z aparatu albo z galerii) nie jest już wysyłane do
  rozpoznania, bo backend nie ma dla wody podpowiedzi OCR — kończyło się to
  zawsze komunikatem „Rozpoznawanie nie powiodło się (Brak podpowiedzi OCR
  dla medium: woda)”. Zdjęcie służy teraz jako podgląd do przepisania
  wartości, tak jak na ekranie prądu. Warunek w `obslozWyborZdjecia`
  (`js/app.js`) korzysta z tej samej listy `MEDIA_Z_OCR` (`js/media.js`) —
  po dopisaniu podpowiedzi dla wody w Apps Script wystarczy dodać ją do listy.

## 0.20.0 — 2026-09-29

### Dodane
- Ekran „Prąd”: T1, T2 i suma na jednym ekranie zamiast trzech osobnych
  kafli. Licznik pokazuje te wartości rotacyjnie, więc można najpierw zrobić
  trzy zdjęcia pod rząd, a dopiero potem przepisać wartości. Każdy wiersz ma
  własne przyciski „Zdjęcie” i „Galeria”, podgląd zdjęcia, pole stanu
  i status wysyłki. Wiersze powstają z `<template>` w `index.html`
  i listy `POZYCJE_PRADU` w `js/media.js`.
- Wspólna data i godzina odczytu dla wszystkich trzech wartości. Ustawia ją
  pierwsze zdjęcie zrobione na ekranie (aparat — chwila zdjęcia; galeria —
  EXIF albo data pliku, z uwagą o źródle), o ile pole nie zostało poprawione
  ręcznie.
- Jeden przycisk „Zapisz wszystkie trzy”: trzy zwykłe żądania `odczyt` po
  kolei, z tym samym `data_godzina` (kontrakt webhooka bez zmian). Odrzucony
  wiersz (np. stan niższy od poprzedniego) zostaje do poprawy z komunikatem,
  zapisane są zamrażane, a przycisk zmienia się na „Zapisz pozostałe” —
  z tą samą datą, bo pole daty blokuje się po pierwszym zapisie. Brak
  odpowiedzi serwera odkłada wiersz do kolejki offline, jak przy
  pojedynczym odczycie.
- `MEDIA_Z_OCR` w `js/media.js` — media, dla których backend ma podpowiedź
  rozpoznawania. Na dziś tylko gaz, więc przycisk „Rozpoznaj” w wierszach
  prądu jest ukryty; zadziała po dopisaniu podpowiedzi dla prądu
  w `apps-script/webhook.js` i dodaniu mediów prądu do tej listy.

### Zmienione
- Ekran startowy: jedna karta „Prąd” zamiast kart „Prąd T1”, „Prąd T2”
  i „Prąd suma”.

## 0.19.2 — 2026-09-28

### Zmienione
- Kolorystyka aplikacji dopasowana do nowej ikony: kolor przewodni
  `#1565c0` (niebieski) zastąpiony jagodowym `#3d4fb0` — nagłówek,
  przyciski główne, wskaźnik trybu kotła, znaczek wczytywania, ikony kart
  (gaz, woda, prąd, kocioł, podgląd), pasek stanu telefonu (`theme-color`
  w `index.html` i `manifest.json`). Tło wciśniętej karty i tło strony
  w chłodniejszym, jagodowym odcieniu.
- Kolory przewodnie zebrane w zmiennych CSS na początku `css/styl.css`
  (`--kolor-glowny`, `--kolor-glowny-jasny`, `--tlo-strony`) — kolejna
  zmiana odcienia to edycja w jednym miejscu (plus `theme-color`
  i ikony SVG, opisane w komentarzu). Kolory obwodów kotła i komunikatów
  bez zmian, bo niosą znaczenie.

## 0.19.1 — 2026-09-28

### Zmienione
- Lifting ikony aplikacji (`ikony/ikona.svg`), żeby pasowała stylistycznie
  do sąsiednich ikon na ekranie telefonu: tło w odcieniu „borówki” (gradient
  `#6b86e0` → `#2f3d94` zamiast `#2f8fe0` → `#0d47a1`), grubsze linie dachu,
  ścian i manometru (34/30/28 zamiast 26/22) i lekko powiększony znak.
  Kształt znaku bez zmian. Znak mieści się w bezpiecznej strefie ikony
  maskowalnej (promień 40% boku). Android podmienia ikonę zainstalowanej
  aplikacji z opóźnieniem — zwykle w ciągu doby albo po ponownym dodaniu
  do ekranu głównego.

## 0.19.0 — 2026-09-28

### Dodane
- Kocioł: pola zbędne przy wybranym trybie są czyszczone i wyszarzane —
  krzywa i przesunięcie bez CO (`cwu`, `off`), temperatura CWU bez CWU
  (`co`, `off`). Tak wygląda też całe archiwum w zakładce `kociol`.
  Wyczyszczona wartość jest pamiętana do zamknięcia ekranu i wraca, gdy
  obwód znów zostanie włączony — przeklikanie trybów niczego nie kasuje.
  Cyrkulacja zostaje zawsze dostępna (w archiwum jest wpisana także przy `off`).

### Zmienione
- Porównanie „brak zmian” (`czyTeSameNastawy`, `js/app.js`) pomija nastawy
  obwodu, który jest wyłączony — wpis z arkusza, który np. przy `cwu` ma
  krzywą, nie wygląda przez to na inny niż formularz.
- Etykiety pól bez dopisku „(puste przy samym CWU)” — to teraz widać
  po wyszarzeniu.

## 0.18.0 — 2026-09-28

### Dodane
- Ekran Kocioł: sekcja „Ostatnie zmiany” pod formularzem. Dwa paski z ostatnich
  12 miesięcy — CO i CWU osobno (kolor = włączone, szare = wyłączone, biała
  kreska = zmiana krzywej / przesunięcia albo temperatury CWU / cyrkulacji),
  z liczbą dni włączenia obok — i pionowa oś 6 ostatnich zmian: data,
  plakietki CO/CWU (wyłączony obwód przekreślony), opis tego, co się zmieniło
  względem poprzedniego wpisu, i jak długo nastawa obowiązywała.
- Dane z nowej akcji webhooka `historia_kotla` (kontrakt:
  `../apps-script/CLAUDE.md`), z buforem w `localStorage` jak Podgląd —
  sekcja od razu pokazuje ostatnio pobraną historię, świeża ją podmienia.

### Zmienione
- `wczytajBlokPodgladu` (`js/app.js`) przyjmuje funkcję sprawdzającą
  aktualność zamiast numeru generacji — korzystają z niej teraz Podgląd
  i Kocioł, każdy ze swoim licznikiem.

## 0.17.2 — 2026-09-23

### Naprawione
- Mylący komunikat „Kolejka offline: odrzucono 1 — wpisz ponownie ręcznie”
  przy odczycie, który w rzeczywistości był już w arkuszu. Scenariusz:
  pierwsza wysyłka doszła i webhook zapisał wiersz, ale odpowiedź nie wróciła
  do telefonu (przejściowy błąd HTTP przekierowania Apps Script albo utrata
  zasięgu w trakcie). Aplikacja uznała to za brak połączenia i odłożyła
  odczyt do kolejki, a ponowna wysyłka trafiła na własny wiersz i została
  odrzucona jako „data nie jest późniejsza”. Teraz przy odrzuceniu wpisu
  z kolejki `js/app.js` sprawdza przez `ostatnie_odczyty`, czy odczyt o tym
  samym medium, dacie i stanie już jest w arkuszu — jeśli tak, pokazuje
  „był już w arkuszu… Nic nie trzeba robić”. Kontrakt webhooka bez zmian.
- Gdy sprawdzenie się nie uda (znów brak sieci), wpis zostaje w kolejce
  zamiast od razu trafiać do „wpisz ponownie ręcznie”.
- Komunikat po nieudanej wysyłce mówi „Nie udało się potwierdzić zapisu
  (brak połączenia / brak odpowiedzi serwera)” zamiast zawsze „Brak
  połączenia” — błąd serwera to nie to samo co brak internetu, a zapis mógł
  już dojść.
- Kocioł: zmiana nastaw z kolejki offline mogła po cichu dopisać drugi,
  identyczny wiersz w `kociol` — webhook `zmiana_kotla` niczego nie odrzuca,
  więc ponowna wysyłka zmiany, która już doszła, nie dawała błędu. Teraz
  kolejka PRZED wysłaniem pyta `ostatni_kociol`; jeśli ostatni wpis ma tę samą
  datę obowiązywania i te same nastawy, wpis jest pomijany z komunikatem
  „był już w arkuszu”. Przy błędzie webhooka zmiana jest wysyłana mimo
  wszystko (duplikat to mniejsze zło niż zgubiona zmiana nastaw). Porównanie
  nastaw wydzielone do `czyTeSameNastawy`, wspólnej z formularzem kotła.

## 0.17.1 — 2026-09-22

### Naprawione
- Aplikacja nie przechodziła na nową wersję mimo wdrożenia. Dwie przyczyny:
  1) Zainstalowana PWA zwykle tylko wraca z tła, bez przeładowania strony,
     więc przeglądarka prawie nigdy nie sprawdzała, czy na serwerze jest nowy
     `sw.js`. Teraz przy każdym powrocie z tła `js/app.js` wywołuje
     `registration.update()`, a gdy nowy service worker przejmie stronę
     (`controllerchange`), strona sama się przeładowuje — ale tylko na ekranie
     startowym i nie w chwili, gdy widać komunikat o zapisanym odczycie, żeby
     nie zgubić wpisywanych danych. Na innym ekranie przeładowanie czeka do
     najbliższego powrotu z tła na ekran startowy.
  2) Instalacja nowej wersji w `sw.js` pobierała pliki przez pamięć HTTP
     przeglądarki, a GitHub Pages pozwala ją trzymać 10 minut
     (`max-age=600`) — nowy cache mógł dostać stare pliki. Teraz pliki są
     pobierane z pominięciem tej pamięci (`cache: 'reload'`).
- Poprawka zadziała od następnej aktualizacji: na tę jedną wersję telefon
  trzeba jeszcze raz przełączyć ręcznie (zamknąć aplikację i otworzyć ponownie).

## 0.17.0 — 2026-09-22

### Zmienione
- Ekran startowy: media nie są już kwadratowymi kafelkami w siatce 2x2, tylko
  kartami na pełną szerokość, tak jak Kocioł i Podgląd (ikona z lewej, tytuł
  i krótki opis z jednostką). Wszystkie karty mają wspólną klasę `karta`
  w `css/styl.css`; Kocioł i Podgląd oddziela od mediów większy odstęp.
- Karty mediów są wybierane w `js/app.js` po atrybucie `data-medium`,
  a nie po klasie.

## 0.16.2 — 2026-09-22

### Zmienione
- Podgląd pokazuje 20 ostatnich odczytów i 20 ostatnich dni temperatur
  (wcześniej po 30). Liczba ustawiana jedną stałą `ILE_POZYCJI_PODGLADU`
  w `js/app.js`.

## 0.16.1 — 2026-09-20

### Zmienione
- Rozpoznawanie odczytu ze zdjęcia nie blokuje już pola „Stan licznika” ani
  przycisku zatwierdzania: można od razu wpisać wartość z podglądu zdjęcia
  (placeholder: „Rozpoznaję… (możesz wpisać ręcznie)”). Jeśli ktoś zdążył coś
  wpisać, spóźniony wynik modelu niczego nie nadpisuje i nie pokazuje
  komunikatów. Wcześniej pole było zablokowane do końca rozpoznawania, które
  przy przeciążonym modelu trwało nawet kilkadziesiąt sekund.
- Błąd usługi rozpoznawania (przeciążenie, limit) ma własny komunikat:
  „Rozpoznawanie nie powiodło się (…) — wpisz wartość ręcznie”, zamiast
  mylącego „Model nie jest pewny odczytu”.
- Placeholder pola stanu jest czyszczony przy każdym otwarciu ekranu
  potwierdzenia, więc po przerwanym rozpoznawaniu nie „przechodzi” na kolejne
  otwarcie.
- Po stronie webhooka (bez zmiany kontraktu): szybszy tryb „myślenia” modelu,
  ponawianie i model zapasowy — patrz `apps-script/CLAUDE.md`.

## 0.16.0 — 2026-09-20

### Dodane
- Zdjęcie wybrane z galerii wypełnia pole „Data i godzina odczytu” momentem
  jego zrobienia, a nie czasem telefonu (BACKLOG pkt 3). Źródła po kolei:
  1) EXIF (`DateTimeOriginal`, zapasowo `DateTimeDigitized`) — nowy
  `js/exif.js`, minimalny czytnik JPEG bez bibliotek, czytany z oryginalnego
  pliku PRZED zmniejszeniem (przerysowanie przez canvas gubi metadane);
  2) data modyfikacji pliku — przybliżona; 3) brak daty — zostaje czas
  telefonu. Pole zawsze pozostaje edytowalne.
- Pod polem daty pojawia się informacja, skąd wzięła się godzina: neutralna
  dla EXIF („sprawdź, czy się zgadza”), pomarańczowe ostrzeżenie dla daty
  pliku i braku daty. Przy zdjęciu z aparatu aplikacji i wpisie ręcznym
  uwagi nie ma — godzina to tam po prostu zegar telefonu.

### Zmienione
- Daty EXIF sprzed 2000, z „przelanym” miesiącem/dniem (np. `0000:00:00`) albo
  z przyszłości są odrzucane jak brak daty — rozładowany zegar aparatu daje
  gorszą wartość niż żadna.
- EXIF nie ma strefy czasowej; datę traktujemy jako czas lokalny, zgodnie
  z konwencją webhooka (Europe/Warsaw).

## 0.15.0 — 2026-09-18

### Dodane
- `js/bufor.js` — bufor odpowiedzi webhooka w `localStorage` dla ekranu
  „Podgląd”, wzorzec „pokaż stare, odśwież w tle”: po otwarciu ekranu
  ostatnie odczyty i temperatury pojawiają się od razu z poprzedniego
  pobrania (status „Z pamięci (5 min temu) — odświeżam…”), a świeża
  odpowiedź podmienia widok, gdy dojdzie. Gdy odświeżenie się nie uda,
  zostają dane z pamięci z czerwonym ostrzeżeniem, zamiast pustego ekranu.
- Ekran „Kocioł”: nastawy pobierane są z wyprzedzeniem — przy starcie
  aplikacji, przy każdym powrocie na ekran startowy i przy powrocie
  aplikacji z tła (najwyżej raz na minutę). Po dotknięciu kafelka formularz
  wypełnia się od razu, bez blokady pól i czekania; jeśli pobieranie jeszcze
  trwa, ekran dołącza do niego (jedno żądanie zamiast dwóch).

### Zmienione
- Nastawy kotła trzymane są wyłącznie w pamięci i tylko do 5 minut, nigdy
  w `localStorage` — nieaktualna podpowiedź mogłaby skłonić do zapisania
  złej zmiany (patrz historia wersji 0.11.2).
- Bufor Podglądu i nastawy kotła są unieważniane po własnych zapisach
  (odczyt, zmiana nastaw, wpisy wysłane z kolejki offline) oraz po zmianie
  adresu webhooka lub tokenu. Zmiana nastaw zapisana offline staje się od
  razu punktem odniesienia, żeby nie dało się jej wysłać drugi raz.
- Motywacja i pomiary: BACKLOG pkt 12 (webhook ma podłogę ok. 1,2–1,6 s
  na wywołanie, poza kodem serwera).

## 0.14.0 — 2026-09-18

### Dodane
- Ekran „Podgląd”: każdy z dwóch bloków (ostatnie odczyty, temperatury
  dobowe) ma pod nagłówkiem własny wiersz statusu — „Wczytywanie…” ze
  znaczkiem w trakcie odpytywania webhooka, „Wczytano w X,X s” po sukcesie
  i czerwony komunikat błędu tylko przy tym bloku, który zawiódł. Wcześniej
  ekran w trakcie oczekiwania był po prostu pusty.
- Czas odpowiedzi każdego zapytania jest mierzony i pokazywany w wierszu
  statusu — dane do decyzji o buforowaniu wolnych zapytań (BACKLOG pkt 12).

### Zmienione
- Oba zapytania ekranu Podgląd startują jednocześnie, a nie jedno po drugim
  (są niezależne), więc czas oczekiwania to dłuższe z nich, nie ich suma.
- Wspólny komunikat błędu na dole ekranu zastąpiony statusem osobnym
  dla każdego bloku.

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
