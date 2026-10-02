# Fretjacht

Gitaaroefenapp die via de microfoon meeluistert. Open op je telefoon: https://thijsvi123.github.io/Fretjacht/

## Indeling

- **Leerpad** (startscherm): per les van de muziektheoriecursus een unit met korte lessen en een unittoets. Je beantwoordt theorievragen, tikt op de hals of speelt op je gitaar. Een unit opent na de les van maandag of donderdag.
- **Oefen vandaag**: één knop die een sessie voor je dagdoel samenstelt: opwarmen, de volgende stap in het leerpad, herhalen waar je fouten maakte, en een oefening die bij de les past.
- **Oefenen**: alle losse oefeningen.
  - De hals: Noten zoeken, Alle posities, Intervallen, Trappen
  - Solo's: Toonladders en boxen (pentatonisch, blues, majeur, mineur, dorisch, mixolydisch), Akkoordtonen, Bends met live lijn
  - Gehoor: Op gehoor naspelen, van één noot tot blueslicks
  - Uitdaging en inzicht: 60 seconden, Hittekaart
  - Handig: Metronoom met tap tempo en meting op de tel, Stemapparaat
- **Voortgang**: reeks, XP, een kalender van de afgelopen 16 weken, minuten per dag, units, mijlpalen en records.

## Het leerpad bijwerken

`path.json` bevat de units. Na elke les komt er een unit bij:

```json
{ "lesson": 2, "date": "2026-10-05", "topic": "intervals", "title": "Intervallen", "subtitle": "…", "doc": "https://claude.ai/code/artifact/…",
  "quiz": [{ "q": "…", "options": ["…", "…", "…"], "answer": 0, "explain": "…" }] }
```

`topic` kiest de oefeningen die de app zelf maakt: `twelve-tones`, `intervals`, `major-scale`, `keys-circle`, `minor`, `chord-building`, `diatonic-chords`, `progressions`, `scale-boxes` (met `"params": { "scale": "minpent", "root": "A", "boxes": [1, 2] }`) of `generic`. De vragen in `quiz` komen bij de laatste les van de unit en in de unittoets. Een `generic` unit heeft minstens 3 vragen nodig. Met `"drill": { "mode": "ear" }` kies je zelf welke oefening bij Oefen vandaag hoort.

Controleer het bestand voor je het pusht: `node tests/check_path.js`.

Staat een gegeven les een dag later nog niet in `path.json`, dan opent de app de unit uit het cursusschema in `src/js/11-content.js`.

## Ontwikkelen

De bron staat in `src/`. `python3 build.py` voegt alles samen tot `index.html`, het bestand dat GitHub Pages serveert.

Tests:

- `node tests/theory.test.js`, `node tests/ks.test.js`, `node tests/content.test.js`, `node tests/path.test.js`
- `python3 tests/e2e.py` (alle oefeningen) en `python3 tests/learn.py` (leerpad, Oefen vandaag, Voortgang). Beide gebruiken Playwright met een nep-microfoon die speelt wat de app vraagt. Zet `SCHEME=dark` voor de donkere modus en `SHOTS=<map>` voor de schermafbeeldingen.
