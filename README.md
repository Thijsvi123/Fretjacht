# Fretjacht

Gitaaroefenapp die via de microfoon meeluistert. Open op je telefoon: https://thijsvi123.github.io/Fretjacht/

## Oefeningen

- **De hals**: Noten zoeken, Alle posities, Intervallen, Trappen
- **Solo's**: Toonladders en boxen (pentatonisch, blues, majeur, mineur, dorisch, mixolydisch), Akkoordtonen, Bends met live lijn
- **Gehoor**: Op gehoor naspelen, van één noot tot blueslicks
- **Uitdaging en inzicht**: 60 seconden, Hittekaart
- **Handig**: Metronoom met tap tempo en meting op de tel, Stemapparaat
- **Dagelijkse routine** die zelf wisselt tussen onderdelen

## Ontwikkelen

De bron staat in `src/`. `python3 build.py` voegt alles samen tot `index.html`, het bestand dat GitHub Pages serveert.

Tests: `node tests/theory.test.js`, `node tests/ks.test.js` en `python3 tests/e2e.py` (Playwright met een nep-microfoon die speelt wat de app vraagt).
