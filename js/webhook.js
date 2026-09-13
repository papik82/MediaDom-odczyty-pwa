// Komunikacja z webhookiem Apps Script. Kolejka offline (zapisywanie
// nieudanych wysyłek do wysłania później) dojdzie w kolejnym kroku —
// na razie każdy błąd sieci po prostu wraca do wywołującego kodu.

import { odczytajUstawienia } from './ustawienia.js';

// Content-Type "text/plain" zamiast "application/json" jest celowy: Apps
// Script Web App nie obsługuje zapytań OPTIONS (preflight), więc przeglądarka
// nie może wysłać zwykłego JSON-a przez fetch. "text/plain" nie wymaga
// preflightu, a Apps Script i tak parsuje treść jako JSON po swojej stronie.
export async function wyslijOdczyt(odczyt) {
  const ustawienia = odczytajUstawienia();
  if (!ustawienia) {
    throw new Error('Brak zapisanych ustawień webhooka.');
  }

  const odpowiedz = await fetch(ustawienia.adresWebhooka, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: ustawienia.token,
      akcja: 'odczyt',
      ...odczyt,
    }),
  });

  if (!odpowiedz.ok) {
    throw new Error(`Serwer odpowiedział błędem HTTP ${odpowiedz.status}.`);
  }

  return odpowiedz.json();
}
