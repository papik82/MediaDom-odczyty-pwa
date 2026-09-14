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
