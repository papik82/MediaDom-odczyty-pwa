// Karta „Pomysły” — notatnik pomysłów rozwojowych (zakładka `pomysly`).

import { zapiszPomysl, pobierzPomysly } from '../webhook.js';
import { dodajDoKolejki, pobierzKolejke } from '../kolejka.js';
import { aktualizujKomunikatKolejki } from '../kolejka-wysylka.js';
import { wyczyscBuforKlucz } from '../bufor.js';
import {
  element, formatujDataGodzinePodgladu, sformatujDataGodzinaLokalnie, wczytajBlokPodgladu,
} from '../wspolne.js';
import { pokazEkran, ekranStart, ukryjKomunikatStart } from '../nawigacja.js';
import { poUstawieniach } from './ustawienia.js';

const ekranPomysly = document.getElementById('ekran-pomysly');
const przyciskPomysly = document.getElementById('przycisk-pomysly');
const przyciskZamknijPomysly = document.getElementById('przycisk-zamknij-pomysly');
const formularzPomyslu = document.getElementById('formularz-pomyslu');
const polePomysl = document.getElementById('pole-pomysl');
const poleObszarPomyslu = document.getElementById('pole-obszar-pomyslu');
const przyciskZapiszPomysl = document.getElementById('przycisk-zapisz-pomysl');
const komunikatPomyslu = document.getElementById('komunikat-pomyslu');
const statusPomyslow = document.getElementById('status-pomyslow');
const listaPomyslow = document.getElementById('lista-pomyslow');

// --- Notatnik pomysłów (BACKLOG pkt 5, od 1.2.0) ---
//
// Hasło zapisane tutaj trafia do zakładki `pomysly` (akcja zapisz_pomysl),
// skąd Claude na żądanie przenosi je do backlogu i oznacza status. Zapis
// idzie jak odczyty: od razu, a bez odpowiedzi — do kolejki offline.
// `id` nadajemy tutaj, przed pierwszą próbą, i zostaje ten sam w kolejce —
// webhook rozpoznaje powtórkę po id, więc pomysł, który doszedł bez
// potwierdzenia, nie zapisze się drugi raz.

const ILE_POMYSLOW_NA_LISCIE = 10;
const OBSZARY_POMYSLOW = { pwa: 'PWA', arkusz: 'arkusz', analiza: 'analiza', telefon: 'telefon', inne: 'inne' };
const STATUSY_POMYSLOW = { nowy: 'nowy', przeniesiony: 'w backlogu', odrzucony: 'odrzucony' };
let generacjaPomyslow = 0;
// Ostatnio pobrana lista z arkusza (null = jeszcze nic). Pozwala dorysować
// pomysły z kolejki od razu, bez czekania na webhook — także bez zasięgu.
let ostatniePomysly = null;

