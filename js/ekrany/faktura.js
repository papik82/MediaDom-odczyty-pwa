// Karta „Faktura” — import faktury za gaz z PDF (Gemini podpowiada, zapis po
// zatwierdzeniu).

import { odczytajFakture, zapiszFakture } from '../webhook.js';
import { element, ustawStatusBloku } from '../wspolne.js';
import { pokazEkran, ekranStart, pokazKomunikatStart, ukryjKomunikatStart } from '../nawigacja.js';
import { poUstawieniach } from './ustawienia.js';

const ekranFaktura = document.getElementById('ekran-faktura');
const przyciskFaktura = document.getElementById('przycisk-faktura');
const przyciskPdfFaktury = document.getElementById('przycisk-pdf-faktury');
const przyciskFakturaRecznie = document.getElementById('przycisk-faktura-recznie');
const plikFaktury = document.getElementById('plik-faktury');
const statusFaktury = document.getElementById('status-faktury');
const formularzFaktury = document.getElementById('formularz-faktury');
const ciagloscFaktury = document.getElementById('ciaglosc-faktury');
const poleNrFaktury = document.getElementById('pole-nr-faktury');
const poleBruttoFaktury = document.getElementById('pole-brutto-faktury');
const okresyFaktury = document.getElementById('okresy-faktury');
const przyciskDodajOkres = document.getElementById('przycisk-dodaj-okres');
const kontrolaFaktury = document.getElementById('kontrola-faktury');
const przyciskZapiszFakture = document.getElementById('przycisk-zapisz-fakture');
const komunikatFaktury = document.getElementById('komunikat-faktury');
const przyciskZamknijFakture = document.getElementById('przycisk-zamknij-fakture');
const szablonOkresuFaktury = document.getElementById('szablon-okresu-faktury');

// --- Faktura za gaz z PDF (od 1.3.0) ---
//
// PDF → akcja odczytaj_fakture (Gemini proponuje wiersze, nic nie zapisuje)
// → formularz do sprawdzenia → zapisz_fakture. Jak przy zdjęciu licznika:
// model tylko podpowiada, zapis zawsze po świadomym zatwierdzeniu.
// Dwie kontrole na ekranie, bo pomyłka modelu w jednej cyfrze psuje koszty:
//  - ciągłość z ostatnią fakturą w arkuszu (data i odczyt początkowy),
//  - brutto wyliczone z pól (jak formuły zakładki `faktury`) vs kwota z faktury.
// Bez kolejki offline: ten sam numer drugi raz webhook odrzuca jako duplikat,
// więc ponowienie po braku odpowiedzi jest bezpieczne — robi to sam Paweł.

const MAKS_ROZMIAR_PDF = 8 * 1024 * 1024;   // Apps Script i Gemini przyjmą więcej, ale base64 rośnie o 1/3
const MAKS_OKRESOW_FAKTURY = 4;
let generacjaFaktury = 0;
// Ostatnia faktura z arkusza i zapas wierszy z formułami — z odpowiedzi
// odczytaj_fakture (przy wpisie ręcznym brak, wtedy ciągłości nie sprawdzamy).
let stanArkuszaFaktur = null;

function plikDoBase64(plik) {
  return new Promise((rozwiaz, odrzuc) => {
    const czytnik = new FileReader();
    czytnik.onload = () => rozwiaz(String(czytnik.result).split(',')[1]);
    czytnik.onerror = () => odrzuc(czytnik.error);
    czytnik.readAsDataURL(plik);
  });
}

// Liczba w polu: przecinek i kropka jako separator (polska klawiatura).
function liczbaZPola(pole) {
  const tekst = String(pole.value).trim().replace(',', '.');
  if (tekst === '') return null;
  const liczba = Number(tekst);
  return Number.isFinite(liczba) ? liczba : null;
}

function dodajOkresFaktury(okres = {}) {
  const fragment = szablonOkresuFaktury.content.cloneNode(true);
  const blok = fragment.querySelector('.faktura__okres');
  blok.querySelectorAll('[data-pole]').forEach((pole) => {
    const wartosc = okres[pole.dataset.pole];
    if (wartosc === null || wartosc === undefined) return;
    // VAT przychodzi jako ułamek (0.23), w formularzu jest w procentach.
    pole.value = 'procent' in pole.dataset ? Math.round(wartosc * 10000) / 100 : wartosc;
  });
  blok.querySelector('.faktura__usun').addEventListener('click', () => {
    blok.remove();
    ponumerujOkresy();
    przeliczKontroleFaktury();
  });
  blok.addEventListener('input', przeliczKontroleFaktury);
  okresyFaktury.appendChild(blok);
  ponumerujOkresy();
}

