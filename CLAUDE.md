# CLAUDE.md — odczyty-pwa (aplikacja mobilna)

Warstwa frontu projektu MediaDom. Kontekst całości: `../CLAUDE.md`.
**Kontrakt webhooka jest opisany w `../apps-script/CLAUDE.md` — to źródło
prawdy.** Tutaj tylko to, co dotyczy aplikacji.

> **To jedyny katalog w projekcie z repozytorium git, i jest ono publiczne.**
> Nie umieszczaj tu tokenu, adresu webhooka, kluczy API ani danych z arkusza.

---

## Co aplikacja robi

PWA do zapisywania odczytów liczników. Działa na telefonie, hostowana na
GitHub Pages, zapisuje dane do Arkusza Google przez webhook Apps Script.

**Pięć mediów, każde niezależne.** Ekran startowy ma trzy karty mediów
(pełna szerokość, ten sam wygląd co karty Kocioł, Odczyty i Temperatury — klasa `karta`):

| karta | kod medium | częstotliwość |
|---|---|---|
| Gaz | `gaz` | codziennie w sezonie grzewczym |
| Woda | `woda` | raz w miesiącu |
| Prąd | `prad_t1`, `prad_t2`, `prad_suma` | raz w miesiącu |

Taryfy prądu i suma to osobne media, nie warianty jednego — dzięki temu każde
ma własny poprzedni stan i własną kontrolę chronologii.

**Ekran prądu** (od 0.20.0) zbiera wszystkie trzy na raz, bo licznik pokazuje
je rotacyjnie: najpierw trzy zdjęcia pod rząd, potem przepisanie. Wiersz na
medium (szablon `<template id="szablon-wiersza-pradu">`, lista
`POZYCJE_PRADU` w `js/media.js`) ma własne zdjęcie / galerię, pole stanu
i status. **Data i godzina są wspólne** — ustawia je pierwsze zdjęcie na
ekranie, chyba że pole poprawiono ręcznie. Zapis: jeden przycisk, trzy
zwykłe żądania `odczyt` po kolei, z tym samym `data_godzina` (kontrakt bez
zmian). Odrzucony wiersz zostaje do poprawy, zapisane są zamrażane, pole
daty blokuje się po pierwszym zapisie, więc „Zapisz pozostałe” idzie z tą
samą datą. Brak odpowiedzi → kolejka offline, jak przy pojedynczym odczycie.
Przycisk „Rozpoznaj” pokazuje się tylko dla mediów z `MEDIA_Z_OCR`
(`js/media.js`, na dziś sam gaz — backend nie ma podpowiedzi OCR dla prądu).

**Trzy ścieżki wprowadzania dla wszystkich mediów:** zrób zdjęcie, wybierz
z galerii, wpisz ręcznie. Mechanizm jest generyczny — moduł aparatu i lista
`MEDIA_ZE_ZDJECIEM` w `js/media.js` przyjmują `medium` jako parametr, więc
dołożenie kolejnego medium to dopisanie wpisu, nie przebudowa.

**Rozpoznawanie zdjęcia (OCR)** obsługuje Apps Script przez akcję
`odczytaj_foto`. Aplikacja wysyła obraz, dostaje propozycję wartości i wstawia
ją do pola — **nigdy nie zapisuje automatycznie**. Przy `pasuje: false` albo
`pewnosc: "niska"` pole zostaje puste i pokazuje się komunikat z prośbą
o powtórzenie zdjęcia. Zapis to zawsze osobne, świadome żądanie użytkownika.

**Data i godzina odczytu.** Odczyt nie zawsze wypada o 17:30. Ekran
potwierdzenia pokazuje bieżącą datę i godzinę z zegara telefonu, wypełnioną
automatycznie, z możliwością ręcznej korekty przed wysłaniem. Dla zdjęcia
wybranego z galerii wpisywany jest moment jego zrobienia (EXIF → data pliku →
czas telefonu, `js/exif.js`), z widoczną informacją o źródle godziny. Wysyłamy ten
znacznik, a nie czas serwera — ΔT liczy się dokładnie między momentami
odczytów, więc godzina musi być prawdziwa.

