// Kopia ustawień (od 1.19.0): kod tekstowy z adresem webhooka, tokenem
// i (opcjonalnie) położeniem. Po wyczyszczeniu pamięci przeglądarki
// (localStorage znika razem z ustawieniami) wklejasz kod na ekranie
// Ustawienia i wszystko wraca.
//
// Czyste funkcje, bez DOM — dzięki temu da się je sprawdzić w Node.
//
// BEZPIECZEŃSTWO: kod zawiera token, więc jest tak samo wrażliwy jak sam
// token. Nigdy nie trafia do repozytorium ani do webhooka — powstaje na
// telefonie na żądanie i to użytkownik decyduje, gdzie go zapisze
// (menedżer haseł, prywatna notatka). To nie jest szyfrowanie, tylko
// zapis w jednej linii.
//
// Format: `MD1.<dane>.<suma>`
//   MD1    — wersja formatu (przy zmianie formatu: MD2…),
//   <dane> — JSON { a: adres, t: token, s?: szerokość, d?: długość } w UTF-8,
//            zapisany w base64 bez znaków specjalnych (+ / =),
//   <suma> — 4 znaki sumy kontrolnej z <dane>; wyłapuje literówki i ucięty
//            tekst, zanim cokolwiek nadpiszemy.

const PREFIKS = 'MD1';

// Prosta suma kontrolna (FNV-1a, 32 bity) w 4 znakach base36 — chroni przed
// przypadkowym błędem przy kopiowaniu, nie przed celowym podrobieniem.
function suma(tekst) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(4, '0').slice(-4);
}

function naBase64(tekst) {
  const bajty = new TextEncoder().encode(tekst);
  let binarnie = '';
  bajty.forEach((b) => { binarnie += String.fromCharCode(b); });
  return btoa(binarnie).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function zBase64(tekst) {
  const standard = tekst.replace(/-/g, '+').replace(/_/g, '/');
  const binarnie = atob(standard + '='.repeat((4 - (standard.length % 4)) % 4));
  const bajty = Uint8Array.from(binarnie, (z) => z.charCodeAt(0));
  return new TextDecoder().decode(bajty);
}

// Kod kopii z ustawień: { adresWebhooka, token, polozenie: {szerokosc, dlugosc} | null }.
export function zbudujKodKopii({ adresWebhooka, token, polozenie }) {
  const dane = { a: adresWebhooka, t: token };
  if (polozenie) {
    dane.s = polozenie.szerokosc;
    dane.d = polozenie.dlugosc;
  }
  const kodowane = naBase64(JSON.stringify(dane));
  return `${PREFIKS}.${kodowane}.${suma(kodowane)}`;
}

// Wynik: { ok: true, ustawienia: { adresWebhooka, token, polozenie|null } }
// albo { ok: false, blad: 'po polsku' }. Toleruje białe znaki (zawinięty
// tekst z notatki) i otaczający tekst — szuka kodu w całym wklejonym napisie.
export function odczytajKodKopii(wklejone) {
  const bezBialych = String(wklejone || '').replace(/\s+/g, '');
  const trafienie = bezBialych.match(/MD1\.([A-Za-z0-9_-]+)\.([a-z0-9]{4})(?![A-Za-z0-9_-])/);
  if (!trafienie) {
    return { ok: false, blad: 'To nie wygląda na kod kopii ustawień (powinien zaczynać się od „MD1.”). Wklej go w całości.' };
  }
  const [, kodowane, sumaKontrolna] = trafienie;
  if (suma(kodowane) !== sumaKontrolna) {
    return { ok: false, blad: 'Kod jest uszkodzony albo ucięty (suma kontrolna się nie zgadza). Skopiuj go jeszcze raz w całości.' };
  }

  let dane;
  try {
    dane = JSON.parse(zBase64(kodowane));
  } catch (blad) {
    return { ok: false, blad: 'Nie udało się odczytać kodu — skopiuj go jeszcze raz.' };
  }

  const adres = typeof dane.a === 'string' ? dane.a.trim() : '';
  const token = typeof dane.t === 'string' ? dane.t.trim() : '';
  if (!/^https:\/\/\S+$/.test(adres) || token === '') {
    return { ok: false, blad: 'W kodzie brakuje poprawnego adresu webhooka albo tokenu.' };
  }

  let polozenie = null;
  if (dane.s !== undefined || dane.d !== undefined) {
    if (!Number.isFinite(dane.s) || !Number.isFinite(dane.d)
      || Math.abs(dane.s) > 90 || Math.abs(dane.d) > 180) {
      return { ok: false, blad: 'Położenie w kodzie jest nieprawidłowe.' };
    }
    polozenie = { szerokosc: dane.s, dlugosc: dane.d };
  }
  return { ok: true, ustawienia: { adresWebhooka: adres, token, polozenie } };
}