function ponumerujOkresy() {
  const bloki = [...okresyFaktury.querySelectorAll('.faktura__okres')];
  bloki.forEach((b, i) => {
    b.querySelector('.faktura__nr').textContent = bloki.length > 1 ? `${i + 1} z ${bloki.length}` : '';
    b.querySelector('.faktura__usun').classList.toggle('ukryty', bloki.length === 1);
  });
  przyciskDodajOkres.classList.toggle('ukryty', bloki.length >= MAKS_OKRESOW_FAKTURY);
}

function odczytajOkresy() {
  return [...okresyFaktury.querySelectorAll('.faktura__okres')].map((blok) => {
    const okres = {};
    blok.querySelectorAll('[data-pole]').forEach((pole) => {
      const nazwa = pole.dataset.pole;
      if (pole.type === 'date' || nazwa === 'uwagi') {
        okres[nazwa] = pole.value.trim() || null;
      } else {
        const v = liczbaZPola(pole);
        okres[nazwa] = v === null ? null : ('procent' in pole.dataset ? Math.round(v * 100) / 10000 : v);
      }
    });
    return okres;
  });
}

// Brutto okresu dokładnie jak formuły zakładki `faktury`: kWh zaokrąglone
// do całości, składniki netto do groszy, brutto okresu do groszy.
function bruttoOkresu(o) {
  const pola = ['odczyt_od', 'odczyt_do', 'wsp_konwersji', 'cena_paliwo', 'vat_paliwo',
    'cena_dystr', 'vat_dystr', 'abonament', 'dystr_stala', 'vat_stale'];
  if (pola.some((p) => o[p] === null)) return null;
  const grosze = (x) => Math.round(x * 100) / 100;
  const kwh = Math.round((o.odczyt_do - o.odczyt_od) * o.wsp_konwersji);
  const paliwo = grosze(kwh * o.cena_paliwo);
  const dystr = grosze(kwh * o.cena_dystr);
  const stale = o.abonament + o.dystr_stala;
  return grosze(paliwo * (1 + o.vat_paliwo) + dystr * (1 + o.vat_dystr) + stale * (1 + o.vat_stale));
}

function zlotowki(x) {
  return `${x.toFixed(2).replace('.', ',')} zł`;
}

function dzienPo(tekstDaty) {
  const [r, m, d] = tekstDaty.split('-').map(Number);
  const data = new Date(Date.UTC(r, m - 1, d + 1));
  return data.toISOString().slice(0, 10);
}