**Karta kotła** (nie medium, osobno pod kartami mediów) — formularz zmiany nastaw. Ostatnie
nastawy (`ostatni_kociol`) pobiera **z wyprzedzeniem** — przy starcie, powrocie
na ekran startowy i powrocie z tła — trzyma je tylko w pamięci (do 5 min)
i wypełnia nimi pola od razu po wejściu; nigdy z `localStorage`, bo
nieaktualna podpowiedź mogłaby dać zapis złej zmiany.
Pola zbędne przy wybranym trybie są czyszczone i blokowane (od 0.19.0):
krzywa i przesunięcie bez CO, temperatura CWU bez CWU; cyrkulacja zawsze
dostępna. Wyczyszczona wartość wraca po ponownym włączeniu obwodu (do
zamknięcia ekranu).
Wysyła **tylko wtedy, gdy coś faktycznie się zmieniło** — porównanie robi
aplikacja po stronie klienta, nie webhook. Gdy punktu odniesienia brak
(pusta zakładka albo brak zasięgu), wysyłka nie jest blokowana.

**Pod formularzem kotła — „Ostatnie zmiany”** (od 0.18.0), tylko do odczytu,
z akcji `historia_kotla`, przez bufor w `localStorage` jak Odczyty i Temperatury (bezpieczne,
bo niczego nie wpisuje do formularza). Dwa paski z ostatnich 12 miesięcy —
CO i CWU osobno, włączone / wyłączone, kreska = zmiana nastawy obwodu bez
zmiany wł./wył. — i pionowa oś 6 ostatnich zmian z opisem tego, co się
zmieniło względem poprzedniego wpisu. Cztery tryby rozkładamy na dwa obwody
tylko do wyświetlenia (`OBWODY_TRYBU` w `js/nastawy.js`); w arkuszu dalej jest
jeden tryb.

Cyrkulacja to lista przedziałów czasu w dobie, sklejana w jeden tekst.
Kilka przedziałów sklejamy **średnikiem** (`4:30 - 9:00; 18:00 - 22:00`), jak
w archiwum; odczyt przyjmuje też przecinek (od 1.1.1, `../dokumentacja/decyzje.md` D5).

**Karty „Odczyty” i „Temperatury”** (nie media; od 0.22.0 dwa osobne ekrany,
wcześniej jeden wspólny „Podgląd”) — tylko do odczytu, żeby sprawdzić
z telefonu, co poszło do arkusza. „Odczyty” pokazuje ostatnie wpisy
z `odczyty` (akcja `ostatnie_odczyty`), „Temperatury” — średnie dobowe
z `temp_doba` (akcja `temperatury_dobowe`). Każdy ekran pobiera tylko swoje
dane, z buforem w `localStorage` (`js/bufor.js`) — ekran od razu pokazuje
poprzednie dane, świeże je podmieniają — i ma własny wiersz statusu
(wczytywanie / czas wczytania / błąd).

**Pasek alarmów** (od 0.23.0) nad kartami ekranu startowego — akcja
`alarmy` (bateria i puls telefonu, cisza czujników, luki do importu,
od wersji wdrożenia 35 także przypomnienia o odczytach: gaz po 3 / 10 dniach
w sezonie / poza nim, prąd i woda od 1. dnia miesiąca; od 37 — kończący się
zapas wierszy z formułami w arkuszu;
reguły w `../apps-script/CLAUDE.md`). Sprawdzany przy starcie, powrocie na
start i z tła (raz na minutę), tylko w pamięci, bez `localStorage`; pusta
lista = pasek ukryty. Powiadomień systemowych (Web Push, ntfy) na razie
nie ma — decyzja 2026-10-04: najpierw sam pasek.

