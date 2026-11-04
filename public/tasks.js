// Aufgabenpool Riga-Challenge
// Stufen: 1 = Leicht, 3 = Mittel, 5 = Hardcore (Zahl = Punkte)
// Eine Aufgabe ist ein Text oder { t: "Text", where: ["bar", "markt", "stadt", "outdoor"] }

// Orte: welche Kategorien das Rad dort zeigt (die erste kommt doppelt aufs Rad)
export const LOCATIONS = [
  { id: "bar", name: "Bar", icon: "🍺", cats: ["bar", "lettland", "geheim", "gruppe"] },
  { id: "markt", name: "Weihnachtsmarkt", icon: "🎄", cats: ["markt", "lettland", "geheim", "gruppe"] },
  { id: "outdoor", name: "Outdoor", icon: "🌲", cats: ["outdoor", "geheim", "gruppe"] },
  { id: "stadt", name: "Stadt", icon: "🏰", cats: ["stadt", "lettland", "geheim", "gruppe"] },
  { id: "alles", name: "Alles", icon: "🎲", cats: null },
];

export const CATEGORIES = [
  {
    id: "bar", name: "Bar", icon: "🍺", color: "#c2410c",
    tasks: {
      1: [
        "Bestell dein nächstes Getränk nur mit Gesten.",
        "Stoß mit jemandem aus einer anderen Gruppe an.",
        "Bestell auf Lettisch: „Vienu alu, lūdzu“ (ein Bier, bitte).",
        "Lass den Barkeeper dein nächstes Getränk aussuchen.",
        "Erzähl einen Witz, über den mindestens zwei aus der Gruppe lachen.",
        "Trink das nächste Getränk mit der schwächeren Hand.",
        "Mach ein Selfie mit dem Barkeeper.",
        "Finde heraus, wie lange es die Bar schon gibt.",
        "Bestell mit dem tiefsten Bariton, den du hinkriegst.",
        "Halte einen 30-Sekunden-Toast auf die Gruppe.",
      ],
      3: [
        "Trink einen Black Balsam, ohne das Gesicht zu verziehen.",
        "Lass dir vom Barkeeper einen lettischen Trinkspruch beibringen und bring ihn der Gruppe bei.",
        "Bestell mit einem erfundenen Akzent und bleib dabei, bis das Getränk da ist.",
        "Überzeug einen Fremden, mit der Gruppe ein Foto zu machen.",
        "Spiel 5 Minuten Kellner für die Gruppe.",
        "Erzähl einem Fremden eine komplett erfundene Lebensgeschichte und bleib 3 Minuten dabei.",
        "Bring einen Nachbartisch dazu, mit euch anzustoßen.",
        "Lern von einem Einheimischen drei lettische Wörter.",
        "Bestell eine Runde für die Gruppe mit einem selbstgereimten Gedicht.",
        "Lass dir von einem Fremden einen Spitznamen geben, der für den Rest des Abends gilt.",
        "Mach Armdrücken mit jemandem, der nicht aus der Gruppe ist.",
        "Steh eine ganze Runde lang auf einem Bein.",
      ],
      5: [
        "Halte eine 1-minütige Rede an die ganze Bar.",
        "Sing einen Refrain laut vor der ganzen Bar.",
        "Überzeug den Barkeeper, ein Getränk nach dir zu benennen (zählt, wenn er es aufschreibt).",
        "Tausch für den Rest des Abends ein Kleidungsstück mit einem Mitspieler.",
        "Organisier einen Shot für die Gruppe, ohne selbst zu zahlen (verhandelt, nicht geklaut).",
        "Bring einen Fremden dazu, eine Liebeserklärung an die Gruppe auf eine Serviette zu schreiben.",
        "Kommentiere 2 Minuten lang die Bar wie ein Fußballkommentator.",
        "Mach 20 Liegestütze mitten in der Bar.",
        "Starte in der Bar eine Polonaise mit mindestens 3 Fremden.",
      ],
    },
  },
  {
    id: "markt", name: "Weihnachtsmarkt", short: "Markt", icon: "🎄", color: "#15803d",
    tasks: {
      1: [
        "Mach ein Foto mit dem größten Weihnachtsbaum.",
        "Probier etwas, das du nicht aussprechen kannst.",
        "Kauf das hässlichste Souvenir unter 5 €.",
        "Trink einen Glühwein in unter 3 Minuten (Vorsicht, heiß).",
        "Finde etwas mit einem Elch drauf.",
        "Mach ein Gruppenfoto mit Weihnachtsmütze.",
        "Frag einen Verkäufer nach seinem Bestseller und kauf ihn.",
        "Mach einen Schneeengel (oder Pfützenengel, falls kein Schnee).",
      ],
      3: [
        "Sing mit der Gruppe eine Strophe „Last Christmas“ vor einem Glühweinstand.",
        "Lass dich von einem Fremden mit Weihnachtsmütze fotografieren.",
        "Handle an einem Stand mindestens 1 € runter.",
        "Mach einem Fremden ein ernst gemeintes, gut formuliertes Kompliment für sein Outfit.",
        "Trag für den Rest des Marktbesuchs etwas Weihnachtliches auf dem Kopf.",
        "Kauf für einen Mitspieler (Gruppe bestimmt) ein Wichtelgeschenk unter 5 €.",
        "Spiel 2 Minuten den Weihnachtsmann für vorbeigehende Leute.",
        "Lass dir von einem Verkäufer ein lettisches Weihnachtslied beibringen.",
      ],
      5: [
        "Sing alleine ein komplettes Weihnachtslied mitten auf dem Markt.",
        "Tanz 30 Sekunden vor einem Stand, gefilmt.",
        "Überzeug eine fremde Gruppe, mit euch ein Weihnachtslied zu singen.",
        "Trag den Rest des Tages das hässliche Souvenir sichtbar am Körper.",
        "Halte eine Weihnachtsansprache wie der Bundespräsident.",
        "Iss die komischste Spezialität des Marktes komplett auf.",
      ],
    },
  },
  {
    id: "outdoor", name: "Outdoor", short: "Outdoor", icon: "🌲", color: "#0369a1",
    tasks: {
      1: [
        "Gib dem ersten Tier, das du heute draußen triffst, einen Spitznamen.",
        "Mach das dramatischste Actionfoto des Tages.",
        "Mach einen Schneeengel (oder Pfützenengel, falls kein Schnee).",
        "Heul 10 Sekunden wie ein Wolf.",
        "Mach ein Selfie mit dem flauschigsten Lebewesen in der Nähe.",
        "Wirf einen Schneeball (oder Tannenzapfen) und triff einen Baum.",
        "Mach ein Foto, auf dem du genauso guckst wie ein Tier in deiner Nähe.",
        "Ruf beim nächsten Losgehen oder Losfahren laut „Auf geht's!“.",
      ],
      3: [
        "Stell das nächste Tier, das du siehst, der Gruppe vor wie bei einer Hochzeitsrede.",
        "Leg die nächsten 200 Meter mit durchgehendem Kampfschrei zurück.",
        "Frag einen Guide oder Einheimischen nach seinem verrücktesten Erlebnis und erzähl es abends nach.",
        "Kommentiere die nächste Fahrt (Bus, Taxi oder was auch immer) live wie Formel 1 (gefilmt).",
        "Mach einen Fotoshoot im Stil eines Polarforschers.",
        "Wette: Tipp, wer aus der Gruppe als Erstes über Kälte jammert. Liegst du richtig, trinken die anderen.",
        "Erklär der Gruppe 1 Minute lang, warum du in der Wildnis am längsten überleben würdest.",
        "Lass dir von einem Guide oder Einheimischen ein Kommando oder einen Trick beibringen und wende ihn an.",
      ],
      5: [
        "Lass dich für ein Foto komplett in den Schnee fallen.",
        "Halte 1 Minute lang eine Laudatio auf den mutigsten Mitspieler des Tages.",
        "Dreh ein 30-Sekunden-Musikvideo draußen, mit der ganzen Gruppe im Bild.",
        "Lass dich mit der Gruppe fotografieren und posiere wie ein König auf seinem Thron.",
        "Überrede einen Guide, dich etwas selbst machen zu lassen, das normalerweise nur er macht.",
        "Mach 10 Liegestütze im Schnee (oder auf kaltem Boden).",
      ],
    },
  },
  {
    id: "stadt", name: "Stadt", icon: "🏰", color: "#7c3aed",
    tasks: {
      1: [
        "Mach eine Heldenpose vor dem Schwarzhäupterhaus.",
        "Frag einen Einheimischen nach dem Weg zu einem Ort, den es nicht gibt.",
        "Lauf 2 Minuten wie ein Pinguin.",
        "Finde das Straßenschild mit dem längsten Wort.",
        "Mach ein Foto, auf dem du einen Kirchturm zu halten scheinst.",
        "Begrüß 5 Fremde mit „Labdien!“.",
        "Lass dir von einem Fremden einen Restaurant-Tipp geben.",
      ],
      3: [
        "Führ die Gruppe 5 Minuten als Stadtführer mit komplett erfundenen Fakten.",
        "Dreh eine 1-Minuten-Tierdoku über einen Mitspieler.",
        "Denk dir mit einem Fremden einen geheimen Handschlag aus.",
        "Kauf etwas im Supermarkt, ohne ein Wort zu sprechen.",
        "Lauf eine Straße lang rückwärts.",
        "Finde einen Einheimischen, der Deutsch spricht.",
        "Spiel Statue, bis jemand ein Foto macht.",
      ],
      5: [
        "Mach einem Mitspieler auf offener Straße einen Heiratsantrag, mit Kniefall.",
        "Sing an einer belebten Ecke, bis jemand klatscht.",
        "Mach 3 Minuten Pantomime auf dem Rathausplatz.",
        "Trag einen halben Tag ein Outfit, das die Gruppe dir aussucht (Budget 10 €).",
      ],
    },
  },
  {
    id: "lettland", name: "Typisch Lettland", short: "Lettland", icon: "🇱🇻", color: "#9f1239",
    tasks: {
      1: [
        { t: "Stoß heute bei jeder Runde mit „Priekā!“ an. Wer es vergisst, trinkt.", where: ["bar"] },
        { t: "Mach ein Foto mit den Bremer Stadtmusikanten und reib die Nase des Esels.", where: ["stadt"] },
        { t: "Finde die schwarzen Katzen auf dem Katzenhaus und stell ihre Pose nach.", where: ["stadt"] },
        { t: "Mach ein Gruppenfoto vor den Drei Brüdern.", where: ["stadt"] },
        { t: "Bedank dich heute 10 Mal mit „Paldies“ bei Einheimischen.", where: ["bar", "markt", "stadt"] },
        { t: "Probier ein Stück lettisches Roggenbrot.", where: ["markt", "stadt"] },
        { t: "Trink einen Kwas.", where: ["bar", "markt"] },
        { t: "Kauf Laima-Schokolade und verteil sie an die Gruppe.", where: ["markt", "stadt"] },
        { t: "Mach ein Foto unter der Laima-Uhr.", where: ["stadt"] },
        { t: "Finde die Plakette zum „ersten Weihnachtsbaum“ am Rathausplatz.", where: ["markt", "stadt"] },
      ],
      3: [
        { t: "Trink Black Balsam in einer Sorte, die die Gruppe wählt.", where: ["bar", "markt"] },
        { t: "Iss eine Portion Graue Erbsen mit Speck.", where: ["markt", "stadt"] },
        { t: "Bestell im Lido ein Gericht, das du nicht kennst, und iss es auf.", where: ["stadt"] },
        { t: "Kauf auf dem Zentralmarkt etwas Geräuchertes und lass die Gruppe blind probieren.", where: ["stadt"] },
        { t: "Lern die erste Zeile von „Dievs, svētī Latviju“ und sing sie einem Einheimischen vor.", where: ["bar", "markt", "stadt"] },
        { t: "Stell vor dem Freiheitsdenkmal die Pose von Milda nach.", where: ["stadt"] },
        { t: "Erklär oben auf dem Turm der Petrikirche 1 Minute lang die Aussicht wie ein Reiseführer.", where: ["stadt"] },
        { t: "Imitiere in der Albert-Straße die verrückteste Jugendstil-Fratze.", where: ["stadt"] },
        { t: "Frag einen Einheimischen nach dem besten lettischen Eishockeyteam und überzeug die Gruppe davon.", where: ["bar", "stadt"] },
        { t: "Bestell ein lettisches Bier mit einem ganzen lettischen Satz.", where: ["bar"] },
      ],
      5: [
        { t: "Trink einen Black Balsam und halte direkt danach eine 30-Sekunden-Liebeserklärung an Lettland.", where: ["bar", "markt"] },
        { t: "Lass dir von einem Einheimischen einen Volkstanz-Schritt beibringen und tanz ihn auf dem Markt.", where: ["markt"] },
        { t: "Sing die erste Strophe von „Dievs, svētī Latviju“ in einer Bar vor der Gruppe.", where: ["bar"] },
        { t: "Ruf auf der Mitte der Steinbrücke so laut du kannst „Priekā, Rīga!“.", where: ["stadt"] },
        { t: "Iss die seltsamste Spezialität vom Zentralmarkt (Gruppe entscheidet).", where: ["stadt"] },
        { t: "Lass dir einen lettischen Spitznamen geben und stell dich den Rest des Tages damit vor.", where: ["bar", "markt", "stadt"] },
      ],
    },
  },
  {
    id: "geheim", name: "Geheimmission", short: "Geheim", icon: "🤫", color: "#334155", secret: true,
    tasks: {
      1: [
        "Bring jemanden aus der Gruppe dazu, „Elch“ zu sagen.",
        "Bau das Wort „Kartoffelsalat“ dreimal in Gespräche ein.",
        "Bring einen Mitspieler dazu, dir ein Getränk zu holen.",
        "Sag 5 Mal unauffällig „Wie man in Riga sagt …“.",
        "Bring jemanden dazu, ein Foto von dir zu machen.",
      ],
      3: [
        "Überzeug einen Mitspieler von einem erfundenen Riga-Fakt.",
        "Bring die Gruppe in eine Bar deiner Wahl, ohne sie direkt vorzuschlagen.",
        "Bring jemanden dazu, sein Getränk mit dir zu tauschen.",
        "Bring zwei Mitspieler dazu, darüber zu streiten, wer besser Auto fährt.",
        "Bring jemanden dazu, Liegestütze zu machen.",
        "Stell unauffällig die Handysprache eines Mitspielers um (und hilf danach zurück).",
      ],
      5: [
        "Bring die ganze Gruppe dazu, gleichzeitig ein Lied zu singen.",
        "Bring jemanden aus der Gruppe dazu, dir einen Shot zu spendieren.",
        "Bring einen Mitspieler dazu, ohne Grund einen Toast auf dich auszusprechen.",
        "Versteck ein Souvenir in der Tasche eines Mitspielers, ohne dass er es bis abends merkt.",
        "Erfinde eine Legende über einen Mitspieler und bring zwei andere dazu, sie weiterzuerzählen.",
      ],
    },
  },
  {
    id: "gruppe", name: "Gruppe & Duell", short: "Duell", icon: "⚔️", color: "#a16207",
    tasks: {
      1: [
        "Schere-Stein-Papier gegen einen Mitspieler deiner Wahl. Verlierer trinkt.",
        "Wer zuletzt die Hand auf den Tisch legt, trinkt.",
        "Alle erzählen ihren peinlichsten Moment, die Gruppe kürt den Sieger.",
        "Wasserfall: Du fängst an zu trinken, alle machen mit, bis du aufhörst.",
        "Reihum Fußballvereine nennen. Wer zögert, trinkt.",
      ],
      3: [
        "Daumencatchen gegen einen Gegner, den die Gruppe bestimmt.",
        "Imitiere einen Mitspieler, bis die Gruppe errät, wer es ist.",
        "Stell jedem in der Gruppe eine Wahrheitsfrage.",
        "Bierdeckel-Turm: Wer baut am höchsten?",
        "Halte eine 1-Minuten-Roast-Rede über einen Mitspieler.",
        "Ich-hab-noch-nie-Runde mit 5 Aussagen.",
      ],
      5: [
        "Halte eine dramatische Abschiedsrede auf den Mitspieler zu deiner Linken.",
        "Die Gruppe formuliert eine harmlose, aber peinliche Nachricht an einen Kontakt deiner Wahl.",
        "Bleib ernst, während alle anderen dich zum Lachen bringen wollen (1 Minute).",
        "Die Gruppe darf dir 10 Minuten lang Befehle geben (nichts Gefährliches).",
        "Reim spontan eine Ballade über die Reise.",
      ],
    },
  },
];

