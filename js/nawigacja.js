// Nawigacja między ekranami oraz małe „haki”, dzięki którym moduły ekranów
// nie muszą importować się nawzajem (inaczej Kocioł, Ustawienia i pasek
// alarmów tworzyłyby pętlę zależności).
//
// Ekrany to wszystkie elementy `.ekran` z index.html — nowy ekran wystarczy
// dodać w HTML, nie trzeba go nigdzie rejestrować.

export const ekranStart = document.getElementById('ekran-start');
const komunikatStart = document.getElementById('komunikat-start');
const przyciskKomunikatu = document.getElementById('przycisk-akcji-komunikatu');

// Dane z pulpitu potrzebne innym ekranom (formularz Kocioł pyta o ostatni odczyt gazu).
// Pulpit je tu odkłada po każdej odpowiedzi — moduły nie importują się nawzajem,
// więc wspólny stan leży w nawigacji, tak jak haki niżej.
export const daneZPulpitu = { gazOstatni: null, tolerancjaKotlaMin: null };

// Komunikat nad kartami ekranu startowego (wynik zapisu, wysyłki z kolejki).
// Pokazuje się po zapisie danych (odczyt, kocioł, faktura, wysyłka z kolejki),
// więc przy okazji powiadamia pulpit, że jego dane są nieaktualne.
// `akcja` (opcjonalna) — { etykieta, wykonaj }: przycisk pod komunikatem, np.
// „Odczyt gazu teraz” po zapisie nastaw kotła. Znika razem z komunikatem.
export function pokazKomunikatStart(tekst, akcja = null) {
  komunikatStart.textContent = tekst;
  komunikatStart.classList.remove('ukryty');
  if (akcja) {
    przyciskKomunikatu.textContent = akcja.etykieta;
    przyciskKomunikatu.onclick = () => {
      ukryjKomunikatStart();
      akcja.wykonaj();
    };
    przyciskKomunikatu.classList.remove('ukryty');
  } else {
    przyciskKomunikatu.classList.add('ukryty');
  }
  powiadomOZmianieDanych();
}

export function ukryjKomunikatStart() {
  komunikatStart.classList.add('ukryty');
  przyciskKomunikatu.classList.add('ukryty');
  przyciskKomunikatu.onclick = null;
}

export function czyKomunikatStartWidoczny() {
  return !komunikatStart.classList.contains('ukryty');
}

export function czyStartWidoczny() {
  return !ekranStart.classList.contains('ukryty');
}

// Co robić przy każdym powrocie na ekran startowy (i przy starcie aplikacji,
// i przy powrocie z tła): odświeżyć z wyprzedzeniem nastawy kotła i sprawdzić
// alarmy. Same funkcje pilnują, żeby nie pytać webhooka częściej niż raz
// na minutę.
const hakiPowrotuNaStart = [];
export function naPowrotNaStart(funkcja) {
  hakiPowrotuNaStart.push(funkcja);
}

export function odswiezStanStartu() {
  hakiPowrotuNaStart.forEach((funkcja) => funkcja());
}

// Zapis zmienił dane w arkuszu — pulpit odświeża się wtedy od razu, bez
// czekania na minutę odstępu między pytaniami do webhooka.
const hakiZmianyDanych = [];
export function naZmianieDanych(funkcja) {
  hakiZmianyDanych.push(funkcja);
}

function powiadomOZmianieDanych() {
  hakiZmianyDanych.forEach((funkcja) => funkcja());
}

// Nowy adres/token to potencjalnie inny arkusz — moduły trzymające dane
// w pamięci (nastawy kotła) rejestrują tu swoje unieważnienie.
const hakiZmianyUstawien = [];
export function naZmianieUstawien(funkcja) {
  hakiZmianyUstawien.push(funkcja);
}

export function powiadomOZmianieUstawien() {
  hakiZmianyUstawien.forEach((funkcja) => funkcja());
}

export function pokazEkran(ekranDoPokazania) {
  for (const ekran of document.querySelectorAll('.ekran')) {
    ekran.classList.toggle('ukryty', ekran !== ekranDoPokazania);
  }
  if (ekranDoPokazania === ekranStart) odswiezStanStartu();
}