**Karta „Zbieracz”** (od 1.1.0) — stan zbierania temperatur na telefonie,
akcja `stan_zbieracza`, bufor w `localStorage` jak Odczyty i Temperatury.
Werdykt (działa / uwagi / problem / nieznany) liczy **webhook**, tymi samymi
regułami co pasek alarmów — PWA go tylko wyświetla, nie liczy własnych
progów. Pod nim alarmy, telefon (puls, bateria, kolejka, wersja), ostatnia
godzina czujników, luki i ważność tokenów eWeLink (`renderujStanZbieracza`
w `js/ekrany/zbieracz.js`). Wiek pulsu („37 min temu”) liczy telefon od znacznika czasu,
żeby był prawdziwy także dla stanu z bufora. Od 1.4.0 pod Sonoffami bateria
i sygnał Zigbee (`opiszStanCzujnika`; `PROG_BATERII_CZUJNIKA` = 20 — ta sama
wartość co w `apps-script/luki.js`).

**Karta „Faktura”** (od 1.3.0) — import faktury za gaz z PDF: plik
(base64) → `odczytaj_fakture` (Gemini proponuje, nic nie zapisuje) →
formularz → `zapisz_fakture`. Zasada jak przy zdjęciu licznika: **model
podpowiada, zapis tylko po zatwierdzeniu**. Kontrole na ekranie
(`przeliczKontroleFaktury`): ciągłość z ostatnią fakturą z arkusza
(`poprzednia` z odpowiedzi odczytu) i brutto z pól liczone jak formuły
zakładki (`bruttoOkresu`: kWh `ROUND(…,0)`, składniki do groszy) vs kwota
z faktury — tolerancja 5 gr. Tylko ostrzeżenia, zapis zostaje możliwy
(wymiana gazomierza celowo łamie ciągłość odczytów). VAT w formularzu
w procentach, wysyłany jako ułamek. **Bez kolejki offline** — webhook
rozpoznaje powtórny numer faktury (`duplikat: true`), więc ponowienie po
braku odpowiedzi jest bezpieczne. PDF nigdzie nie jest zapisywany.

**Karta „Pomysły”** (od 1.2.0) — notatnik pomysłów rozwojowych: hasło
i opcjonalny obszar idą akcją `zapisz_pomysl` do zakładki `pomysly`
(kontrakt w `../apps-script/CLAUDE.md`), a Claude przenosi je do backlogu
(`../narzedzia/pomysly.py`). Zapis jak odczyty: od razu, bez odpowiedzi —
do wspólnej kolejki offline. **`id` nadaje telefon** (`nowyIdPomyslu`)
przed pierwszą próbą i zostaje ten sam w kolejce, a webhook rozpoznaje
powtórkę po `id` — dlatego pomysły nie potrzebują sprawdzania „czy już
jest w arkuszu” jak odczyty i kocioł. Lista 10 ostatnich (`lista_pomyslow`)
przez bufor; pomysły z kolejki dorysowane na górze jako „czeka na
wysłanie” (`renderujPomysly`, pamięć `ostatniePomysly`).

**Wykres doby** (od 0.21.0, ekran Temperatury): stuknięcie dnia w tabeli
rozwija pod nim wykres godzinowy z akcji `temperatury_godzinowe`, pobieranej
dopiero na żądanie i trzymanej w pamięci do zamknięcia ekranu (nie w `localStorage`).
Czysty SVG bez biblioteki (`narysujWykresDoby` w `js/ekrany/wykres-doby.js`); luka w danych
przerywa linię, nic nie jest łączone ani uzupełniane.

Nazwy i liczba czujników **nie są zaszyte na sztywno** — kolumny tabeli
(i linie wykresu doby) powstają z tego, co przyjdzie w odpowiedzi. Zestaw czujników zmieniał się
w czasie i będzie się zmieniał dalej.

---

## Bezpieczeństwo — rzecz najważniejsza

**W repozytorium NIE MOŻE być tokenu ani adresu webhooka.** GitHub Pages
serwuje pliki publicznie, więc wszystko w kodzie frontu jest jawne.

Przy pierwszym uruchomieniu aplikacja pokazuje ekran ustawień, prosi o adres
webhooka i token, zapisuje je w `localStorage` i więcej nie pyta. Ekran
ustawień zostaje dostępny później do zmiany tych wartości.

