# CLAUDE.md — aplikacja do odczytów mediów

Plik kontekstu dla Claude Code. Umieść w katalogu głównym repozytorium PWA.

---

## Kontekst

Buduję aplikację webową (PWA) do zapisywania odczytów liczników w domu
jednorodzinnym. Działa na telefonie, hostowana na GitHub Pages, zapisuje dane
do Arkusza Google przez webhook Apps Script.

Uczę się programowania przy tym projekcie. **Komentarze w kodzie pisz po polsku**
i wyjaśniaj, co dany fragment robi i dlaczego tak, a nie inaczej. Przy zmianach
wskazuj plik i funkcję zamiast przepisywać całość.

Windows 10, PHPStorm, Claude Code w PowerShell.

---

## Co aplikacja ma robić

**Pięć mediów, każde niezależne.** Ekran startowy ma pięć kafelków:

| kafelek | kod medium | częstotliwość | wprowadzanie |
|---|---|---|---|
| Gaz | `gaz` | codziennie w sezonie grzewczym | zdjęcie, galeria lub ręcznie |
| Prąd T1 | `prad_t1` | raz w miesiącu | zdjęcie, galeria lub ręcznie |
| Prąd T2 | `prad_t2` | raz w miesiącu | zdjęcie, galeria lub ręcznie |
| Prąd suma | `prad_suma` | raz w miesiącu | zdjęcie, galeria lub ręcznie |
| Woda | `woda` | raz w miesiącu | zdjęcie, galeria lub ręcznie |

Taryfy prądu (i suma) to osobne media, nie warianty jednego — dzięki temu
każde ma własny poprzedni stan, własną kontrolę chronologii i nie wymaga
prowadzenia użytkownika przez kilka ujęć pod rząd.

**Zdjęcie dla wszystkich mediów.** Zaczęło się od samego gazu, potem
rozszerzone na resztę (2026-09-14) — mechanizm jest generyczny: moduł
aparatu i lista mediów obsługujących zdjęcie (`MEDIA_ZE_ZDJECIEM` w
`js/media.js`) przyjmują `medium` jako parametr/wpis, więc rozszerzenie nie
wymagało przebudowy, tylko dopisania do listy. Ekran wyboru metody ma trzy
opcje: zrób zdjęcie, wybierz z galerii, wpisz ręcznie. Model wizyjny (OCR)
na razie nie istnieje — niezależnie od tego, jak zdjęcie powstało, wartość
zawsze wpisuje się ręcznie, patrząc na podgląd. Podpowiedzi dla modelu
w Apps Script (patrz niżej) są na dziś wypełnione tylko dla gazu — dołożenie
ich dla wody i prądu to osobna sprawa, niezależna od tego, że PWA już
pozwala zrobić im zdjęcie.

**Data i godzina odczytu.** Odczyt nie zawsze wypada o 17:30. Ekran
potwierdzenia pokazuje bieżącą datę i godzinę wypełnioną automatycznie,
z możliwością ręcznej korekty przed wysłaniem. Wysyłamy ten znacznik,
a nie czas serwera — ΔT liczy się dokładnie między momentami odczytów,
więc godzina musi być prawdziwa.

---

## Architektura

```
telefon (PWA na GitHub Pages)
    |  JSON przez HTTPS, token w treści żądania
    v
Apps Script (webhook)  -->  Arkusz Google "Media dom"
    |
    +-->  model wizyjny (klucz API we właściwościach skryptu)
```

Backend **już istnieje i działa**. Odczyty i OCR są gotowe; dziennik zmian
kotła (`zmiana_kotla` / `ostatni_kociol`, patrz niżej) to akcje do dopisania.

### Istniejąca akcja zapisu

```json
{ "token": "...", "akcja": "odczyt",
  "medium": "gaz",
  "stan": 91.234,
  "data_godzina": "2026-09-15T17:34:00",
  "metoda": "foto",
  "foto_url": "",
  "uwagi": "" }
```

Pole `foto_url` zostaje w kontrakcie, ale aplikacja wysyła je puste —
zdjęć na razie nie przechowujemy.

`data_godzina` to czas lokalny bez strefy — Apps Script interpretuje go
w strefie Europe/Warsaw, tak samo jak dane z importów. Pole jest wymagane;
gdy go zabraknie, webhook użyje czasu serwera.

