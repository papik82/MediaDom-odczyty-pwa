// Pasek alarmów na ekranie startowym (od 0.23.0). Alarmy przychodzą w tej samej
// odpowiedzi co reszta pulpitu (akcja `pulpit`, lista jak w akcji `alarmy`) —
// rysuje je moduł pulpitu przez renderujAlarmy. „alarm” (coś dzieje się teraz:
// bateria, puls, cisza czujników) na czerwono, „uwaga” (luki do importu,
// przypomnienia o odczytach) na żółto.

import { element } from '../wspolne.js';

const pasekAlarmow = document.getElementById('pasek-alarmow');

export function renderujAlarmy(alarmy) {
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
