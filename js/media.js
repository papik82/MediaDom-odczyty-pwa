// Jedno miejsce z opisem wszystkich obsługiwanych mediów. Dołożenie kolejnego
// medium (np. wodomierza ze zdjęciem) to zmiana tutaj — reszta aplikacji
// (ekran potwierdzenia, moduł aparatu) czyta te dane, a nie ma ich na sztywno.

export const MEDIA = {
  gaz: { nazwa: 'Gaz', jednostka: 'm³', miejscaPoPrzecinku: 3 },
  prad_t1: { nazwa: 'Prąd T1', jednostka: 'kWh', miejscaPoPrzecinku: 0 },
  prad_t2: { nazwa: 'Prąd T2', jednostka: 'kWh', miejscaPoPrzecinku: 0 },
  prad_suma: { nazwa: 'Prąd suma', jednostka: 'kWh', miejscaPoPrzecinku: 0 },
  woda: { nazwa: 'Woda', jednostka: 'm³', miejscaPoPrzecinku: 3 },
};

// Media, dla których ekran startowy ma zaproponować zdjęcie licznika
// zamiast (albo obok) ręcznego wpisu. Rozszerzone z samego gazu na
// wszystkie media (2026-09-14) — sam mechanizm (wybór metody, aparat,
// galeria, podgląd) jest generyczny, nie wymagał zmian poza tą listą.
export const MEDIA_ZE_ZDJECIEM = ['gaz', 'prad_t1', 'prad_t2', 'prad_suma', 'woda'];

// Media, dla których backend ma podpowiedź rozpoznawania zdjęcia
// (PODPOWIEDZI_OCR w apps-script/webhook.js). Dla pozostałych akcja
// odczytaj_foto zwraca błąd „Brak podpowiedzi OCR”, więc ekran prądu nie
// pokazuje przy nich przycisku „Rozpoznaj” — zdjęcie służy wtedy tylko jako
// podgląd do przepisania. Gdy backend dostanie podpowiedź dla prądu,
// wystarczy dopisać tu prad_t1 / prad_t2 / prad_suma.
export const MEDIA_Z_OCR = ['gaz'];

// Ekran prądu (od 0.20.0): trzy media z jednego licznika na jednym ekranie,
// w tej kolejności — tak też są wysyłane do zapisu i wymieniane
// w podsumowaniu. Od 0.22.2 suma jest pierwsza, potem T1 i T2 (kolejność
// wygodniejsza przy przepisywaniu z licznika). Opis to podpowiedź pod
// nazwą w wierszu.
export const POZYCJE_PRADU = [
  { medium: 'prad_suma', opis: 'obie taryfy razem' },
  { medium: 'prad_t1', opis: 'taryfa szczytowa' },
  { medium: 'prad_t2', opis: 'druga taryfa' },
];