`medium` przyjmuje: `gaz`, `prad_t1`, `prad_t2`, `prad_suma`, `woda`.
`metoda` przyjmuje: `foto`, `reczny`.

Odpowiedź: `{ ok, wiersz, poprzedni_stan, przyrost }` albo
`{ ok: false, blad, wymaga_potwierdzenia }`, gdy stan jest niższy od poprzedniego.

### Akcja do dopisania

```json
{ "token": "...", "akcja": "odczytaj_foto",
  "medium": "gaz",
  "obraz": "<base64 JPEG>" }
```

Zwraca:

```json
{ "ok": true,
  "pasuje": true,
  "stan": 91.234,
  "pewnosc": "wysoka",
  "problem": null }
```

`pasuje` — czy zdjęcie przedstawia licznik zgodny z podanym `medium` i czy
widać pełne wskazanie. `pewnosc`: `wysoka` / `srednia` / `niska`.
`problem` — opis po polsku, gdy coś jest nie tak; inaczej `null`.

Aplikacja odrzuca wynik i prosi o powtórzenie zdjęcia, gdy `pasuje` jest `false`
albo `pewnosc` wynosi `niska`.

**Model wizyjny: Gemini.** Klucz API z Google AI Studio, przechowywany
we właściwościach skryptu Apps Script pod nazwą `KLUCZ_GEMINI`. Wywołanie
przez `UrlFetchApp` po stronie Apps Script — klucz nigdy nie trafia do telefonu.
Nazwę aktualnego modelu wizyjnego sprawdź w dokumentacji Gemini, bo wersje
się zmieniają.

**Podpowiedzi dla modelu trzymaj w Apps Script, w słowniku kluczowanym medium.**
Na dziś wypełniony jest tylko `gaz`; pozostałe wpisy dodamy, gdy dojdzie
zdjęcie dla wody i prądu.

- **gaz** — wyświetlacz LCD, segmenty, m3 z trzema miejscami po przecinku;
  sprawdź obecność symbolu m3 i czy ekran nie jest wygaszony
- *(woda — bębenki mechaniczne, czerwone cyfry to części dziesiętne — później)*
- *(prąd — wyświetlacz cyfrowy, kWh — później)*

Model ma zwracać wyłącznie JSON, bez komentarza i bez znaczników bloku kodu.

**Ta akcja niczego nie zapisuje.** Zapis to osobne żądanie `odczyt`, wysyłane
dopiero po potwierdzeniu przez użytkownika. Rozdzielenie jest celowe: model
wizyjny bywa niepewny, licznik ma trzy miejsca po przecinku, a pomyłka na
ostatniej cyfrze psuje analizy.

### Dziennik zmian kotła — dwie akcje do dopisania (2026-09-14)

Kocioł to nie medium do okresowego odczytu, tylko dziennik zmian nastaw —
osobna karta w PWA (nie kafelek wśród mediów), zapisuje do osobnej zakładki
arkusza `kociol`. Wpis powstaje tylko wtedy, gdy coś faktycznie się zmieniło
względem ostatnio zapisanych nastaw — kontrolę robi PWA po stronie klienta
(porównanie z tym, co zwróci `ostatni_kociol`), nie webhook.

Zapis:

```json
{ "token": "...", "akcja": "zmiana_kotla",
  "tryb": "cwu_co",
  "krzywa_grzewcza": 1.2,
  "przesuniecie": -3,
  "temp_cwu": 48,
  "cyrkulacja": "06:00-08:00, 18:30-22:00",
  "obowiazuje_od": "2026-09-14T11:27:00" }
```

`tryb` przyjmuje: `off`, `cwu`, `co`, `cwu_co`.
`cyrkulacja` — zero, jeden albo kilka przedziałów czasu w dobie, sklejone
w jeden tekst: `"HH:MM-HH:MM, HH:MM-HH:MM"` (pusty string, gdy brak
przedziałów). To jedna kolumna w arkuszu, nie osobna zakładka.
`obowiazuje_od` — jak w odczytach: czas lokalny bez strefy, Europe/Warsaw.

Odpowiedź: `{ ok: true, wiersz, zapisano }`.

