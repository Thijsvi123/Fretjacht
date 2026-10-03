# Fretjacht

Gitaaroefenapp die via de microfoon meeluistert. Open op je telefoon: https://thijsvi123.github.io/Fretjacht/

## Indeling

- **Leerpad** (startscherm): per les van de muziektheoriecursus een unit met korte lessen en een unittoets. Je beantwoordt theorievragen, tikt op de hals of speelt op je gitaar. Een unit opent na de les van maandag of donderdag. Onder elke unit staat de les in het kort.
- **Opdrachten van vandaag**: drie kleine opdrachten per dag. Doe je ze alle drie, dan verdien je een reeksbevriezer (maximaal 2). Mis je een dag, dan houdt de bevriezer je reeks vast.
- **Oefen vandaag**: één knop die een sessie voor je dagdoel samenstelt: opwarmen, de volgende stap in het leerpad, herhalen waar je fouten maakte, en een oefening die bij de les past.
- **Foutenbak**: elke vraag die je in een les fout hebt, komt in je foutenbak. Herstel je fouten direct na de les, met de knop naast Oefen vandaag of vanuit Oefenen. Een goed antwoord haalt de vraag uit de bak en geeft bonus-XP; een lege bak geeft 2 minuten extra voor je dagdoel.
- **Herhalen** (Leitner): een herstelde fout komt terug na 1 dag, daarna na 3 en na 7 dagen. Weet je hem dan nog, dan schuift hij een vakje door; na het vak van 7 dagen heb je hem onder de knie. Een fout zet hem terug in de foutenbak. De vakjes staan bovenaan Oefenen, het tabblad toont hoeveel er vandaag terugkomt en Oefen vandaag neemt ze mee.
- **Feedback**: bij goed een tikje trillen, een geluidje, noten die uit je antwoord springen en een groene rand; bij fout twee tikjes, een schudje, het goede antwoord en een aanmoediging. Tijdens het spelen trilt de app niet (anders hoort de microfoon de telefoon); wel licht het kaartje op, telt de fret je reeks en zegt hij of je een fret te hoog of te laag zat. Trillen werkt op Android en op een iPhone met iOS 18 of nieuwer, en staat aan of uit bij Instellingen.
- **Lege staten**: heb je nog nooit of vandaag nog niet geoefend, dan tonen Oefenen en Voortgang een kaart met de fret en één knop om te beginnen.
- **Oefenen**: een pedalboard. Elke oefening is een effectpedaal; het lampje brandt als je hem vandaag al speelde. Bovenaan staat de oefening die bij de les van deze week past.
  - De hals: Noten zoeken, Alle posities, Intervallen, Trappen
  - Solo's: Toonladders en boxen (pentatonisch, blues, majeur, mineur, dorisch, mixolydisch), Akkoordtonen, Doeltonen (de terts, grondtoon, kwint of septiem op elk akkoord van een blues, I-IV-V, ii-V-I, pop- of mineurreeks, in je eigen tempo of op de tel), Bends met live lijn
  - Gehoor: Gehoortraining zonder gitaar (intervallen en akkoordsoorten herkennen, met geheugensteuntjes), Op gehoor naspelen
  - Uitdaging: 60 seconden, Hittekaart
  - Gereedschap: Halsverkenner (alle noten van een toonladder of akkoord, tik om te horen), Metronoom met tap tempo en meting op de tel, Stemapparaat
- **Voortgang**: reeks en bevriezers, XP, een kalender van de afgelopen 16 weken, minuten per dag, units, mijlpalen (plectrums) en records. Met **Kopieer voortgang** plak je een samenvatting van je zwakke plekken als reactie op een les, zodat de cursus zich aanpast.

De mascotte is een fret: fretjacht is letterlijk jagen met een fret. Hij staat in `src/js/05b-brand.js`, samen met de illustraties, de muzieknoten-confetti, de geluidjes (gitaarklank via Karplus-Strong) en de laadanimatie.

## Het leerpad bijwerken

`path.json` bevat de units. Na elke les komt er een unit bij:

```json
{ "lesson": 2, "date": "2026-10-05", "topic": "intervals", "title": "Intervallen", "subtitle": "…", "doc": "https://claude.ai/code/artifact/…",
  "summary": ["Kernpunt 1.", "Kernpunt 2.", "Kernpunt 3."],
  "quiz": [{ "q": "…", "options": ["…", "…", "…"], "answer": 0, "explain": "…" }] }
```

`summary` (2 tot 4 korte zinnen) is het uitlegkaartje onder de unit. Zonder `summary` toont de app een standaardtekst bij het onderwerp.

`topic` kiest de oefeningen die de app zelf maakt: `twelve-tones`, `intervals`, `major-scale`, `keys-circle`, `minor`, `chord-building`, `diatonic-chords`, `progressions`, `scale-boxes` (met `"params": { "scale": "minpent", "root": "A", "boxes": [1, 2] }`) of `generic`. De vragen in `quiz` komen bij de laatste les van de unit en in de unittoets. Een `generic` unit heeft minstens 3 vragen nodig. Met `"drill": { "mode": "ear" }` kies je zelf welke oefening bij Oefen vandaag hoort.

Controleer het bestand voor je het pusht: `node tests/check_path.js`.

Staat een gegeven les een dag later nog niet in `path.json`, dan opent de app de unit uit het cursusschema in `src/js/11-content.js`.

## Ontwikkelen

De bron staat in `src/`. `python3 build.py` voegt alles samen tot `index.html`, het bestand dat GitHub Pages serveert.

Tests:

- `node tests/theory.test.js`, `node tests/ks.test.js`, `node tests/content.test.js`, `node tests/path.test.js`
- `python3 tests/e2e.py` (alle oefeningen), `python3 tests/learn.py` (leerpad, foutenbak, Oefen vandaag, Oefenen, Voortgang), `python3 tests/features.py` (opdrachten, bevriezer, uitlegkaartje, cursusvoortgang, halsverkenner, doeltonen, gehoortraining) en `python3 tests/review.py` (herhalen na 1, 3 en 7 dagen, trillen en feedback, lege staten; sluit af met een lijst van geslaagde controles). Ze gebruiken Playwright met een nep-microfoon die speelt wat de app vraagt. Zet `SCHEME=dark` voor de donkere modus, `SHOTS=<map>` voor de schermafbeeldingen en `FONTS_DIR=<map>` (met `bricolage.ttf` en `instrument.ttf`) om de echte lettertypes te gebruiken.
