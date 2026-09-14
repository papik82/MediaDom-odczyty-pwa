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
