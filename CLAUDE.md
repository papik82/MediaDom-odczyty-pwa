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

**Cztery media, każde niezależne.** Ekran startowy ma cztery kafelki:

| kafelek | kod medium | częstotliwość | wprowadzanie |
|---|---|---|---|
| Gaz | `gaz` | codziennie w sezonie grzewczym | **zdjęcie** lub ręcznie |
| Prąd T1 | `prad_t1` | raz w miesiącu | ręcznie |
| Prąd T2 | `prad_t2` | raz w miesiącu | ręcznie |
| Woda | `woda` | raz w miesiącu | ręcznie |

Taryfy prądu to osobne media, nie warianty jednego — dzięki temu każde ma
własny poprzedni stan, własną kontrolę chronologii i nie wymaga prowadzenia
użytkownika przez dwa ujęcia pod rząd.

**Zdjęcie na razie tylko dla gazu.** Pozostałe media wprowadzasz ręcznie.
Ale moduł aparatu i wywołanie modelu wizyjnego mają przyjmować `medium`
jako parametr, a lista mediów obsługujących zdjęcie ma być jedną stałą
w konfiguracji. Dołożenie wodomierza ma wtedy oznaczać dopisanie podpowiedzi
dla modelu i jednego wpisu na liście — bez przebudowy.

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

Backend **już istnieje i działa**. Trzeba dołożyć jedną akcję, reszta gotowa.

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

`medium` przyjmuje: `gaz`, `prad_t1`, `prad_t2`, `woda`.
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
- Aparat przez `<input type="file" accept="image/*" capture="environment">`.
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
├── sw.js                  service worker, cache aplikacji
├── css/
│   └── styl.css
├── js/
│   ├── app.js             sterowanie ekranami
│   ├── ustawienia.js      adres webhooka i token w localStorage
│   ├── webhook.js         komunikacja z Apps Script, kolejka offline
│   ├── aparat.js          zdjęcie, zmniejszanie, kompresja
│   └── walidacja.js       kontrola sensowności odczytu
├── ikony/
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
