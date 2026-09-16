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

**Pięć mediów, każde niezależne.** Ekran startowy ma pięć kafelków:

| kafelek | kod medium | częstotliwość |
|---|---|---|
| Gaz | `gaz` | codziennie w sezonie grzewczym |
| Prąd T1 | `prad_t1` | raz w miesiącu |
| Prąd T2 | `prad_t2` | raz w miesiącu |
| Prąd suma | `prad_suma` | raz w miesiącu |
| Woda | `woda` | raz w miesiącu |

Taryfy prądu i suma to osobne media, nie warianty jednego — dzięki temu każde
ma własny poprzedni stan, własną kontrolę chronologii i nie wymaga prowadzenia
użytkownika przez kilka ujęć pod rząd.

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
automatycznie, z możliwością ręcznej korekty przed wysłaniem. Wysyłamy ten
znacznik, a nie czas serwera — ΔT liczy się dokładnie między momentami
odczytów, więc godzina musi być prawdziwa.

**Karta kotła** (nie kafelek wśród mediów) — formularz zmiany nastaw. Przy
wejściu pobiera ostatnie nastawy przez `ostatni_kociol` i nimi wypełnia pola.
Wysyła **tylko wtedy, gdy coś faktycznie się zmieniło** — porównanie robi
aplikacja po stronie klienta, nie webhook. Gdy punktu odniesienia brak
(pusta zakładka albo brak zasięgu), wysyłka nie jest blokowana.

Cyrkulacja to lista przedziałów czasu w dobie, sklejana w jeden tekst.
**Format sklejania — patrz `../apps-script/CLAUDE.md`, jest tam otwarta
rozbieżność z archiwum. Nie zmieniaj go bez ustalenia.**

**Karta podglądu** (nie kafelek) — tylko do odczytu. Pokazuje ostatnie wpisy
z `odczyty` i temperatury dobowe z `temp_doba`, żeby sprawdzić z telefonu, co
poszło do arkusza. Dwie niezależne akcje: gdy jedna zawiedzie, druga i tak się
wyświetla, a błąd pokazuje się tylko dla swojej części ekranu.

Nazwy i liczba czujników **nie są zaszyte na sztywno** — kolumny tabeli
powstają z tego, co przyjdzie w odpowiedzi. Zestaw czujników zmieniał się
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
│   ├── app.js             sterowanie wszystkimi ekranami
│   ├── ustawienia.js      adres webhooka i token w localStorage
│   ├── media.js           metadane mediów (nazwa, jednostka, zdjęcie: tak/nie)
│   ├── webhook.js         komunikacja z Apps Script (odczyt, OCR, kocioł, podgląd)
│   ├── aparat.js          zdjęcie: aparat/galeria, zmniejszanie, base64
│   ├── kolejka.js         kolejka offline w localStorage
│   ├── kociol.js          formularz nastaw kotła
│   └── podglad.js         karta podglądu danych z arkusza
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
