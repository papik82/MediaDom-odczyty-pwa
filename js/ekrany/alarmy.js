// Pasek alarmów na ekranie startowym (od 0.23.0). Szczegóły niżej.

import { pobierzAlarmy } from '../webhook.js';
import { czyUstawieniaZapisane } from '../ustawienia.js';
import { element, MIN_ODSTEP_POBRANIA_MS } from '../wspolne.js';
import { naPowrotNaStart } from '../nawigacja.js';

// ---------------------------------------------------------------------------
// Pasek alarmów na ekranie startowym (od 0.23.0). Akcja webhooka `alarmy`
// zwraca to, co dziś przychodzi mailem: niską baterię i brak pulsu telefonu,
// ciszę czujników i luki do uzupełnienia importem. Sprawdzamy przy starcie,
// przy każdym powrocie na ekran startowy i przy powrocie aplikacji z tła —
// nie częściej niż raz na minutę (ten sam powód co przy nastawach kotła).
//
// Nic nie trafia do localStorage: stary alarm z bufora mógłby straszyć
// czymś, co już minęło. Gdy sprawdzenie się nie uda (offline), pasek
// zostaje taki, jaki był — nie dokładamy alarmu „brak połączenia”, bo
// o tym mówi już kolejka offline.
// ---------------------------------------------------------------------------
const pasekAlarmow = document.getElementById('pasek-alarmow');
let czasOstatniegoSprawdzeniaAlarmow = 0;
let sprawdzanieAlarmowWToku = false;

function odswiezAlarmy() {
  if (!czyUstawieniaZapisane()) return;
  if (sprawdzanieAlarmowWToku) return;
  if (Date.now() - czasOstatniegoSprawdzeniaAlarmow < MIN_ODSTEP_POBRANIA_MS) return;
  sprawdzanieAlarmowWToku = true;
  czasOstatniegoSprawdzeniaAlarmow = Date.now();
  pobierzAlarmy()
    .then((wynik) => { if (wynik.ok) renderujAlarmy(wynik.alarmy || []); })
    .catch((blad) => console.error('Sprawdzenie alarmów nie powiodło się:', blad))
    .finally(() => { sprawdzanieAlarmowWToku = false; });
}

function renderujAlarmy(alarmy) {
  pasekAlarmow.innerHTML = '';
  pasekAlarmow.classList.toggle('ukryty', alarmy.length === 0);
  // Najpierw to, co dzieje się teraz („alarm”), potem rzeczy do zrobienia
  // przy okazji („uwaga”).
  const kolejnosc = { alarm: 0, uwaga: 1 };
  [...alarmy]
    .sort((a, b) => (kolejnosc[a.poziom] ?? 2) - (kolejnosc[b.poziom] ?? 2))
    .forEach((a) => {
      const wiersz = element('p', `pasek-alarmow__pozycja pasek-alarmow__pozycja--${a.poziom === 'alarm' ? 'alarm' : 'uwaga'}`);
      wiersz.appendChild(element('span', 'pasek-alarmow__znak', a.poziom === 'alarm' ? '⚠' : 'ℹ'));
      wiersz.appendChild(element('span', 'pasek-alarmow__tekst', a.tekst));
      pasekAlarmow.appendChild(wiersz);
    });
}

naPowrotNaStart(odswiezAlarmy);