Klucz API modelu wizyjnego siedzi wyłącznie we właściwościach skryptu Apps
Script i nigdy nie opuszcza serwerów Google.

---

## Sprzęt, pod który projektujemy

Gazomierz **Intergaz IGAZ BK-G4**. Wyświetlacz LCD budzony niebieskim
przyciskiem, gaśnie samoczynnie. Wskazanie w m3 z **trzema miejscami
po przecinku**.

Licznik jest bateryjny, a producent zakłada rząd 180 minut łącznej pracy
wyświetlacza rocznie — **odczyt ma być szybki**, aplikacja nie może wymagać
długiego celowania.

Wyświetlacz jest odblaskowy, bez podświetlenia, często pod szybką.
**Flesz go prześwietla** — wymuś wyłączony.

---

## Konwencje techniczne

- **Czysty JavaScript, bez frameworków i bez kroku budowania.** GitHub Pages
  serwuje pliki statyczne, a ja uczę się na tym kodzie.
- Jeden plik HTML, jeden CSS, JavaScript w modułach ES.
- Aparat przez `<input type="file" accept="image/*" capture="environment">`;
  wybór z galerii to ten sam input bez atrybutu `capture`.
- Zdjęcie zmniejszane w przeglądarce do ok. 1000 px dłuższego boku
  i kompresowane do JPEG jakości 0,8 przed wysyłką — inaczej base64 urośnie
  do kilku megabajtów i Apps Script się na tym wywróci.
- Interfejs po polsku, przyciski duże, obsługa jedną ręką.
- Nieudane wysyłki lądują w kolejce w `localStorage` (FIFO, wspólna dla
  odczytów i kotła) i idą przy starcie aplikacji oraz na zdarzenie `online`.

---

## Struktura katalogów

```
odczyty-pwa/
├── index.html
├── manifest.json
├── sw.js                  service worker, cache aplikacji (cache-first, całościowo)
├── css/
│   └── styl.css
├── js/
│   ├── app.js             start i zdarzenia globalne: wersja, „home”, kolejka
│   │                      offline na starcie, powrót z tła, service worker
│   ├── nawigacja.js       pokazEkran (wszystkie `.ekran`), komunikat startu,
│   │                      haki: powrót na start, zmiana ustawień
│   ├── wspolne.js         pomocniki: element, daty, ustawStatusBloku,
│   │                      wczytajBlokPodgladu (bufor „stare, potem świeże”)
│   ├── nastawy.js         czyste funkcje: tryby/obwody kotła, porównanie
│   │                      nastaw, cyrkulacja (tekst <-> przedziały)
│   ├── kolejka-wysylka.js wysyłka kolejki offline + licznik na ekranie startu
│   ├── ekrany/            po jednym module na ekran (każdy ma własne DOM
│   │   │                  i licznik generacji):
│   │   ├── odczyt.js      wybór metody + potwierdzenie (gaz, woda), OCR
│   │   ├── prad.js        ekran Prąd (T1, T2, suma)
│   │   ├── kociol.js      formularz kotła, nastawy z wyprzedzeniem
│   │   ├── kociol-historia.js  paski CO/CWU i oś zmian
│   │   ├── podglad.js     karty Odczyty i Temperatury
│   │   ├── wykres-doby.js wykres godzinowy doby (SVG)
│   │   ├── zbieracz.js    karta Zbieracz
│   │   ├── pomysly.js     notatnik pomysłów
│   │   ├── faktura.js     import faktury z PDF
│   │   ├── ustawienia.js  adres i token, poUstawieniach
│   │   └── alarmy.js      pasek alarmów na ekranie startowym
│   ├── ustawienia.js      adres webhooka i token w localStorage
│   ├── media.js           metadane mediów (nazwa, jednostka, zdjęcie: tak/nie,
│   │                      OCR: tak/nie, pozycje ekranu prądu)
│   ├── webhook.js         komunikacja z Apps Script (odczyt, OCR, kocioł, podgląd,
│   │                      temperatury godzinowe do wykresu doby, alarmy,
│   │                      stan zbieracza, pomysły)
│   ├── aparat.js          zdjęcie: aparat/galeria, zmniejszanie, base64
│   ├── exif.js            data zrobienia zdjęcia z EXIF (JPEG), bez bibliotek
│   ├── kolejka.js         kolejka offline w localStorage
│   ├── bufor.js           bufor odpowiedzi Odczytów, Temperatur, Zbieracza, Pomysłów i historii kotła
│   └── wersja.js          numer wersji aplikacji (stopka ekranu startowego)
├── ikony/                 SVG w jednym stylu (ikona aplikacji + ikony UI)
├── CHANGELOG.md           historia wydań aplikacji
└── CLAUDE.md
```

