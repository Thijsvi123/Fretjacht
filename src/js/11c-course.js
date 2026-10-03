// ---------- Cursus muziektheorie, fase 1: eerst de les, dan de oefeningen ----------
// Elke unit begint met een les in kaartjes. Een kaartje: { t: titel, p: [alinea's], neck, play, table, list, tip, circle }
//  play: [{ l: label, n: 'C3 E3' }]            noten na elkaar
//        [{ l: label, n: 'C3 E3 G3', c: true }] samen, als akkoord
//        [{ l: label, ch: ['C3 E3 G3', ...] }]  akkoorden na elkaar
// Een nieuwe les opent op zondag, als je de unittoets van de vorige hebt gehaald (zie courseDates).
const noteMidi = s => {
  const m = /^([A-G])([#b♯♭]?)(-?\d)$/.exec(s);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0);
};
const LES_DONE = 'Hieronder staat de kern van de les. Daarna volgen de oefeningen. Je kunt de les altijd teruglezen met Lees de les.';
const COURSE = [
  // ---------------------------------------------------------------- les 1
  { lesson: 1, topic: 'twelve-tones', title: 'Waarom 12 tonen', subtitle: 'Octaaf, kwint en de kwintencirkel',
    quiz: [
      { q: 'Waarom blijft een powerchord strak klinken, ook met veel distortion?', options: ['Kwint en octaaf zitten al in de boventonen van de grondtoon', 'Er zit een grote terts in die alles bij elkaar houdt', 'Powerchords worden altijd op de lage snaren gespeeld', 'Distortion haalt de kwint weg'], answer: 0, explain: 'De kwint (3:2) en het octaaf (2:1) zitten al in de boventoonreeks van de grondtoon. Een terts geeft met distortion juist snel een modderige klank.' },
      { q: 'De riff van Smells Like Teen Spirit bestaat uit powerchords. Waarom is geen van die akkoorden majeur of mineur?', options: ['De terts ontbreekt', 'De kwint ontbreekt', 'Hij staat in een rare maatsoort', 'Er zit te veel distortion op'], answer: 0, explain: 'De terts bepaalt majeur of mineur. Zonder terts klinkt een akkoord neutraal en krachtig.' },
      { q: 'Welke sprong hoor je tussen “Altijd” en “is” in Altijd is Kortjakje ziek?', options: ['Een kwint omhoog', 'Een octaaf omhoog', 'Een grote terts omhoog', 'Een kwart omlaag'], answer: 0, explain: 'Na de eerste twee gelijke noten springt de melodie een kwint omhoog: een handig geheugensteuntje voor dat interval.' },
      { q: 'De A-snaar trilt op 110 Hz. Welke boventoon ligt bijna op een C♯?', options: ['550 Hz (×5)', '330 Hz (×3)', '440 Hz (×4)', '660 Hz (×6)'], answer: 0, explain: '110 × 5 = 550 Hz: twee octaven plus een grote terts boven de A, net iets lager dan een gestemde C♯.' },
    ],
    cards: [
      { t: 'Waarom twaalf tonen?',
        p: ['Van een A naar de volgende A zijn het op je gitaar twaalf frets, dus twaalf halve tonen. Waarom precies twaalf? Omdat twaalf kwinten op elkaar bijna precies zeven octaven zijn.', 'In deze les zie je hoe dat zit, en wat het met powerchords te maken heeft.'],
        neck: { from: 0, to: 12, highlight: [4], marks: [lmk(4, 0, 'hi', 'A'), lmk(4, 12, 'hi', 'A')] } },
      { t: 'Eén snaar, veel tonen tegelijk',
        p: ['Tokkel je de A-snaar, dan trilt hij als geheel 110 keer per seconde: 110 hertz. Tegelijk trilt hij in twee gelijke stukken, in drie, in vier, enzovoort.', 'Die extra tonen heten boventonen. Je hoort ze meestal niet apart, maar samen bepalen ze de klankkleur van je gitaar.'],
        table: { h: ['Deel van de snaar', 'Hz', 'Toon', 'Boven de A'], r: [['hele snaar', '110', 'A', 'grondtoon'], ['½', '220', 'A', 'octaaf'], ['⅓', '330', 'E', 'octaaf + kwint'], ['¼', '440', 'A', 'twee octaven'], ['⅕', '550', 'C♯ (bijna)', 'twee octaven + grote terts'], ['⅙', '660', 'E', 'twee octaven + kwint']] },
        play: [{ l: 'De A-snaar', n: 'A2' }, { l: 'Grondtoon en vijf boventonen', n: 'A2 A3 E4 A4 C#5 E5' }],
        tip: 'Heb je je gitaar bij de hand? Leg een vinger heel licht op de A-snaar, precies boven fret 12, 7 of 5, en tokkel. Dat heet een flageolet: je hoort dan één boventoon los, 220, 330 of 440 hertz.' },
      { t: 'Het octaaf: 2 staat tot 1',
        p: ['Twee keer zo snel trillen klinkt als dezelfde noot, alleen hoger. Daarom heten 110 en 220 hertz allebei A. Die verhouding, 2:1, heet het octaaf.', 'Op de gitaar vind je het octaaf twaalf frets verder op dezelfde snaar, of twee snaren hoger en twee frets verder. Begin je op de D- of G-snaar, dan zijn het drie frets, omdat je over de B-snaar gaat. Daarover meer in les 2.'],
        neck: { from: 0, to: 12, marks: [lmk(4, 0, 'hi', 'A'), lmk(2, 2, 'pair', 'A'), lmk(4, 12, 'pair', 'A')] },
        play: [{ l: 'A en het octaaf', n: 'A2 A3' }, { l: 'Samen', n: 'A2 A3', c: true }] },
      { t: 'De kwint: 3 staat tot 2',
        p: ['De derden trillen drie keer zo snel: een E, een octaaf plus een kwint boven de A. Haal je dat octaaf eraf, dan hou je de verhouding 3:2 over: de kwint.', 'Na het octaaf is de kwint de stabielste samenklank die er is. Op de hals ligt hij één snaar hoger en twee frets verder. Vanaf de G-snaar is dat drie frets, daarover meer in les 2.'],
        neck: { from: 0, to: 7, marks: [lmk(4, 0, 'hi', 'A'), lmk(3, 2, 'pair', 'E')] },
        play: [{ l: 'A en de kwint', n: 'A2 E3' }, { l: 'Samen', n: 'A2 E3', c: true }] },
      { t: 'Powerchords',
        p: ['Een powerchord zoals A5 is grondtoon, kwint en octaaf: A, E en A. Die tonen zitten allemaal al in de boventonen van de lage A. Daarom blijft een powerchord strak klinken, ook met veel distortion.', 'Wat ontbreekt, is de terts: de toon die een akkoord blij (majeur) of verdrietig (mineur) maakt. Je leert hem in les 2. Met distortion wordt een terts snel modderig, en zonder terts klinkt een powerchord neutraal en stevig.'],
        neck: { from: 3, to: 9, marks: [lmk(5, 5, 'hi', 'A'), lmk(4, 7, 'pair', 'E'), lmk(3, 7, '', 'A')] },
        play: [{ l: 'A5', n: 'A2 E3 A3', c: true }],
        tip: 'Luister naar het begin van Smells Like Teen Spirit van Nirvana: de riff bestaat uit powerchords. Elk akkoord apart is niet blij en niet verdrietig. De donkere sfeer komt uit de volgorde van de akkoorden.' },
      { t: 'Twaalf kwinten',
        p: ['Begin op C en ga telkens een kwint omhoog: C, G, D, A, E, B, F♯, C♯, G♯, D♯, A♯, E♯ en dan B♯. E♯ klinkt als F en B♯ als C.', 'Na twaalf stappen ben je terug bij C, zeven octaven hoger, en je bent elke toon precies één keer tegengekomen. Zo ontstaan de twaalf tonen. Dit rondje heet de kwintencirkel; in les 4 kom je hem weer tegen.', 'Elke toon kan twee namen hebben. Een ♭ (mol) maakt een toon een halve toon lager: F♯ is ook G♭, en F♭ is gewoon E. Twee namen voor dezelfde toon heten enharmonisch.'],
        play: [{ l: 'Kwinten stapelen vanaf C', n: 'C3 G3 D4 A4 E5' }] },
      { t: 'Het foutje en de oplossing',
        p: ['Helemaal precies klopt het niet. Twaalf zuivere kwinten (1,5¹² ≈ 129,7) zijn iets meer dan zeven octaven (2⁷ = 128). Het verschil is ongeveer een vierde van een halve toon en heet de komma van Pythagoras.', 'Moderne instrumenten verdelen dat foutje over alle twaalf stappen: elke halve toon is dezelfde verhouding van ongeveer 1,06. Dat heet de gelijkzwevende stemming. Elke kwint is daardoor een fractie te klein, maar dat hoor je niet. Zo kun je in elke toonsoort spelen.', 'Je frets zijn er precies op geplaatst: elke fret maakt de snaar ongeveer 6% korter. Daarom liggen ze richting de body steeds dichter bij elkaar.'] },
      { t: 'Wat heb je hieraan?',
        p: ['De kwint is het skelet van bijna alles wat nog komt: toonsoorten, de kwintencirkel, en waarom het akkoord op de vijfde trap zo graag terug wil naar het eerste. Wie de kwint leert horen, hoort de bouw van een nummer.'],
        tip: 'Neurie het begin van Altijd is Kortjakje ziek. De sprong van “Altijd” naar “is” is een kwint omhoog. Neurie daarna een willekeurige toon en zing de kwint erboven.' },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 2
  { lesson: 2, topic: 'intervals', title: 'Intervallen', subtitle: 'Namen, halve tonen en hoe ze klinken',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: het octaaf is 2:1 en de kwint 3:2. Op de hals ligt het octaaf twee snaren hoger en twee frets verder, de kwint één snaar hoger en twee frets verder.', 'Deze week geef je elke afstand tussen twee tonen een naam, en leer je hoe hij klinkt.'] },
      { t: 'Afstand in halve tonen',
        p: ['Een interval is de afstand tussen twee tonen. Op de gitaar tel je die in frets: één fret is een halve toon, twee frets een hele toon.', 'Van C naar E op de A-snaar is fret 3 naar fret 7: vier halve tonen. Dat interval heet een grote terts.'],
        neck: { from: 0, to: 9, highlight: [4], marks: [lmk(4, 3, 'hi', 'C'), lmk(4, 4, '', '1'), lmk(4, 5, '', '2'), lmk(4, 6, '', '3'), lmk(4, 7, 'pair', 'E')] },
        play: [{ l: 'C naar E', n: 'C3 E3' }] },
      { t: 'De namen',
        p: ['Elk aantal halve tonen heeft een naam. Die naam telt letters, in het Latijn: secunde is 2, terts 3, kwart 4, kwint 5, sext 6, septiem 7 en octaaf 8. Van C naar E is C, D, E: drie letters, dus een terts.', 'Bij de meeste intervallen hoort een liedje dat ermee begint. Tik op een getal om het interval vanaf C te horen.'],
        table: { h: ['Halve tonen', 'Interval', 'Begin van'], r: [['1', 'kleine secunde', 'Jaws'], ['2', 'grote secunde', 'Vader Jacob'], ['3', 'kleine terts', 'Smoke on the Water'], ['4', 'grote terts', 'When the Saints'], ['5', 'reine kwart', 'het Wilhelmus'], ['6', 'tritonus', 'The Simpsons'], ['7', 'reine kwint', 'Star Wars (de lange tonen)'], ['8', 'kleine sext', '–'], ['9', 'grote sext', 'My Bonnie'], ['10', 'kleine septiem', 'Somewhere (West Side Story)'], ['11', 'grote septiem', '–'], ['12', 'octaaf', 'Somewhere over the Rainbow']] },
        play: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => ({ l: String(k), n: `C3 ${['C#3', 'D3', 'Eb3', 'E3', 'F3', 'F#3', 'G3', 'Ab3', 'A3', 'Bb3', 'B3', 'C4'][k - 1]}`, chip: true })) },
      { t: 'Klein of groot',
        p: ['Secunden, tertsen, sexten en septiemen bestaan in twee maten: klein en groot. Ze schelen één fret.', 'De terts is de belangrijkste: hij beslist of iets blij of donker klinkt. C met E (grote terts) klinkt open en helder, C met E♭ (kleine terts) donker. Dat verschil hoor je terug in majeur- en mineurakkoorden.'],
        play: [{ l: 'Grote terts', n: 'C3 E3' }, { l: 'Kleine terts', n: 'C3 Eb3' }, { l: 'C majeur', n: 'C3 E3 G3', c: true }, { l: 'C mineur', n: 'C3 Eb3 G3', c: true }] },
      { t: 'Rein: kwart, kwint en octaaf',
        p: ['Kwart, kwint en octaaf heten rein. Ze klinken zo stabiel dat er maar één goede maat van bestaat.', 'Precies tussen de kwart en de kwint ligt de tritonus: zes halve tonen, drie hele tonen. Hij klinkt onrustig en wil ergens heen. In blues en metal wordt hij juist opgezocht.'],
        play: [{ l: 'Kwart', n: 'C3 F3' }, { l: 'Tritonus', n: 'C3 F#3' }, { l: 'Kwint', n: 'C3 G3' }, { l: 'Octaaf', n: 'C3 C4' }],
        tip: 'Het nummer Black Sabbath, van de gelijknamige band, is opgebouwd rond een tritonus. Luister hoe dreigend dat klinkt.' },
      { t: 'Omkeren',
        p: ['Een kwart omhoog en een kwint omlaag komen op dezelfde noot uit, een octaaf uit elkaar: 5 + 7 = 12. Zulke paren heten elkaars omkering.', 'Een terts omkeren geeft een sext (3 + 9 en 4 + 8), een secunde geeft een septiem (2 + 10 en 1 + 11). Klein wordt groot en groot wordt klein.', 'Handig op de hals: zoek je een grote sext omhoog, dan kun je ook een kleine terts omlaag spelen.'] },
      { t: 'Vormen op de hals',
        p: ['Elk interval heeft een vaste vorm. Op de hals staat k3 voor kleine terts, g3 voor grote terts en 8 voor het octaaf. Vanaf de C op de A-snaar, fret 3:'],
        list: ['kleine terts: één snaar hoger, twee frets terug', 'grote terts: één snaar hoger, één fret terug', 'kwart: één snaar hoger, zelfde fret', 'kwint: één snaar hoger, twee frets verder', 'octaaf: twee snaren hoger, twee frets verder', 'over de B-snaar heen: één fret verder, want van de G- naar de B-snaar zijn het maar vier halve tonen in plaats van vijf'],
        neck: { from: 0, to: 7, marks: [lmk(4, 3, 'hi', 'C'), lmk(3, 1, '', 'k3'), lmk(3, 2, '', 'g3'), lmk(3, 3, '', '4'), lmk(3, 5, 'pair', '5'), lmk(2, 5, 'pair', '8')] },
        play: [{ l: 'C, k3, g3, kwart, kwint, octaaf', n: 'C3 Eb3 E3 F3 G3 C4' }] },
      { t: 'Intervallen horen',
        p: ['Onthoud bij elk interval één liedje. Zing het begin in je hoofd, dan weet je hoe groot de sprong is.', 'Oefen het met de Gehoortraining bij Oefenen: de app speelt twee tonen en jij kiest het interval. Begin met de twee tertsen, de kwart en de kwint.'],
        tip: 'Neurie een toon. Zing daarna de grote terts erboven, zoals in When the Saints, en dan de kwint, zoals in de lange tonen van Star Wars.' },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 3
  { lesson: 3, topic: 'major-scale', title: 'De majeurtoonladder', subtitle: 'De trappen, en waarom 7 naar 1 trekt',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: een interval is een afstand in halve tonen. Een grote terts is 4, een kwint 7.', 'Deze week kies je zeven tonen uit de twaalf: de majeurtoonladder. Je ziet hoe hij in elkaar zit en waarom de ene toon rust geeft en de andere spanning.'] },
      { t: 'Zeven uit twaalf',
        p: ['Een toonladder is een keuze uit de twaalf tonen. De majeurtoonladder kiest er zeven, altijd met hetzelfde patroon van hele (H) en halve (h) stappen: H H h H H H h.', 'Vanaf C geeft dat C D E F G A B C: alleen de witte toetsen van een piano. Op één snaar zie je het patroon meteen, zoals hierboven op de B-snaar: twee frets, twee frets, één fret, enzovoort.'],
        neck: { from: 0, to: 13, highlight: [1], marks: [lmk(1, 1, 'hi', 'C'), lmk(1, 3, '', 'D'), lmk(1, 5, '', 'E'), lmk(1, 6, '', 'F'), lmk(1, 8, '', 'G'), lmk(1, 10, '', 'A'), lmk(1, 12, '', 'B'), lmk(1, 13, 'hi', 'C')] },
        play: [{ l: 'C majeur', n: 'C4 D4 E4 F4 G4 A4 B4 C5' }] },
      { t: 'Trappen in plaats van namen',
        p: ['Elke toon krijgt een nummer: de trap. Trap 1 is de grondtoon, waar de muziek thuiskomt, en trap 8 is weer de grondtoon, een octaaf hoger. Het handige van trappen is dat ze in elke toonsoort werken: trap 5 is in C een G en in A een E.', 'Muzikanten praten vaak in trappen, omdat een melodie of akkoordenschema dan in elke toonsoort hetzelfde blijft.'],
        table: { h: ['Trap', 'C majeur', 'G majeur', 'A majeur'], r: [['1', 'C', 'G', 'A'], ['2', 'D', 'A', 'B'], ['3', 'E', 'B', 'C♯'], ['4', 'F', 'C', 'D'], ['5', 'G', 'D', 'E'], ['6', 'A', 'E', 'F♯'], ['7', 'B', 'F♯', 'G♯']] } },
      { t: 'De twee halve stappen',
        p: ['De halve stappen zitten tussen trap 3 en 4 en tussen trap 7 en 8. In C majeur zijn dat E naar F en B naar C: precies de plekken waar op de piano geen zwarte toets tussen zit.', 'Die twee halve stappen geven de majeurtoonladder zijn karakter. Liggen ze ergens anders, dan krijg je een andere toonladder, zoals mineur in les 5.'],
        table: { h: ['Trap', 'In C', 'Stap naar de volgende'], r: [['1', 'C', 'heel'], ['2', 'D', 'heel'], ['3', 'E', 'half'], ['4', 'F', 'heel'], ['5', 'G', 'heel'], ['6', 'A', 'heel'], ['7', 'B', 'half']] } },
      { t: 'Rust en spanning',
        p: ['Niet elke trap voelt hetzelfde. Trap 1 is rust. Trap 3 en 5 passen er stevig bij: samen met 1 vormen ze het majeurakkoord. Trap 5 heet ook de dominant: na de grondtoon de belangrijkste toon. Trap 2, 4, 6 en 7 willen ergens naartoe.', 'De sterkste trek heeft trap 7. Hij ligt maar een halve toon onder de grondtoon, en je oor wil hem daar laten landen. Daarom heet hij de leidtoon. Ook trap 4 leunt naar de 3 eronder.'],
        play: [{ l: 'Tot trap 7…', n: 'C3 D3 E3 F3 G3 A3 B3' }, { l: '…en dan 8', n: 'B3 C4' }],
        tip: 'Zing de toonladder omhoog en stop op trap 7. Voel je hoe hij door wil naar de grondtoon?' },
      { t: 'Elke toonsoort hetzelfde patroon',
        p: ['Begin je de majeurtoonladder op G, dan moet je één toon aanpassen om het patroon te houden: F wordt F♯. Anders klopt de laatste halve stap niet.', 'Zo krijgt elke majeurtoonsoort zijn eigen kruisen of mollen. In les 4 zie je hoe dat precies werkt. Hierboven staat G majeur in één octaaf, vanaf de lage E-snaar.'],
        neck: { from: 0, to: 7, marks: [lmk(5, 3, 'hi', 'G'), lmk(5, 5, '', 'A'), lmk(4, 2, '', 'B'), lmk(4, 3, '', 'C'), lmk(4, 5, '', 'D'), lmk(3, 2, '', 'E'), lmk(3, 4, 'pair', 'F♯'), lmk(3, 5, 'hi', 'G')] },
        play: [{ l: 'G majeur', n: 'G2 A2 B2 C3 D3 E3 F#3 G3' }] },
      { t: 'Luisteren',
        p: ['Do-Re-Mi uit The Sound of Music zingt de trappen van de majeurtoonladder één voor één. Joy to the World begint met de hele toonladder omlaag, van 8 naar 1.', 'Zing een nummer dat je goed kent en let op de laatste toon van het refrein. Vaak is dat de grondtoon, trap 1: daar komt het nummer thuis.'] },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 4
  { lesson: 4, topic: 'keys-circle', title: 'Toonsoorten', subtitle: 'Voortekens en de kwintencirkel',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: de majeurtoonladder volgt H H h H H H h. In G majeur wordt F een F♯ om dat patroon te houden.', 'Deze week zie je welke toonsoort welke kruisen of mollen krijgt, en waarom dat zo logisch is.'] },
      { t: 'Wat is een toonsoort?',
        p: ['Een toonsoort zegt twee dingen: welke toon thuis is, de grondtoon, en welke zeven tonen je gebruikt. Een nummer in G majeur gebruikt de tonen van de G-majeurtoonladder en komt thuis op G.', 'De kruisen of mollen van een toonsoort heten de voortekens. Ze staan aan het begin van elke notenbalk, zodat je ze niet bij elke noot hoeft te schrijven. Samen heten ze de voortekening.'] },
      { t: 'Een kwint omhoog, één kruis erbij',
        p: ['Ga vanaf C een kwint omhoog en je komt bij G: één kruis. Nog een kwint omhoog: D, twee kruisen. Zo gaat het door: elke stap een kwint hoger geeft één kruis erbij.', 'Het nieuwe kruis is steeds trap 7, de leidtoon. In G is dat F♯; in D komt C♯ erbij.'],
        table: { h: ['Toonsoort', 'Kruisen', 'Welke'], r: [['C', '0', '–'], ['G', '1', 'F♯'], ['D', '2', 'F♯ C♯'], ['A', '3', 'F♯ C♯ G♯'], ['E', '4', 'F♯ C♯ G♯ D♯'], ['B', '5', 'F♯ C♯ G♯ D♯ A♯']] } },
      { t: 'Een kwint omlaag, één mol erbij',
        p: ['De andere kant op werkt het net zo. Een kwint omlaag vanaf C is F: één mol, B♭. Daarna B♭ met twee mollen, E♭ met drie en A♭ met vier.', 'De nieuwe mol is steeds trap 4 van de nieuwe toonsoort. Trucje: vanaf twee mollen is de voorlaatste mol de naam van de toonsoort. B♭ E♭ A♭ is dus E♭ majeur.'],
        table: { h: ['Toonsoort', 'Mollen', 'Welke'], r: [['F', '1', 'B♭'], ['B♭', '2', 'B♭ E♭'], ['E♭', '3', 'B♭ E♭ A♭'], ['A♭', '4', 'B♭ E♭ A♭ D♭']] } },
      { t: 'De volgorde onthouden',
        p: ['Kruisen komen er altijd in dezelfde volgorde bij: F C G D A E B. Mollen in precies de omgekeerde volgorde: B E A D G C F.', 'De mollenrij begint met het woord BEAD. Onthoud BEAD-GCF, en lees hem achterstevoren voor de kruisen.'] },
      { t: 'De kwintencirkel', circle: true,
        p: ['Zet alle toonsoorten in een kring, telkens een kwint verder, en je hebt de kwintencirkel. Rechtsom komt er steeds een kruis bij, linksom een mol. Onderaan ontmoeten ze elkaar: F♯ en G♭ klinken hetzelfde.', 'In de binnenring staan de mineurtoonsoorten met dezelfde voortekens. Daarover gaat les 5.'] },
      { t: 'Buren zijn familie',
        p: ['Toonsoorten die naast elkaar liggen, verschillen maar één toon. Daarom klinkt een overgang tussen buren zo natuurlijk.', 'Kijk naar C: links ligt F, rechts G. Dat zijn precies trap 4 en 5 van C, de belangrijkste akkoorden naast C zelf. Een blues in A gebruikt A, D en E: ook buren in de cirkel.'] },
      { t: 'Gitaartoonsoorten',
        p: ['De open snaren van je gitaar zijn E, A, D, G, B en E. Daarom liggen toonsoorten met kruisen, zoals E, A, D en G, zo lekker op de gitaar. Veel rock en blues staat in E of A.', 'Blazers spelen liever in toonsoorten met mollen, zoals F, B♭ en E♭. Speel je met blazers, zoals in soul en jazz, dan kom je die toonsoorten vaker tegen.'] },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 5
  { lesson: 5, topic: 'minor', title: 'Mineur', subtitle: 'Natuurlijk, harmonisch en melodisch',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: elke majeurtoonsoort heeft zijn eigen voortekens, en buren in de kwintencirkel schelen één toon. In de binnenring stonden de mineurtoonsoorten.', 'Daar gaat deze les over: mineur, in drie smaken.'] },
      { t: 'Zelfde tonen, ander thuis',
        p: ['Speel de tonen van C majeur, maar begin en eindig op A: A B C D E F G A. Dat is A natuurlijk mineur. Er komt geen enkele nieuwe toon bij, en toch klinkt het opeens donker.', 'Het verschil zit in waar thuis is. A mineur is de relatieve mineur van C majeur: zelfde tonen, zelfde voortekens, ander middelpunt. Je vindt hem op trap 6 van majeur, of een kleine terts onder de grondtoon.'],
        neck: { from: 2, to: 9, marks: [lmk(5, 5, 'hi', 'A'), lmk(5, 7, '', 'B'), lmk(4, 3, '', 'C'), lmk(4, 5, '', 'D'), lmk(4, 7, '', 'E'), lmk(3, 3, '', 'F'), lmk(3, 5, '', 'G'), lmk(3, 7, 'hi', 'A')] },
        play: [{ l: 'C majeur', n: 'C3 D3 E3 F3 G3 A3 B3 C4' }, { l: 'A mineur', n: 'A2 B2 C3 D3 E3 F3 G3 A3' }] },
      { t: 'Het patroon van mineur',
        p: ['Natuurlijk mineur volgt H h H H h H H. Vergeleken met majeur op dezelfde grondtoon liggen drie trappen een halve toon lager: de 3, de 6 en de 7.', 'Die kleine terts is het belangrijkst: hij maakt een toonladder of akkoord mineur. Je schrijft hem als ♭3: trap 3, een halve toon lager.'],
        table: { h: ['Trap', '1', '2', '3', '4', '5', '6', '7'], r: [['A majeur', 'A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'], ['A mineur', 'A', 'B', 'C', 'D', 'E', 'F', 'G']] },
        play: [{ l: 'A majeur', n: 'A2 B2 C#3 D3 E3 F#3 G#3 A3' }, { l: 'A mineur', n: 'A2 B2 C3 D3 E3 F3 G3 A3' }] },
      { t: 'Mineur in de muziek',
        p: ['Losing My Religion van R.E.M. staat in A mineur, Nothing Else Matters van Metallica in E mineur. Ook de bekende intro van Stairway to Heaven staat in A mineur.', 'De mineurpentatoniek, de toonladder van heel veel rock- en bluessolo’s, is natuurlijk mineur zonder de 2 en de 6. Je kunt hem al proberen bij Toonladders onder Oefenen.'] },
      { t: 'Harmonisch mineur',
        p: ['Natuurlijk mineur heeft geen leidtoon: G ligt een hele toon onder A en trekt dus minder. Harmonisch mineur verhoogt daarom trap 7: G wordt G♯.', 'Nu wordt het akkoord op trap 5 E majeur in plaats van Em, en dat trekt heel sterk naar A mineur. Vaak hoor je er E7 van, die leer je in les 6. Bijwerking: tussen F en G♯ zit een sprong van drie halve tonen. Die geeft harmonisch mineur zijn oosterse, wat dramatische klank.'],
        play: [{ l: 'A harmonisch mineur', n: 'A2 B2 C3 D3 E3 F3 G#3 A3' }, { l: 'E naar Am', ch: ['E2 B2 E3 G#3', 'A2 E3 A3 C4'] }],
        tip: 'In Hotel California van de Eagles, in B mineur, is het akkoord op trap 5 F♯ majeur in plaats van F♯ mineur. De A♯ in dat akkoord is de verhoogde 7.' },
      { t: 'Melodisch mineur',
        p: ['Melodisch mineur lost die rare sprong op door ook trap 6 te verhogen: F wordt F♯. Omhoog speel je dan A B C D E F♯ G♯ A: mineur onderin, majeur bovenin.', 'In de klassieke muziek speel je hem omlaag weer als natuurlijk mineur. In de jazz gebruik je hem beide kanten op.'],
        play: [{ l: 'A melodisch mineur', n: 'A2 B2 C3 D3 E3 F#3 G#3 A3' }] },
      { t: 'Welke wanneer?',
        list: ['Natuurlijk mineur: het meeste in rock, pop en folk, en de basis van de mineurpentatoniek.', 'Harmonisch mineur: voor het majeurakkoord op trap 5, en voor een dramatische of oosterse kleur, ook in metal.', 'Melodisch mineur: vooral jazz, en melodieën die soepel omhoog lopen.'],
        p: [],
        tip: 'Luister naar een nummer in mineur en let op het akkoord vlak voor het slot. Is dat een majeurakkoord op trap 5, dan hoor je harmonisch mineur.' },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 6
  { lesson: 6, topic: 'chord-building', title: 'Akkoorden bouwen', subtitle: 'Drieklanken en septiemakkoorden',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: mineur heeft een kleine terts, en harmonisch mineur verhoogt de 7 voor een leidtoon.', 'Deze week bouw je zelf akkoorden. En dan blijkt die terts weer alles te beslissen.'] },
      { t: 'Tertsen stapelen',
        p: ['Een akkoord is een stapel tertsen. Neem een toon uit de toonladder, sla de volgende over en neem die daarna: C, (D), E, (F), G. Dat is een drieklank met grondtoon (1), terts (3) en kwint (5).', 'Op de gitaar speel je vaak meer dan drie snaren. Dan verdubbel je gewoon tonen: een open C-akkoord is C, E, G, C, E.'],
        play: [{ l: 'C, E, G', n: 'C3 E3 G3' }, { l: 'Samen', n: 'C3 E3 G3', c: true }] },
      { t: 'Vier soorten drieklanken',
        p: ['Er zijn twee soorten tertsen: klein (3 halve tonen) en groot (4). Twee tertsen stapelen kan dus op vier manieren.'],
        table: { h: ['Soort', 'Tertsen', 'Trappen', 'Vanaf C'], r: [['majeur', 'groot + klein', '1 3 5', 'C E G'], ['mineur', 'klein + groot', '1 ♭3 5', 'C E♭ G'], ['verminderd', 'klein + klein', '1 ♭3 ♭5', 'C E♭ G♭'], ['overmatig', 'groot + groot', '1 3 ♯5', 'C E G♯']] },
        play: [{ l: 'Majeur', n: 'C3 E3 G3', c: true }, { l: 'Mineur', n: 'C3 Eb3 G3', c: true }, { l: 'Verminderd', n: 'C3 Eb3 Gb3', c: true }, { l: 'Overmatig', n: 'C3 E3 G#3', c: true }] },
      { t: 'De terts beslist',
        p: ['Majeur en mineur verschillen maar in één toon: de terts. De kwint is het stevige fundament, de terts geeft de kleur. Een powerchord heeft geen terts en is daarom neutraal.', 'Kijk naar open A en open Am: alleen de B-snaar verschilt. Fret 2 is C♯, de grote terts. Fret 1 is C, de kleine terts.', 'Vervang je de terts door een kwart, dan krijg je sus4: zwevend, alsof het akkoord nog moet kiezen.'],
        neck: { from: 0, to: 5, marks: [lmk(4, 0, 'hi', 'A'), lmk(3, 2, '', 'E'), lmk(2, 2, '', 'A'), lmk(1, 1, 'pair', 'C'), lmk(1, 2, 'acc', 'C♯'), lmk(0, 0, '', 'E')] },
        play: [{ l: 'A', n: 'A2 E3 A3 C#4 E4', c: true }, { l: 'Am', n: 'A2 E3 A3 C4 E4', c: true }, { l: 'Asus4 naar A', ch: ['A2 E3 A3 D4 E4', 'A2 E3 A3 C#4 E4'] }] },
      { t: 'Septiemakkoorden',
        p: ['Zet er nog een terts bovenop en je hebt een septiemakkoord: vier tonen. De septiem maakt een akkoord rijker, en vaak ook onrustiger.', 'Groot 7 heeft een grote septiem, de andere drie een kleine. Halfverminderd is een verminderd akkoord met een kleine septiem erbij.'],
        table: { h: ['Naam', 'Symbool', 'Trappen', 'Vanaf C'], r: [['groot 7', 'Cmaj7', '1 3 5 7', 'C E G B'], ['dominant 7', 'C7', '1 3 5 ♭7', 'C E G B♭'], ['mineur 7', 'Cm7', '1 ♭3 5 ♭7', 'C E♭ G B♭'], ['halfverminderd', 'Cm7♭5', '1 ♭3 ♭5 ♭7', 'C E♭ G♭ B♭']] },
        play: [{ l: 'Cmaj7', n: 'C3 E3 G3 B3', c: true }, { l: 'C7', n: 'C3 E3 G3 Bb3', c: true }, { l: 'Cm7', n: 'C3 Eb3 G3 Bb3', c: true }, { l: 'Cm7♭5', n: 'C3 Eb3 Gb3 Bb3', c: true }] },
      { t: 'Hoe ze klinken',
        p: ['Elk septiemakkoord heeft zijn eigen kleur:'],
        list: ['maj7: zacht en dromerig, veel in soul en ballads', '7: bluesy en onaf, hij wil verder. In de blues is vaak elk akkoord een 7, zoals A7, D7 en E7', 'm7: warm en soulvol, veel in funk', 'm7♭5: donker en gespannen, vooral in jazz'],
        play: [{ l: 'C, Cmaj7, C7', ch: ['C3 E3 G3 C4', 'C3 E3 G3 B3', 'C3 E3 G3 Bb3'] }],
        tip: 'Het couplet van Something van The Beatles begint met C, Cmaj7 en C7, net als dit voorbeeld: één toon in het akkoord zakt telkens een halve toon, van C via B naar B♭.' },
      { t: 'Akkoordnamen lezen',
        p: ['Een 7 zonder “maj” betekent een kleine septiem. C7 heeft dus een B♭, Cmaj7 een B.'],
        list: ['C: C majeur', 'Cm: C mineur', 'C° of Cdim: C verminderd', 'C+ of Caug: C overmatig', 'Cmaj7: groot 7', 'C7: dominant 7', 'Cm7: mineur 7', 'Cm7♭5 of Cø: halfverminderd', 'Csus4: kwart in plaats van terts'] },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 7
  { lesson: 7, topic: 'diatonic-chords', title: 'Akkoorden in een toonsoort', subtitle: 'Trappen, Romeinse cijfers en functies',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: een akkoord is een stapel tertsen. Grote plus kleine terts is majeur, kleine plus grote is mineur.', 'Deze week stapel je tertsen met alleen de tonen van één toonladder. Zo krijg je de akkoorden die bij een toonsoort horen.'] },
      { t: 'Een akkoord op elke trap',
        p: ['Neem C majeur en stapel op elke trap twee tertsen, met alleen tonen uit C majeur. Je krijgt zeven akkoorden die bij elkaar horen.'],
        table: { h: ['Trap', 'Tonen', 'Akkoord'], r: [['1', 'C E G', 'C'], ['2', 'D F A', 'Dm'], ['3', 'E G B', 'Em'], ['4', 'F A C', 'F'], ['5', 'G B D', 'G'], ['6', 'A C E', 'Am'], ['7', 'B D F', 'B°']] },
        play: [{ l: 'Alle zeven', ch: ['C3 E3 G3', 'D3 F3 A3', 'E3 G3 B3', 'F3 A3 C4', 'G3 B3 D4', 'A3 C4 E4', 'B3 D4 F4'] }] },
      { t: 'Romeinse cijfers',
        p: ['Muzikanten schrijven die akkoorden met Romeinse cijfers. Een hoofdletter is majeur, een kleine letter mineur en ° verminderd.', 'Het patroon is in elke majeurtoonsoort hetzelfde: I ii iii IV V vi vii°.'],
        table: { h: ['', 'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], r: [['C', 'C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'], ['G', 'G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°'], ['A', 'A', 'Bm', 'C♯m', 'D', 'E', 'F♯m', 'G♯°']] } },
      { t: 'Waarom cijfers handig zijn',
        p: ['Met cijfers speel je een nummer in elke toonsoort. I–IV–V is in A: A, D en E. In E is het E, A en B.', 'Zegt een bandlid “naar de vier”, dan weet je meteen welk akkoord. En wil de zanger het lager, dan blijven de cijfers gewoon hetzelfde.'] },
      { t: 'Thuis, weg en spanning',
        p: ['Elk akkoord heeft een rol. I is de tonica: thuis, rust. IV is de subdominant: weg van huis, beweging. V is de dominant: spanning die terug wil naar I.', 'Veel nummers zijn een reisje: je vertrekt van huis, gaat op pad, de spanning loopt op en je komt weer thuis.'],
        play: [{ l: 'I – IV – V – I', ch: ['C3 E3 G3', 'C3 F3 A3', 'B2 D3 G3', 'C3 E3 G3'] }] },
      { t: 'De vervangers',
        p: ['De mineurakkoorden lijken op de grote drie. Am deelt twee tonen met C (C en E) en klinkt als een donkere versie van thuis. Dm deelt twee tonen met F en doet hetzelfde werk als IV.', 'Daarom kun je ze vaak verwisselen. I–vi–IV–V (in C: C, Am, F, G) is een beroemd voorbeeld. Stand By Me van Ben E. King gebruikt het in A: A, F♯m, D, E.'],
        play: [{ l: 'C – Am – F – G', ch: ['C3 E3 G3', 'C3 E3 A3', 'C3 F3 A3', 'B2 D3 G3'] }] },
      { t: 'Het V7-akkoord',
        p: ['Zet een kleine septiem op het V-akkoord en je krijgt G7: G, B, D en F. Daarin zitten twee tonen die naar het C-akkoord willen. B, de leidtoon, gaat een halve toon omhoog naar C. F zakt een halve toon naar E. Samen vormen B en F een tritonus: daar zit de spanning.', 'Die dubbele trek maakt V7 naar I het sterkste slot dat er is.'],
        play: [{ l: 'G7 naar C', ch: ['G2 B2 D3 F3', 'C3 E3 G3'] }] },
      { t: 'In mineur',
        p: ['In A mineur geeft het stapelen: Am, B°, C, Dm, Em, F en G (i ii° III iv v VI VII). Vaak wordt v een majeurakkoord, E of E7, dankzij harmonisch mineur.', 'Rock gebruikt graag i–VII–VI: in A mineur is dat Am, G, F. Luister maar naar All Along the Watchtower, van Bob Dylan of in de versie van Jimi Hendrix: het hele nummer draait om dat rondje.'],
        play: [{ l: 'Am – G – F', ch: ['A2 E3 A3 C4', 'G2 D3 G3 B3', 'F2 C3 F3 A3'] }] },
      { t: 'Onthoud', sum: true, p: [LES_DONE] },
    ] },
  // ---------------------------------------------------------------- les 8
  { lesson: 8, topic: 'progressions', title: 'Progressies', subtitle: 'I–IV–V, ii–V–I en de 12-maten blues',
    cards: [
      { t: 'Terugblik',
        p: ['Vorige keer: elke trap heeft een akkoord, met een Romeins cijfer. I is thuis, IV weg van huis en V de spanning.', 'Deze week zie je de akkoordenschema’s die je in duizenden nummers hoort.'] },
      { t: 'I – IV – V',
        p: ['Met alleen I, IV en V speel je al eindeloos veel nummers. Twist and Shout, La Bamba en Three Little Birds van Bob Marley zijn er voorbeelden van.', 'In A is dat A, D en E. In E is het E, A en B. Voor gitaar zijn dat ideale toonsoorten.'],
        play: [{ l: 'A – D – E – A', ch: ['A2 C#3 E3 A3', 'A2 D3 F#3 A3', 'B2 E3 G#3 B3', 'A2 C#3 E3 A3'] }] },
      { t: 'De 12-maten blues',
        p: ['De blues gebruikt ook alleen I, IV en V, in een vaste vorm van twaalf maten. Elk akkoord is meestal een dominant 7.', 'Vaak speel je in maat 12 al V, als opstapje terug naar het begin.'],
        table: { h: ['Maten', '1e', '2e', '3e', '4e'], r: [['1 t/m 4', 'I', 'I', 'I', 'I'], ['5 t/m 8', 'IV', 'IV', 'I', 'I'], ['9 t/m 12', 'V', 'IV', 'I', 'I']] },
        tip: 'In A wordt dat A7, D7 en E7. Hoor het in Pride and Joy van Stevie Ray Vaughan of in Johnny B. Goode van Chuck Berry.' },
      { t: 'Het popschema: I – V – vi – IV',
        p: ['Dit schema hoor je in honderden popnummers. In C is het C, G, Am, F. Let It Be van The Beatles gebruikt het, With or Without You van U2 (D, A, Bm, G) en Someone Like You van Adele (A, E, F♯m, D).', 'Begin je op vi, dan klinkt hetzelfde rondje donkerder: vi–IV–I–V. Zombie van The Cranberries is daar een voorbeeld van.'],
        play: [{ l: 'C – G – Am – F', ch: ['C3 E3 G3', 'B2 D3 G3', 'C3 E3 A3', 'C3 F3 A3'] }] },
      { t: 'ii – V – I: de kern van jazz',
        p: ['In jazz hoor je steeds ii–V–I, meestal met septiemakkoorden: Dm7, G7, Cmaj7. De grondtonen zakken telkens een kwint: D, G, C. Zo loop je de kwintencirkel af, terug naar huis.', 'In het voorbeeld gaat de laatste stap een kwart omhoog. Dat komt op dezelfde noot uit als een kwint omlaag (les 2).', 'Autumn Leaves en Fly Me to the Moon zitten er vol mee.'],
        play: [{ l: 'Dm7 – G7 – Cmaj7', ch: ['D3 F3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3 B3'] }] },
      { t: 'Waarom dit werkt',
        p: ['Het geheim zit in drie dingen die je al kent. De grondtonen springen vaak een kwint (les 1). De akkoorden delen tonen, zodat elke toon maar een klein stapje hoeft te zetten naar het volgende akkoord (les 7). En V7 bouwt spanning op die in I oplost.', 'Spanning en ontspanning: dat is eigenlijk het hele verhaal van harmonie.'] },
      { t: 'Zelf herkennen',
        p: ['Drie vragen helpen je om de akkoorden van een nummer te herkennen:'],
        list: ['Zoek thuis: op welk akkoord eindigt het refrein? Meestal is dat I, of i als het nummer in mineur staat.', 'Gaat het weg van huis, maar zonder veel spanning? Grote kans dat het IV is.', 'Voelt het alsof het nummer naar huis wil? Grote kans dat het V is.'],
        tip: 'Zing de grondtoon mee onder een nummer en volg hem als het akkoord wisselt. Met Doeltonen bij Oefenen speel je met je gitaar over een blues of I–IV–V de terts van elk akkoord.' },
      { t: 'Onthoud', sum: true, p: ['Hiermee is de basis van fase 1 rond.', LES_DONE] },
    ] },
];

// ---------- Kwintencirkel als plaatje (les 4) ----------
function circleSvg() {
  const maj = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯/G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const min = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
  const sig = ['', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯ / 6♭', '5♭', '4♭', '3♭', '2♭', '1♭'];
  const at = (i, r) => { const a = (i * 30 - 90) * Math.PI / 180; return [(160 + r * Math.cos(a)).toFixed(1), (160 + r * Math.sin(a)).toFixed(1)]; };
  let g = '<circle class="cf-out" cx="160" cy="160" r="152"/><circle class="cf-in" cx="160" cy="160" r="86"/>';
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = at(i + 0.5, 86), [x2, y2] = at(i + 0.5, 152);
    g += `<line class="cf-div" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const [mx, my] = at(i, 126), [sx, sy] = at(i, 100), [nx, ny] = at(i, 62);
    g += `<text class="cf-maj${i === 0 ? ' home' : ''}" x="${mx}" y="${(Number(my) + 6).toFixed(1)}" text-anchor="middle">${maj[i]}</text>`;
    if (sig[i]) g += `<text class="cf-sig" x="${sx}" y="${(Number(sy) + 4).toFixed(1)}" text-anchor="middle">${sig[i]}</text>`;
    g += `<text class="cf-min${i === 0 ? ' home' : ''}" x="${nx}" y="${(Number(ny) + 5).toFixed(1)}" text-anchor="middle">${min[i]}</text>`;
  }
  g += '<text class="cf-arrow" x="160" y="156" text-anchor="middle">rechtsom ♯</text><text class="cf-arrow" x="160" y="172" text-anchor="middle">linksom ♭</text>';
  return `<svg class="circle5" viewBox="0 0 320 320" role="img" aria-label="Kwintencirkel: majeurtoonsoorten buiten, mineur binnen">${g}</svg>`;
}

// ---------- Geluid bij de les: noten, intervallen en akkoorden ----------
const Listen = {
  notes: s => s.trim().split(/\s+/).map(noteMidi).filter(m => m != null),
  play(sp) {
    let ctx;
    try { ctx = Engine.ensureCtx(); } catch (e) { return; }
    let t = ctx.currentTime + 0.06;
    if (sp.ch) {
      for (const c of sp.ch) { this.notes(c).forEach((m, i) => Engine.pluck(m, t + i * 0.03, 1.4, 0.5)); t += 1.05; }
      t += 0.5;
    } else if (sp.c) {
      this.notes(sp.n).forEach((m, i) => Engine.pluck(m, t + i * 0.035, 1.5, 0.55));
      t += 1.7;
    } else {
      const ns = this.notes(sp.n);
      ns.forEach((m, i) => Engine.pluck(m, t + i * 0.45, i === ns.length - 1 ? 1.3 : 0.6, 0.7));
      t += ns.length * 0.45 + 1;
    }
    Engine.block((t - ctx.currentTime) * 1000 + 150);
  },
};

// ---------- Kaartje naar een vraag in de lesspeler ----------
function cardItem(c, unit, i, n) {
  const sum = c.sum ? unitSummary(unit) : null;
  return { type: 'learn', prompt: c.t, text: c.p || [], neck: c.neck, big: c.big, circle: !!c.circle, table: c.table, list: sum || c.list, tip: c.tip, listen: c.play, kicker: `Les ${unit.lesson} · ${i + 1} van ${n}`, course: true };
}