function nowyIdPomyslu() {
  // crypto.randomUUID działa tylko w bezpiecznym kontekście (HTTPS, localhost) —
  // na GitHub Pages jest; zapas na wszelki wypadek: czas + losowy ogon.
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function wierszPomyslu(tresc, data, obszar, status, statusTekst) {
  const wiersz = element('div', 'pomysl');
  wiersz.appendChild(element('p', 'pomysl__tresc', tresc));
  const opis = element('div', 'pomysl__opis');
  opis.appendChild(element('span', `pomysl__status pomysl__status--${status}`, statusTekst));
  if (data) opis.appendChild(element('span', '', formatujDataGodzinePodgladu(data)));
  if (obszar) opis.appendChild(element('span', '', OBSZARY_POMYSLOW[obszar] || obszar));
  wiersz.appendChild(opis);
  return wiersz;
}

// Lista: najpierw pomysły czekające w kolejce offline (arkusz ich jeszcze nie
// zna, a bez tego zapisany bez zasięgu pomysł „znikałby”), potem te z arkusza.
function renderujPomysly(pomysly) {
  if (pomysly) ostatniePomysly = pomysly;
  listaPomyslow.innerHTML = '';
  const wKolejce = pobierzKolejke().filter((w) => w.akcja === 'zapisz_pomysl');
  wKolejce.slice().reverse().forEach((p) => {
    listaPomyslow.appendChild(wierszPomyslu(p.tresc, p.data, p.obszar, 'kolejka', 'czeka na wysłanie'));
  });
  const idWKolejce = new Set(wKolejce.map((p) => p.id));
  (ostatniePomysly || []).filter((p) => !idWKolejce.has(p.id)).forEach((p) => {
    let statusTekst = STATUSY_POMYSLOW[p.status] || p.status;
    if (p.status === 'przeniesiony' && p.punkt_backlogu) statusTekst = `backlog pkt ${p.punkt_backlogu}`;
    const wiersz = wierszPomyslu(p.tresc, p.data, p.obszar, STATUSY_POMYSLOW[p.status] ? p.status : 'nowy', statusTekst);
    if (p.uwagi) wiersz.appendChild(element('p', 'pomysl__opis', p.uwagi));
    listaPomyslow.appendChild(wiersz);
  });
  // „Pusto” tylko gdy wiemy to z arkusza — w trakcie pierwszego wczytywania
  // (ostatniePomysly === null) lista zostaje pusta, a status mówi „Wczytywanie…”.
  if (!listaPomyslow.firstChild && ostatniePomysly) {
    listaPomyslow.appendChild(element('p', 'komunikat-pusto', 'Jeszcze nie ma pomysłów.'));
  }
}

function wczytajPomysly() {
  generacjaPomyslow++;
  const generacja = generacjaPomyslow;
  wczytajBlokPodgladu(() => generacja === generacjaPomyslow, {
    status: statusPomyslow,
    klucz: 'pomysly',
    pobierz: () => pobierzPomysly(ILE_POMYSLOW_NA_LISCIE),
    renderuj: (wynik) => renderujPomysly(wynik.pomysly),
  });
}

function otworzPomysly() {
  ukryjKomunikatStart();
  komunikatPomyslu.classList.add('ukryty');
  polePomysl.value = '';
  poleObszarPomyslu.value = '';
  renderujPomysly(null);   // od razu to, co czeka w kolejce (bufor dorysuje resztę)
  pokazEkran(ekranPomysly);
  wczytajPomysly();
  polePomysl.focus();
}

// rodzaj: 'blad' (czerwony), 'sukces' (zielony), 'kolejka' (żółty) — te same
// klasy co komunikaty odczytów na ekranie startowym.
function pokazKomunikatPomyslu(tekst, rodzaj = 'blad') {
  komunikatPomyslu.className = rodzaj === 'sukces' ? 'komunikat-sukces' : rodzaj === 'kolejka' ? 'komunikat-kolejka' : 'komunikat';
  komunikatPomyslu.textContent = tekst;
}

formularzPomyslu.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const tresc = polePomysl.value.trim();
  if (!tresc) {
    pokazKomunikatPomyslu('Wpisz kilka słów.');
    return;
  }
  const pomysl = {
    id: nowyIdPomyslu(),
    data: `${sformatujDataGodzinaLokalnie(new Date())}:00`,
    obszar: poleObszarPomyslu.value,
    tresc,
  };

  przyciskZapiszPomysl.disabled = true;
  przyciskZapiszPomysl.textContent = 'Wysyłanie…';
  try {
    const odpowiedz = await zapiszPomysl(pomysl);
    if (!odpowiedz.ok) {
      pokazKomunikatPomyslu(odpowiedz.blad || 'Webhook odrzucił pomysł.');
      return;
    }
    pokazKomunikatPomyslu('Zapisano pomysł.', 'sukces');
  } catch (blad) {
    // Brak odpowiedzi — do kolejki offline z tym samym id (patrz wyżej).
    console.error('Nie udało się wysłać pomysłu, dokładam do kolejki offline:', blad);
    dodajDoKolejki({ akcja: 'zapisz_pomysl', ...pomysl });
    aktualizujKomunikatKolejki();
    pokazKomunikatPomyslu('Pomysł zapisany w telefonie — brak odpowiedzi serwera, pójdzie sam, gdy wróci internet.', 'kolejka');
  } finally {
    przyciskZapiszPomysl.disabled = false;
    przyciskZapiszPomysl.textContent = 'Zapisz pomysł';
  }
  polePomysl.value = '';
  poleObszarPomyslu.value = '';
  renderujPomysly(null);   // pomysł z kolejki widać od razu, nawet gdy odświeżenie się nie uda
  wyczyscBuforKlucz('pomysly');
  wczytajPomysly();
});

przyciskPomysly.addEventListener('click', poUstawieniach(otworzPomysly));
przyciskZamknijPomysly.addEventListener('click', () => pokazEkran(ekranStart));