Odczyt ostatnich nastaw (do podpowiedzi w formularzu):

```json
{ "token": "...", "akcja": "ostatni_kociol" }
```

Odpowiedź, gdy zakładka `kociol` ma już jakiś wiersz:

```json
{ "ok": true, "brak": false,
  "obowiazuje_od": "2026-09-10T18:00:00",
  "tryb": "co", "krzywa_grzewcza": 1.4, "przesuniecie": -2,
  "temp_cwu": 45, "cyrkulacja": "07:00-09:00, 19:00-21:00" }
```

Gdy zakładka jest pusta: `{ "ok": true, "brak": true }`. PWA wtedy nie ma
punktu odniesienia i nie blokuje wysyłki (nie ma z czym porównać) — dotyczy
też sytuacji offline, gdy tego zapytania w ogóle nie udało się wykonać.

**Zakładka `kociol` musi istnieć w arkuszu, z wierszem nagłówka** (tak samo
jak `odczyty`) i kolumnami w tej kolejności: `obowiazuje_od`, `tryb`,
`krzywa_grzewcza`, `przesuniecie`, `temp_cwu`, `cyrkulacja`.

---

## Bezpieczeństwo — rzecz najważniejsza

**W repozytorium NIE MOŻE być tokenu ani adresu webhooka.** GitHub Pages serwuje
pliki publicznie, więc wszystko w kodzie frontu jest jawne.

Przy pierwszym uruchomieniu aplikacja pokazuje ekran ustawień, prosi o adres
webhooka i token, zapisuje je w `localStorage` i więcej nie pyta. Ekran ustawień
ma być dostępny później do zmiany tych wartości.

Klucz API modelu wizyjnego siedzi wyłącznie we właściwościach skryptu Apps Script
i nigdy nie opuszcza serwerów Google.

---

## Sprzęt

Gazomierz **Intergaz IGAZ BK-G4**. Wyświetlacz LCD budzony niebieskim przyciskiem,
gaśnie samoczynnie. Wskazanie w m3 z **trzema miejscami po przecinku**.

Licznik jest bateryjny, a producent zakłada rząd 180 minut łącznej pracy
wyświetlacza rocznie — odczyt ma być szybki, aplikacja nie może wymagać
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
- Zdjęcie zmniejszane w przeglądarce do ok. 1000 px dłuższego boku i kompresowane
  do JPEG jakości 0,8 przed wysyłką — inaczej base64 urośnie do kilku megabajtów
  i Apps Script się na tym wywróci.
- Interfejs po polsku, przyciski duże, obsługa jedną ręką.
- Nieudane wysyłki lądują w kolejce w `localStorage` i idą przy następnym
  uruchomieniu z zasięgiem.

---

## Struktura katalogów

```
/
├── index.html
├── manifest.json
├── sw.js                  service worker, cache aplikacji (cache-first, całościowo)
├── css/
│   └── styl.css
├── js/
│   ├── app.js             sterowanie wszystkimi ekranami
│   ├── ustawienia.js      adres webhooka i token w localStorage
│   ├── media.js           metadane mediów (nazwa, jednostka, zdjęcie: tak/nie)
│   ├── webhook.js         komunikacja z Apps Script (odczyt, OCR, kocioł)
│   ├── aparat.js          zdjęcie: aparat/galeria, zmniejszanie, base64
│   └── kolejka.js         kolejka offline w localStorage (odczyty i kocioł)
├── ikony/                 SVG w jednym stylu (ikona aplikacji + ikony UI)
└── CLAUDE.md
```

---

## Plan pracy i backlog

Kolejność wdrażania, co już zrobione i otwarte pomysły/decyzje na przyszłość
są w [BACKLOG.md](BACKLOG.md) — jedno miejsce, nie duplikuj tego tutaj.
Wydane zmiany trafiają do [CHANGELOG.md](CHANGELOG.md).

---

## Zasady pracy

- Nie dodawaj bibliotek bez pytania.
- Nie zmieniaj kontraktu webhooka — korzystają z niego inne skrypty.
- Gdy coś w moim pomyśle jest błędne albo się nie uda, powiedz wprost.
- Testuj na szerokości ekranu telefonu, nie na desktopie.
