// Komunikacja z webhookiem Apps Script.

import { odczytajUstawienia } from './ustawienia.js';

// Content-Type "text/plain" zamiast "application/json" jest celowy: Apps
// Script Web App nie obsługuje zapytań OPTIONS (preflight), więc przeglądarka
// nie może wysłać zwykłego JSON-a przez fetch. "text/plain" nie wymaga
// preflightu, a Apps Script i tak parsuje treść jako JSON po swojej stronie.
//
// Eksportowana (nie tylko wewnętrzna) — kolejka offline w js/kolejka.js
// przechowuje gotowe "ciała" żądań (z polem akcja) i wysyła je tą samą
// drogą co świeże żądania, więc logika wysyłki jest tylko w jednym miejscu.
export async function wyslij(cialoBezTokenu) {
  const ustawienia = odczytajUstawienia();
  if (!ustawienia) {
    throw new Error('Brak zapisanych ustawień webhooka.');
  }

  const odpowiedz = await fetch(ustawienia.adresWebhooka, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: ustawienia.token,
      ...cialoBezTokenu,
    }),
  });

  if (!odpowiedz.ok) {
    throw new Error(`Serwer odpowiedział błędem HTTP ${odpowiedz.status}.`);
  }

  return odpowiedz.json();
}

export function wyslijOdczyt(odczyt) {
  return wyslij({ akcja: 'odczyt', ...odczyt });
}

// Rozpoznanie wskazania licznika ze zdjęcia przez model wizyjny (Gemini,
// po stronie Apps Script — klucz API nigdy nie trafia do przeglądarki).
// Ta akcja niczego nie zapisuje do arkusza; zapis to osobne wywołanie
// wyslijOdczyt, dopiero po potwierdzeniu wartości przez użytkownika.
export function rozpoznajZdjecie(medium, obrazBase64) {
  return wyslij({ akcja: 'odczytaj_foto', medium, obraz: obrazBase64 });
}

// Zapis zmiany nastaw kotła — osobny dziennik zmian, nie okresowy odczyt.
export function zapiszKociol(dane) {
  return wyslij({ akcja: 'zmiana_kotla', ...dane });
}

// Ostatnio zapisane nastawy kotła — do podpowiedzi w formularzu, żeby
// zmieniać tylko to jedno pole, które faktycznie się zmieniło.
export function pobierzOstatnieNastawyKotla() {
  return wyslij({ akcja: 'ostatni_kociol' });
}

// Historia zmian nastaw — sekcja „Ostatnie zmiany” pod formularzem kotła.
// `dni` wyznacza okno pasków CO/CWU, `ile` — minimalną liczbę wpisów na osi.
// Tylko do odczytu, więc (inaczej niż ostatni_kociol) może iść przez bufor.
export function pobierzHistorieKotla(dni = 365, ile = 6) {
  return wyslij({ akcja: 'historia_kotla', dni, ile });
}

// Ekran podglądu (punkt 6 backlogu) — tylko do odczytu, dwa niezależne
// zapytania zamiast jednego łączonego: każde ma swój, prosty kontrakt,
// tak jak reszta akcji w tym pliku.
export function pobierzOstatnieOdczyty(ile = 30) {
  return wyslij({ akcja: 'ostatnie_odczyty', ile });
}

export function pobierzTemperaturyDobowe(dni = 30) {
  return wyslij({ akcja: 'temperatury_dobowe', dni });
}

// Średnie godzinowe jednej doby (data "RRRR-MM-DD") — do wykresu, który
// rozwija się po stuknięciu dnia w tabeli temperatur (od 0.21.0).
// Pobierane dopiero na żądanie, nie razem z całym Podglądem.
export function pobierzTemperaturyGodzinowe(data) {
  return wyslij({ akcja: 'temperatury_godzinowe', data });
}

// Bieżące alarmy zbierania temperatur (bateria i puls telefonu, cisza
// czujników, luki do importu) — do paska na ekranie startowym (od 0.23.0).
export function pobierzAlarmy() {
  return wyslij({ akcja: 'alarmy' });
}

// Cały stan pulpitu ekranu startowego w jednym żądaniu (od 1.6.0): kocioł,
// zbieracz, temperatury z ΔT, terminy odczytów i alarmy. Zastępuje na starcie
// osobne `alarmy`; `stan_zbieracza` zostaje dla karty „Zbieracz”.
export function pobierzPulpit() {
  return wyslij({ akcja: 'pulpit' });
}

// Stan zbieracza temperatur na telefonie (karta „Zbieracz”, od 1.1.0):
// werdykt, puls i bateria, ostatnie godziny czujników, luki, eWeLink.
export function pobierzStanZbieracza() {
  return wyslij({ akcja: 'stan_zbieracza' });
}

// Notatnik pomysłów (karta „Pomysły”, od 1.2.0). Zapis idzie przez kolejkę
// offline jak odczyty — `id` nadaje telefon, więc ponowna wysyłka tego
// samego pomysłu nie tworzy duplikatu (webhook odpowiada duplikat: true).
export function zapiszPomysl(pomysl) {
  return wyslij({ akcja: 'zapisz_pomysl', ...pomysl });
}

// Faktura za gaz z PDF (od 1.3.0). odczytaj — Gemini proponuje wiersze,
// niczego nie zapisuje; zapisz — zatwierdzone wiersze do zakładki `faktury`
// (ten sam numer drugi raz → duplikat: true, bez zapisu).
export function odczytajFakture(pdfBase64) {
  return wyslij({ akcja: 'odczytaj_fakture', pdf: pdfBase64 });
}

export function zapiszFakture(faktura) {
  return wyslij({ akcja: 'zapisz_fakture', ...faktura });
}

export function pobierzPomysly(ile = 10) {
  return wyslij({ akcja: 'lista_pomyslow', status: 'wszystkie', ile });
}