// Ciągłość z poprzednią fakturą i kontrola brutto — przeliczane przy każdej
// zmianie pola. Tylko ostrzeżenia: zapis zostaje możliwy (wymiana gazomierza
// czy korekta faktury potrafią celowo złamać ciągłość).
function przeliczKontroleFaktury() {
  const okresy = odczytajOkresy();
  const uwagi = [];
  const p = stanArkuszaFaktur && stanArkuszaFaktur.poprzednia;
  if (p && okresy.length > 0) {
    const pierwszy = okresy[0];
    if (p.okres_do && pierwszy.okres_od && pierwszy.okres_od !== dzienPo(p.okres_do)) {
      uwagi.push(`Poprzednia faktura (${p.nr_faktury}) kończy się ${p.okres_do} — ten okres powinien zacząć się ${dzienPo(p.okres_do)}.`);
    }
    if (p.odczyt_do !== null && pierwszy.odczyt_od !== null && Math.abs(pierwszy.odczyt_od - p.odczyt_do) > 0.0005) {
      uwagi.push(`Poprzednia faktura kończy się odczytem ${p.odczyt_do} m³, ta zaczyna od ${pierwszy.odczyt_od} m³ (w porządku tylko przy wymianie gazomierza).`);
    }
  }
  for (let i = 1; i < okresy.length; i++) {
    const a = okresy[i - 1], b = okresy[i];
    if (a.okres_do && b.okres_od && b.okres_od !== dzienPo(a.okres_do)) {
      uwagi.push(`Okres ${i + 1} powinien zacząć się ${dzienPo(a.okres_do)} (dzień po końcu okresu ${i}).`);
    }
  }
  if (stanArkuszaFaktur && stanArkuszaFaktur.wolnych_wierszy < okresy.length) {
    uwagi.push(`W zakładce faktury jest ${stanArkuszaFaktur.wolnych_wierszy} wolnych wierszy z formułami, a faktura potrzebuje ${okresy.length} — przeciągnij formuły (kolumny P–AE) w dół przed zapisem.`);
  }

  ciagloscFaktury.innerHTML = '';
  uwagi.forEach((u) => ciagloscFaktury.appendChild(element('p', 'pasek-alarmow__pozycja pasek-alarmow__pozycja--uwaga', u)));

  const brutta = okresy.map(bruttoOkresu);
  const deklarowane = liczbaZPola(poleBruttoFaktury);
  if (brutta.every((b) => b !== null) && brutta.length > 0) {
    const suma = Math.round(brutta.reduce((s, b) => s + b, 0) * 100) / 100;
    if (deklarowane === null) {
      kontrolaFaktury.textContent = `Brutto wyliczone z pól: ${zlotowki(suma)}.`;
      kontrolaFaktury.className = 'faktura__kontrola';
    } else {
      const roznica = Math.round((deklarowane - suma) * 100) / 100;
      const zgodne = Math.abs(roznica) <= 0.05;
      kontrolaFaktury.textContent = zgodne
        ? `Brutto wyliczone z pól: ${zlotowki(suma)} — zgadza się z fakturą.`
        : `Brutto wyliczone z pól: ${zlotowki(suma)}, na fakturze ${zlotowki(deklarowane)} — różnica ${zlotowki(roznica)}. Sprawdź ceny, VAT i odczyty.`;
      kontrolaFaktury.className = `faktura__kontrola faktura__kontrola--${zgodne ? 'ok' : 'roznica'}`;
    }
  } else {
    kontrolaFaktury.textContent = 'Uzupełnij wszystkie pola okresów, żeby sprawdzić brutto.';
    kontrolaFaktury.className = 'faktura__kontrola';
  }
}

function pokazFormularzFaktury(dane = {}) {
  poleNrFaktury.value = dane.nr_faktury || '';
  poleBruttoFaktury.value = dane.faktura_brutto ?? '';
  okresyFaktury.innerHTML = '';
  const okresy = dane.okresy && dane.okresy.length ? dane.okresy : [{}];
  okresy.forEach((o) => dodajOkresFaktury(o));
  formularzFaktury.classList.remove('ukryty');
  przeliczKontroleFaktury();
}

function otworzFakture() {
  ukryjKomunikatStart();
  generacjaFaktury++;
  stanArkuszaFaktur = null;
  formularzFaktury.classList.add('ukryty');
  komunikatFaktury.classList.add('ukryty');
  ustawStatusBloku(statusFaktury, '', 'info');
  plikFaktury.value = '';
  pokazEkran(ekranFaktura);
}

przyciskPdfFaktury.addEventListener('click', () => plikFaktury.click());
przyciskFakturaRecznie.addEventListener('click', () => {
  ustawStatusBloku(statusFaktury, '', 'info');
  pokazFormularzFaktury();
});

