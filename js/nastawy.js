// Nastawy kotła: tryby, obwody i porównywanie zestawów nastaw. Czyste
// funkcje bez DOM — korzystają z nich formularz Kotła, historia zmian
// i kolejka offline (czy wpis z kolejki nie jest już w arkuszu).

export const ETYKIETY_TRYBU = { off: 'Wyłączony', cwu: 'CWU', co: 'CO', cwu_co: 'CWU + CO' };

// Tryb rozłożony na dwa obwody: CO (ogrzewanie) i CWU (ciepła woda). Z tego
// korzysta formularz (które pola mają sens) i historia zmian (paski, opisy).
const OBWODY_TRYBU = {
  off: { co: false, cwu: false },
  cwu: { co: false, cwu: true },
  co: { co: true, cwu: false },
  cwu_co: { co: true, cwu: true },
};

export function obwodyTrybu(tryb) {
  return OBWODY_TRYBU[tryb] || { co: false, cwu: false };
}

export function wartoscPusta(v) {
  return v === null || v === undefined || v === '';
}

// Czy zmieniła się dana nastawa — to samo porównanie co przy wykrywaniu
// „brak zmian” w formularzu (doPorownania traktuje null i '' jednakowo).
export function rozne(a, b) {
  return doPorownania(a) !== doPorownania(b);
}

// Puste pole -> null (nie NaN z parseFloat('')) — "krzywa grzewcza" i
// "przesunięcie" są null przy samym CWU (bez CO), zgodnie z archiwum.
export function liczbaAlboNull(tekst) {
  return tekst === '' ? null : parseFloat(tekst);
}

// Do porównania "czy coś się zmieniło" — null, undefined i NaN (np. gdyby
// pole zawierało coś niepoprawnego) traktujemy jako ten sam, pusty stan.
export function doPorownania(wartosc) {
  if (wartosc === null || wartosc === undefined) return '';
  if (typeof wartosc === 'number' && Number.isNaN(wartosc)) return '';
  return String(wartosc);
}

// Czy dwa zestawy nastaw kotła są takie same (bez daty obowiązywania).
// Wspólne dla formularza (czy w ogóle jest co wysłać) i kolejki offline
// (czy wpis z kolejki nie jest już w arkuszu — patrz czyNastawyJuzWArkuszu).
//
// Obie strony najpierw przez normalizujNastawy: formularz nie wyśle krzywej
// przy samym CWU, więc wpis z arkusza, który ją ma, nie może przez to
// wyglądać na „inny”.
function normalizujNastawy(n) {
  const obwody = obwodyTrybu(n.tryb);
  return {
    ...n,
    krzywa_grzewcza: obwody.co ? n.krzywa_grzewcza : null,
    przesuniecie: obwody.co ? n.przesuniecie : null,
    temp_cwu: obwody.cwu ? n.temp_cwu : null,
  };
}

export function czyTeSameNastawy(pierwsze, drugie) {
  const a = normalizujNastawy(pierwsze);
  const b = normalizujNastawy(drugie);
  return a.tryb === b.tryb
    && doPorownania(a.krzywa_grzewcza) === doPorownania(b.krzywa_grzewcza)
    && doPorownania(a.przesuniecie) === doPorownania(b.przesuniecie)
    && doPorownania(a.temp_cwu) === doPorownania(b.temp_cwu)
    && a.cyrkulacja === b.cyrkulacja;
}

// --- Cyrkulacja: tekst w arkuszu <-> przedziały godzin ---------------------

// <input type="time"> wymaga dwucyfrowej godziny (value="04:30"), więc przy
// wczytywaniu z arkusza ("4:30") trzeba ją dopełnić zerem — inaczej
// przeglądarka po cichu zignoruje wartość i pole zostanie puste.
export function dopelnijGodzine(godzina) {
  const [h, m] = (godzina || '').split(':');
  if (h === undefined || m === undefined) return '';
  return `${h.padStart(2, '0')}:${m}`;
}

// Odwrotnie — do zapisu w stylu arkusza zdejmujemy zero wiodące.
export function skrocGodzine(godzina) {
  const [h, m] = godzina.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

export function serializujCyrkulacje(przedzialy) {
  return przedzialy.map((p) => `${skrocGodzine(p.od)} - ${skrocGodzine(p.do)}`).join('; ');
}

// Odporne na format z zera wiodącym i bez niego, ze spacjami wokół myślnika
// albo bez — split('-') i trim() ogarniają obie wersje (nasza i archiwalna).
// Przedziały dzielimy po średniku ORAZ po przecinku: średnik to obowiązujący
// format, przecinek zostaje na wszelki wypadek (tak sklejała PWA do 1.1.0;
// w arkuszu takich wpisów nie ma — sprawdzone na migawce 2026-10-07).
export function sparsujCyrkulacje(tekst) {
  if (!tekst) return [];
  return String(tekst).split(/[;,]/).map((kawalek) => kawalek.trim()).filter(Boolean).map((kawalek) => {
    const [od, do_] = kawalek.split('-').map((s) => s.trim());
    return { od: od || '', do: do_ || '' };
  });
}