---

## Plan pracy

Wydane zmiany trafiają do [CHANGELOG.md](CHANGELOG.md) — zostaje tutaj,
bo dotyczy wersji tej aplikacji.

Backlog jest **wspólny dla całego projektu** i leży w
`../dokumentacja/BACKLOG.md`, bo część pozycji dotyczy Apps Script i arkusza,
nie frontu. Nie duplikuj go tutaj.

---

## Wydanie zmiany (zasada potwierdzona przez właściciela 2026-10-07)

Po każdej zmianie kodu aplikacji, w tej kolejności:
1. test w przeglądarce na szerokości telefonu (niżej),
2. podbić wersję w `js/wersja.js` i `WERSJA_CACHE` w `sw.js`; nowy plik
   (np. ikona, moduł ekranu) dopisać do `PLIKI_POWLOKI` w `sw.js` — brakujący plik
   wywraca instalację service workera,
3. wpis w `CHANGELOG.md`, aktualizacja `../dokumentacja/BACKLOG.md`
   i tego pliku, jeśli zmienia się opis ekranów,
4. `git status` — `sekrety.local.json` nie może być w poczekalni,
5. **commit i push bez pytania o zgodę**, potem krótka relacja. Commity po
   polsku, krótkie, „dlaczego” zamiast „co”.

GitHub Pages publikuje zwykle w minutę–dwie, ale wdrożenie potrafi wisieć
kilkanaście minut (2026-10-07). Telefon bierze nową wersję po zamknięciu
i ponownym otwarciu aplikacji (czasem dwa razy).

## Testy w przeglądarce

Serwer podglądu `pwa` z `../.claude/launch.json` (port 8080). Dwa sposoby
na webhook:
- **Podstawiony `fetch`** (najprościej): każdy test na **nowym pochodzeniu**
  `http://127.0.0.X:8080/` (pamięć HTTP przeglądarki trzyma stare pliki
  dla starego adresu), wyrejestrować service workera, w `localStorage`
  `odczyty_adres_webhooka` = `http://localhost:9/atrapa` i `odczyty_token`,
  potem `window.fetch` zwracający przygotowaną odpowiedź dla danej `akcja`.
- **Atrapa webhooka** `mock-webhook` (port 8081, `../.claude/mock_webhook.py`):
  odpowiada jak Apps Script, z regulowanym opóźnieniem i błędami
  (`GET /ustaw?opoznienie=3000&tryb=cwu&blad=1&ocr_blad=1`); adres
  `http://127.0.0.1:8081/exec`. Do testów wyścigów i opóźnień.

Szerokość 375 px. Plik z EXIF składa się ręcznie (segment APP1) i „wybiera”
przez podmianę `HTMLInputElement.prototype.click`. Rejestracja service
workera w panelu podglądu nie działa — zamiast tego sprawdzić, czy każdy
plik z `PLIKI_POWLOKI` odpowiada 200. Na końcu: `localStorage.clear()`,
przywrócić rozmiar okna.

## Zasady pracy

- Nie dodawaj bibliotek bez pytania.
- **Nie zmieniaj kontraktu webhooka** — korzystają z niego inne skrypty.
  Zmiana kontraktu to zawsze decyzja podejmowana w `apps-script/`, nie tutaj.
- Gdy coś w moim pomyśle jest błędne albo się nie uda, powiedz wprost.
- Testuj na szerokości ekranu telefonu, nie na desktopie.
- Komentarze po polsku, wyjaśniające co i dlaczego.