plikFaktury.addEventListener('change', async () => {
  const plik = plikFaktury.files && plikFaktury.files[0];
  if (!plik) return;
  if (plik.size > MAKS_ROZMIAR_PDF) {
    ustawStatusBloku(statusFaktury, 'Plik jest za duży (ponad 8 MB) — to raczej nie e-faktura.', 'blad');
    return;
  }
  const generacja = ++generacjaFaktury;
  formularzFaktury.classList.add('ukryty');
  komunikatFaktury.classList.add('ukryty');
  ustawStatusBloku(statusFaktury, 'Rozpoznawanie faktury… (zwykle kilkanaście sekund)', 'wczytywanie');
  przyciskPdfFaktury.disabled = true;
  try {
    const wynik = await odczytajFakture(await plikDoBase64(plik));
    if (generacja !== generacjaFaktury) return;
    if (!wynik.ok) {
      ustawStatusBloku(statusFaktury, `Nie udało się rozpoznać: ${wynik.blad}. Możesz wpisać fakturę ręcznie.`, 'blad');
      return;
    }
    stanArkuszaFaktur = { poprzednia: wynik.poprzednia, wolnych_wierszy: wynik.wolnych_wierszy };
    if (!wynik.pasuje) {
      ustawStatusBloku(statusFaktury, `To nie wygląda na fakturę za gaz z rozliczeniem${wynik.problem ? ` (${wynik.problem})` : ''}.`, 'blad');
      return;
    }
    const pewnosc = { wysoka: 'wysoka', srednia: 'średnia', niska: 'niska' }[wynik.pewnosc] || wynik.pewnosc;
    ustawStatusBloku(statusFaktury,
      `Rozpoznano (pewność: ${pewnosc})${wynik.problem ? ` — ${wynik.problem}` : ''}. Sprawdź pola z fakturą.`,
      wynik.pewnosc === 'wysoka' && !wynik.problem ? 'info' : 'blad');
    pokazFormularzFaktury(wynik);
  } catch (blad) {
    if (generacja !== generacjaFaktury) return;
    console.error('Nie udało się wysłać faktury do rozpoznania:', blad);
    ustawStatusBloku(statusFaktury, 'Brak połączenia z serwerem — spróbuj ponownie albo wpisz fakturę ręcznie.', 'blad');
  } finally {
    przyciskPdfFaktury.disabled = false;
    plikFaktury.value = '';
  }
});

przyciskDodajOkres.addEventListener('click', () => {
  // Nowy okres zaczyna się dzień po końcu poprzedniego i od jego odczytu —
  // najczęstszy przypadek (zmiana ceny w środku rozliczenia).
  const okresy = odczytajOkresy();
  const ost = okresy[okresy.length - 1] || {};
  dodajOkresFaktury({
    okres_od: ost.okres_do ? dzienPo(ost.okres_do) : null,
    odczyt_od: ost.odczyt_do, wsp_konwersji: ost.wsp_konwersji,
    vat_paliwo: ost.vat_paliwo, vat_dystr: ost.vat_dystr, vat_stale: ost.vat_stale,
  });
  przeliczKontroleFaktury();
});

poleBruttoFaktury.addEventListener('input', przeliczKontroleFaktury);

formularzFaktury.addEventListener('submit', async (zdarzenie) => {
  zdarzenie.preventDefault();
  const faktura = {
    nr_faktury: poleNrFaktury.value.trim(),
    faktura_brutto: liczbaZPola(poleBruttoFaktury),
    okresy: odczytajOkresy(),
  };
  przyciskZapiszFakture.disabled = true;
  przyciskZapiszFakture.textContent = 'Zapisywanie…';
  try {
    const wynik = await zapiszFakture(faktura);
    if (!wynik.ok) {
      komunikatFaktury.className = 'komunikat';
      komunikatFaktury.textContent = wynik.blad || 'Webhook odrzucił fakturę.';
      return;
    }
    pokazKomunikatStart(wynik.duplikat
      ? `Faktura ${faktura.nr_faktury} już jest w arkuszu — nic nie zapisano.`
      : `Zapisano fakturę ${faktura.nr_faktury} (${faktura.okresy.length === 1 ? 'wiersz' : 'wiersze'} ` +
        `${wynik.wiersz_od}${wynik.wiersz_do !== wynik.wiersz_od ? `–${wynik.wiersz_do}` : ''} zakładki faktury).`);
    pokazEkran(ekranStart);
  } catch (blad) {
    console.error('Nie udało się zapisać faktury:', blad);
    komunikatFaktury.className = 'komunikat';
    komunikatFaktury.textContent = 'Brak odpowiedzi serwera. Zapisz ponownie — jeśli faktura już doszła, ' +
      'aplikacja to rozpozna i nie zapisze jej drugi raz.';
  } finally {
    przyciskZapiszFakture.disabled = false;
    przyciskZapiszFakture.textContent = 'Zapisz fakturę';
  }
});

przyciskFaktura.addEventListener('click', poUstawieniach(otworzFakture));
przyciskZamknijFakture.addEventListener('click', () => pokazEkran(ekranStart));
