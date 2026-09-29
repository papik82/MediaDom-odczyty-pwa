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
tylko do wyświetlenia (`OBWODY_TRYBU` w `js/app.js`); w arkuszu dalej jest
jeden tryb.

Cyrkulacja to lista przedziałów czasu w dobie, sklejana w jeden tekst.
**Format sklejania — patrz `../apps-script/CLAUDE.md`, jest tam otwarta
rozbieżność z archiwum. Nie zmieniaj go bez ustalenia.**

**Karty „Odczyty” i „Temperatury”** (nie media; od 0.22.0 dwa osobne ekrany,
wcześniej jeden wspólny „Podgląd”) — tylko do odczytu, żeby sprawdzić
z telefonu, co poszło do arkusza. „Odczyty” pokazuje ostatnie wpisy
z `odczyty` (akcja `ostatnie_odczyty`), „Temperatury” — średnie dobowe
z `temp_doba` (akcja `temperatury_dobowe`). Każdy ekran pobiera tylko swoje
dane, z buforem w `localStorage` (`js/bufor.js`) — ekran od razu pokazuje
poprzednie dane, świeże je podmieniają — i ma własny wiersz statusu
(wczytywanie / czas wczytania / błąd).

**Wykres doby** (od 0.21.0, ekran Temperatury): stuknięcie dnia w tabeli
rozwija pod nim wykres godzinowy z akcji `temperatury_godzinowe`, pobieranej
dopiero na żądanie i trzymanej w pamięci do zamknięcia ekranu (nie w `localStorage`).
Czysty SVG bez biblioteki (`narysujWykresDoby` w `js/app.js`); luka w danych
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
│   ├── app.js             sterowanie wszystkimi ekranami (w tym karta kotła
│   │                      i karta podglądu — nie mają osobnych plików)
│   ├── ustawienia.js      adres webhooka i token w localStorage
│   ├── media.js           metadane mediów (nazwa, jednostka, zdjęcie: tak/nie,
│   │                      OCR: tak/nie, pozycje ekranu prądu)
│   ├── webhook.js         komunikacja z Apps Script (odczyt, OCR, kocioł, podgląd,
│   │                      temperatury godzinowe do wykresu doby)
│   ├── aparat.js          zdjęcie: aparat/galeria, zmniejszanie, base64
│   ├── exif.js            data zrobienia zdjęcia z EXIF (JPEG), bez bibliotek
│   ├── kolejka.js         kolejka offline w localStorage
│   ├── bufor.js           bufor odpowiedzi Odczytów, Temperatur i historii kotła
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

## Zasady pracy

- Nie dodawaj bibliotek bez pytania.
- **Nie zmieniaj kontraktu webhooka** — korzystają z niego inne skrypty.
  Zmiana kontraktu to zawsze decyzja podejmowana w `apps-script/`, nie tutaj.
- Gdy coś w moim pomyśle jest błędne albo się nie uda, powiedz wprost.
- Testuj na szerokości ekranu telefonu, nie na desktopie.
- Komentarze po polsku, wyjaśniające co i dlaczego.