export const JOKER = {
  id: "joker", name: "Joker", icon: "🃏", color: "#be185d",
  cards: [
    "Joker: Schieb deine nächste Aufgabe einem anderen zu.",
    "Doppelt oder nichts: Deine nächste Aufgabe zählt doppelt, Scheitern kostet die gleichen Punkte.",
    "Akzent-Zeit: Alle sprechen bis zur nächsten Bar mit Akzent. Wer bricht, trinkt.",
    "Spiegel: Du machst 10 Minuten alles nach, was ein Mitspieler tut.",
    "Schutzschild: Du darfst eine Aufgabe ohne Strafe verweigern.",
    "Diebstahl: Klau einem Mitspieler 2 Punkte.",
    "Freirunde: Du bestimmst, wer die nächste Runde zahlt.",
    "Kapitän: Du bestimmst die nächste Bar.",
    "Stumm: Du darfst 15 Minuten nicht sprechen.",
    "Chef: Du suchst einem Mitspieler die nächste Aufgabe aus.",
  ],
};

export const BINGO = [
  "Jemand bestellt Black Balsam", "Ein Tier schleckt jemanden ab", "Jemand rutscht auf dem Eis aus",
  "Fremder macht ein Gruppenfoto", "Jemand verliert etwas", "„Nur noch ein Bier“",
  "Barkeeper spricht Deutsch", "Jemand schläft im Taxi oder in der Bar ein", "Absurdes Souvenir gekauft",
  "Es schneit", "Jemand wird nach dem Weg gefragt", "Jemand singt spontan",
  "Getränk kostet über 10 €", "Jemand verlangt eine Runde Kurze", "Fast Food nach Mitternacht",
  "Jemand vergisst, wo das Hotel ist", "Einheimischer gibt einen Bar-Tipp", "Selfie mit einem Hund",
  "Jemand bestellt ein lettisches Gericht", "Ein Handy-Akku ist leer", "Jemand trägt eine Weihnachtsmütze",
  "Jemand verwechselt Riga mit einer anderen Hauptstadt", "Jemand ruft zu Hause an", "Jemand tanzt",
  "„Das machen wir nächstes Jahr wieder“", "Jemand verschüttet ein Getränk", "Gruppe verläuft sich",
  "Jemand jammert über die Kälte", "Doppelgänger eines Mitspielers gesichtet", "Fußball-Diskussion eskaliert",
  "Jemand sagt „Priekā!“ ohne Aufforderung", "Esel der Stadtmusikanten gerieben", "Graue Erbsen mit Speck gegessen",
  "Laima-Schokolade gekauft", "Lettland mit Litauen oder Estland verwechselt", "Jemand trinkt Kwas",
  "Einheimischer bringt ein lettisches Wort bei", "„Paldies“ falsch ausgesprochen", "Black-Balsam-Grimasse auf Foto",
  "Jemand redet über Eishockey", "Foto von einer Jugendstil-Fassade", "Gruppe ist auf dem Zentralmarkt",
  "Jemand bestellt im Lido", "Katzenhaus gefunden", "„Erster Weihnachtsbaum der Welt“ erwähnt",
  "Jemand friert an der Daugava",
];

