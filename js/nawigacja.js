// Nawigacja między ekranami oraz małe „haki”, dzięki którym moduły ekranów
// nie muszą importować się nawzajem (inaczej Kocioł, Ustawienia i pasek
// alarmów tworzyłyby pętlę zależności).
//
// Ekrany to wszystkie elementy `.ekran` z index.html — nowy ekran wystarczy
// dodać w HTML, nie trzeba go nigdzie rejestrować.

export const ekranStart = document.getElementById('ekran-start');
const komunikatStart = document.getElementById('komunikat-start');

// Komunikat nad kartami ekranu startowego (wynik zapisu, wysyłki z kolejki).
export function pokazKomunikatStart(tekst) {
  komunikatStart.textContent = tekst;
  komunikatStart.classList.remove('ukryty');
}

export function ukryjKomunikatStart() {
  komunikatStart.classList.add('ukryty');
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
