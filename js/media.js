// Jedno miejsce z opisem wszystkich obsługiwanych mediów. Dołożenie kolejnego
// medium (np. wodomierza ze zdjęciem) to zmiana tutaj — reszta aplikacji
// (ekran potwierdzenia, moduł aparatu) czyta te dane, a nie ma ich na sztywno.

export const MEDIA = {
  gaz: { nazwa: 'Gaz', jednostka: 'm³', miejscaPoPrzecinku: 3 },
  prad_t1: { nazwa: 'Prąd T1', jednostka: 'kWh', miejscaPoPrzecinku: 0 },
  prad_t2: { nazwa: 'Prąd T2', jednostka: 'kWh', miejscaPoPrzecinku: 0 },
  woda: { nazwa: 'Woda', jednostka: 'm³', miejscaPoPrzecinku: 3 },
};

// Media, dla których ekran startowy ma zaproponować zdjęcie licznika
// zamiast (albo obok) ręcznego wpisu. Na dziś tylko gaz — zgodnie z CLAUDE.md.
export const MEDIA_ZE_ZDJECIEM = ['gaz'];
