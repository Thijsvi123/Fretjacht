# Fretjacht

Gitaaroefenapp die via de microfoon meeluistert. Open op je telefoon: https://thijsvi123.github.io/Fretjacht/

## Indeling

- **Startscherm**: een podium met je niveau (van Nieuwkomer tot Halslegende), een XP-meter, je reeks, het aantal gevonden noten, hoe vaak je goed antwoordt en je dagdoel in minuten. De fret zegt erbij wat er vandaag te doen is. Daaronder kies je je pad: Muziektheorie of Halsjacht.
- **Leerpad, Muziektheorie**: per les van de muziektheoriecursus een unit met korte lessen en een unittoets ("Cursus: les 1 van 8"). Je beantwoordt theorievragen, tikt op de hals of speelt op je gitaar. Een unit opent na de les van maandag of donderdag. Onder elke unit staat de les in het kort.
- **Leerpad, Halsjacht**: de hals leren kennen zonder gitaar, in acht niveaus (lage E, A, D, G, B, hoge e, kruizen en mollen, de hele hals). Elk niveau heeft drie stappen: Leren (uitleg met de hals erbij en ankerpunten), Herkennen (welke noot is dit, ook je snelheid telt) en Toepassen (tik alle plekken van een noot aan). Herkennen en Toepassen haal je met 80% goed.
- **Niveaus en plectrums**: XP brengt je een niveau omhoog, met een feestje. Nieuwe plectrums: Eerste 50 noten, Tien op rij, Lage E beheerst, Alle stamtonen en Hele hals.
- **Eén overzicht**: tijdens een les of Oefen vandaag verschijnt er geen melding over je vraag heen. Wat je verdient (een niveau omhoog, je dagdoel, opdrachten, een reeksbevriezer, plectrums) staat samen op het eindscherm van de les en na de sessie, met één keer confetti. Daarbuiten worden meldingen die tegelijk komen één melding; tik erop om hem weg te halen.
- **Opdrachten van vandaag**: drie kleine opdrachten per dag. Doe je ze alle drie, dan verdien je een reeksbevriezer (maximaal 2). Mis je een dag, dan houdt de bevriezer je reeks vast.
- **Oefen vandaag**: één knop die een sessie voor je dagdoel samenstelt: opwarmen, de volgende stap in het leerpad, herhalen, en een oefening die bij de les past. Aan het eind zie je alles wat je in de sessie verdiende.
- **Herhalen** (Leitner): een vraag die je fout hebt, komt terug. Eerst meteen (na de les met de knop Herhaal je fouten, of later met de knop naast Oefen vandaag), en als je hem dan goed hebt na 1 dag, na 3 dagen en na 7 dagen. Weet je hem dan nog, dan schuift hij een vakje door; na het vak van 7 dagen heb je hem onder de knie. Een fout zet hem terug naar het begin. De vakjes (Nu, 1 dag, 3 dagen, 7 dagen, Onder de knie) staan bovenaan Oefenen, het tabblad toont hoeveel er klaarstaat en Oefen vandaag neemt ze mee. Staat er niets klaar, dan herhaal je vragen uit eerdere lessen, je zwakke punten eerst. Alles herhaald wat klaarstond geeft 10 XP extra.
- **Feedback**: bij goed een tikje trillen, een geluidje, noten die uit je antwoord springen en een groene rand; bij fout twee tikjes, een schudje, het goede antwoord en een aanmoediging. Tijdens het spelen trilt de app niet (anders hoort de microfoon de telefoon); wel licht het kaartje op, telt de fret je reeks en zegt hij of je een fret te hoog of te laag zat. Trillen werkt op Android en op een iPhone met iOS 18 of nieuwer, en staat aan of uit bij Instellingen.
- **Lege staten**: heb je nog nooit of vandaag nog niet geoefend, dan tonen Oefenen en Voortgang een kaart met de fret en één knop om te beginnen. Op een lege Voortgang kun je ook meteen een reservekopie terugzetten.
- **Reservekopie**: je voortgang staat alleen in de browser. Bij Voortgang (en Instellingen) maak je een kopie: op de telefoon via het deelmenu (bewaar hem in Bestanden, iCloud Drive of Google Drive), op de computer als download (`fretjacht-<datum>.json`). Met Terugzetten kies je dat bestand; je ziet eerst wat er verandert (niveau, XP, dagen, plectrums) voor je je voortgang vervangt. De instellingen van je microfoon blijven bij het toestel. Zo zet je ook je voortgang over naar een andere telefoon.
- **Tikken op de hals**: op de telefoon staat een hals om op te tikken (Toepassen, Zoek de noot, de Halsverkenner) in twee rijen, fret 0 tot 6 en 7 tot 12, met de snaren verder uit elkaar. Gaat een vraag over één snaar, dan telt de hele kolom van die fret. Bij een tikvraag uit de theorie zoomt de hals in op zeven frets rond de gemarkeerde noot. Op een groot scherm blijft de hele hals in één rij.
- **Oefenen**: een pedalboard. Elke oefening is een effectpedaal; het lampje brandt als je hem vandaag al speelde. Bovenaan staat de oefening die bij de les van deze week past.
  - De hals: Welke noot? (zonder gitaar: herkennen of alle plekken zoeken, met een halskaart van je snelheid per plek), Noten zoeken, Alle posities, Intervallen, Trappen
  - Solo's: Toonladders en boxen (pentatonisch, blues, majeur, mineur, dorisch, mixolydisch), Akkoordtonen, Doeltonen (de terts, grondtoon, kwint of septiem op elk akkoord van een blues, I-IV-V, ii-V-I, pop- of mineurreeks, in je eigen tempo of op de tel), Bends met live lijn
  - Gehoor: Gehoortraining zonder gitaar (intervallen en akkoordsoorten herkennen, met geheugensteuntjes), Op gehoor naspelen
  - Uitdaging: 60 seconden, Hittekaart
  - Gereedschap: Halsverkenner (alle noten van een toonladder of akkoord, tik om te horen), Metronoom met tap tempo en meting op de tel, Stemapparaat
- **Voortgang**: reeks en bevriezers, XP, een kalender van de afgelopen 16 weken, minuten per dag, units, mijlpalen (plectrums), records en je reservekopie. Met **Kopieer voortgang** plak je een samenvatting van je zwakke plekken als reactie op een les, zodat de cursus zich aanpast.

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
- `python3 tests/e2e.py` (alle oefeningen), `python3 tests/learn.py` (leerpad, herhalen, Oefen vandaag, Oefenen, Voortgang), `python3 tests/features.py` (opdrachten, bevriezer, uitlegkaartje, cursusvoortgang, halsverkenner, doeltonen, gehoortraining) , `python3 tests/review.py` (herhalen na 1, 3 en 7 dagen, trillen en feedback, lege staten), `python3 tests/hals.py` (startscherm, niveaus, Halsjacht, Welke noot?, en een controle van alle gegenereerde halsvragen en ankerpunten) en `python3 tests/tidy.py` (één Herhalen, één overzicht na een les of sessie, de reservekopie en de grote tikvakjes op de telefoon). De laatste drie sluiten af met een lijst van geslaagde controles. Ze gebruiken Playwright met een nep-microfoon die speelt wat de app vraagt. Zet `SCHEME=dark` voor de donkere modus, `SHOTS=<map>` voor de schermafbeeldingen en `FONTS_DIR=<map>` (met `bricolage.ttf` en `instrument.ttf`) om de echte lettertypes te gebruiken.