export const FINALE = [
  "Trägt am Rückreisetag ein Outfit nach Wahl der Gruppe.",
  "Hält am Flughafen eine Dankesrede an die Gruppe.",
  "Zahlt die erste Runde beim nächsten Treffen.",
  "Postet ein von der Gruppe gewähltes Foto mit Text der Gruppe.",
  "Singt im Bus oder Taxi ein Lied nach Wahl der Gruppe.",
];

// ---------- Imposter ----------
export const IMPOSTER_WORDS = {
  "Lettland": [
    "Black Balsam", "Daugava", "Freiheitsdenkmal", "Schwarzhäupterhaus", "Bernstein", "Zentralmarkt",
    "Laima-Schokolade", "Graue Erbsen", "Roggenbrot", "Kwas", "Jugendstil", "Ostsee", "Jūrmala",
    "Eishockey", "Bremer Stadtmusikanten", "Katzenhaus", "Drei Brüder", "Petrikirche", "Lido",
    "Sauna", "Birkenwald", "Storch", "Euro", "Hanse", "Altstadt", "Fernsehturm", "Sprotten",
    "Johannisfest", "Kopfsteinpflaster", "Rathausplatz",
  ],
  "Weihnachten": [
    "Glühwein", "Weihnachtsmarkt", "Lebkuchen", "Tannenbaum", "Rentier", "Weihnachtsmann", "Schneemann",
    "Christstollen", "Adventskranz", "Lichterkette", "Mistelzweig", "Geschenkpapier", "Schlitten",
    "Krippe", "Plätzchen", "Wichteln", "Kamin", "Zuckerstange", "Nussknacker", "Bratapfel",
    "Last Christmas", "Weihnachtsmütze", "Feuerzangenbowle", "Schneeflocke", "Gans", "Engel",
    "Kerze", "Bescherung", "Handschuhe", "Punsch",
  ],
  "Männerausflug": [
    "Kater", "Bierpong", "Kneipentour", "Shot", "Hotelzimmer", "Schnarchen", "Döner um 3 Uhr",
    "Gruppenfoto", "Billigflieger", "Handgepäck", "Taxi", "Schneeballschlacht", "Karaoke", "Türsteher",
    "Rechnung teilen", "Trinkspiel", "Wecker", "Kopfschmerztablette", "Fußball", "Zigarre",
    "Whatsapp-Gruppe", "Bauchtasche", "Bartender", "Stadionbesuch", "Frühstücksbuffet", "Rundenbier",
    "Peinliches Video", "Flughafenbier", "Jägermeister", "Mitternachtssnack",
  ],
};
