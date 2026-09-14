// Komunikacja z webhookiem Apps Script. Kolejka offline (zapisywanie
// nieudanych wysyłek do wysłania później) dojdzie w kolejnym kroku —
// na razie każdy błąd sieci po prostu wraca do wywołującego kodu.

import { odczytajUstawienia } from './ustawienia.js';

// Content-Type "text/plain" zamiast "application/json" jest celowy: Apps
// Script Web App nie obsługuje zapytań OPTIONS (preflight), więc przeglądarka
// nie może wysłać zwykłego JSON-a przez fetch. "text/plain" nie wymaga
// preflightu, a Apps Script i tak parsuje treść jako JSON po swojej stronie.
async function wyslijDoWebhooka(cialoBezTokenu) {
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
  return wyslijDoWebhooka({ akcja: 'odczyt', ...odczyt });
}

// Rozpoznanie wskazania licznika ze zdjęcia przez model wizyjny (Gemini,
// po stronie Apps Script — klucz API nigdy nie trafia do przeglądarki).
// Ta akcja niczego nie zapisuje do arkusza; zapis to osobne wywołanie
// wyslijOdczyt, dopiero po potwierdzeniu wartości przez użytkownika.
export function rozpoznajZdjecie(medium, obrazBase64) {
  return wyslijDoWebhooka({ akcja: 'odczytaj_foto', medium, obraz: obrazBase64 });
}
