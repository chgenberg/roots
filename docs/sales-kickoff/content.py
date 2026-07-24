# -*- coding: utf-8 -*-
"""Delat innehåll för Roots säljkickoff: slides + stödord (talarmanus).

En sanning för både .pptx (build_kickoff.py) och .docx-stödorden.
Varje slide: dict med "kind" + layout-fält + "notes" (stödord för talaren).
Håll texten på slides KORT — detaljerna ligger i notes.
"""

SLIDES = [
    # ───────────────────────── COVER ─────────────────────────
    {
        "kind": "cover",
        "kicker": "INTERNT \u00b7 S\u00c4LJKICKOFF 2026",
        "title1": "Fr\u00e5n noll till",
        "title2": "f\u00f6rsta f\u00f6reningen.",
        "subtitle": "One team. Vi bygger aff\u00e4ren tillsammans \u2013 och st\u00e4rker f\u00f6reningslivet p\u00e5 riktigt.",
        "notes": [
            "V\u00e4lkomna \u2013 kul att vi \u00e4r samlade, hela teamet p\u00e5 ett st\u00e4lle.",
            "Syftet idag: gemensam bild, gemensam plan, och att alla g\u00e5r h\u00e4rifr\u00e5n redo att s\u00e4lja.",
            "Vi g\u00e5r igenom allt fr\u00e5n ax till limpa \u2013 hur det funkar n\u00e4r en f\u00f6rening b\u00f6rjar tills pengarna \u00e4r hos dem.",
            "H\u00f6gt i tak. St\u00e4ll fr\u00e5gor n\u00e4r som helst \u2013 detta \u00e4r lika mycket workshop som presentation.",
        ],
    },
    # ───────────────────────── AGENDA ─────────────────────────
    {
        "kind": "agenda",
        "kicker": "DAGENS AGENDA",
        "title": "Nio h\u00e5llplatser",
        "items": [
            "Samling & nul\u00e4ge",
            "Vart ska vi?",
            "Strategi & marknad",
            "Plan & aktiviteter",
            "Erbjudandet",
            "System & processer \u2013 ax till limpa",
            "F\u00f6ruts\u00e4ttningar f\u00f6r s\u00e4ljarna",
            "Organisation & samarbete",
            "Avslutning & beslut",
        ],
        "notes": [
            "Snabb \u00f6verblick \u00f6ver dagen \u2013 vi h\u00e5ller tempo men tar diskussionerna d\u00e4r de beh\u00f6vs.",
            "Tyngdpunkten ligger p\u00e5 punkt 5\u20136: erbjudandet och hur plattformen st\u00f6ttar hela s\u00e4ljet.",
            "Vi landar i konkreta beslut och aktivitetsm\u00e5l p\u00e5 slutet.",
        ],
    },

    # ═════════════════ 01 · SAMLING & NUL\u00c4GE ═════════════════
    {"kind": "divider", "num": "01", "title": "Samling & nul\u00e4ge",
     "notes": ["Vi b\u00f6rjar med att komma samman och sn\u00f6ra ihop var vi st\u00e5r just nu."]},
    {
        "kind": "points", "kicker": "01 \u00b7 SAMLING", "title": "One team",
        "bullets": [
            "Vilka \u00e4r vi i rummet \u2013 och vad tar vi med oss",
            "Gemensam bild av l\u00e4get just nu",
            "Samma arbetss\u00e4tt, samma argument, samma sn\u00e4ck",
        ],
        "notes": [
            "Kort runda: vem \u00e4r du, din bakgrund, vad du brinner f\u00f6r.",
            "Po\u00e4ngen med 'one team': vi ska s\u00e4ga samma saker och jobba likadant ute hos f\u00f6reningarna.",
            "Det \u00e4r s\u00e5 vi kan skala \u2013 en spelbok, m\u00e5nga s\u00e4ljare.",
        ],
    },
    {
        "kind": "points", "kicker": "01 \u00b7 NUL\u00c4GE", "title": "D\u00e4r vi st\u00e5r idag",
        "bullets": [
            "Bolag & finansiering p\u00e5 plats",
            "Varum\u00e4rke & produkter klara",
            "Plattformen \u00e4r byggd och live",
            "Nu: ut och s\u00e4lj",
        ],
        "notes": [
            "Kort statusrunda \u2013 mycket grundjobb \u00e4r redan gjort.",
            "Bolagsbildning och finansiering: klart. Varum\u00e4rke och tre f\u00e4rdiga produkter: klart.",
            "IT/plattform: byggd, testad och i drift \u2013 vi visar den live idag.",
            "Det som \u00e5terst\u00e5r \u00e4r det roliga: b\u00f6rja tr\u00e4ffa f\u00f6reningar.",
        ],
    },

    # ═════════════════ 02 · VART SKA VI ═════════════════
    {"kind": "divider", "num": "02", "title": "Vart ska vi?",
     "notes": ["Nu s\u00e4tter vi en gemensam m\u00e5lbild \u2013 b\u00e5de kort och l\u00e5ng sikt."]},
    {
        "kind": "points", "kicker": "02 \u00b7 M\u00c5LBILD", "title": "Fram till \u00e5rsskiftet",
        "bullets": [
            "5\u201310 allians\u00f6reningar ig\u00e5ng",
            "Bevisa konceptet \u2013 en lyckad POC",
            "[Antal] s\u00e5lda paket / [belopp] kr",
            "En spelbok som fungerar och g\u00e5r att skala",
        ],
        "notes": [
            "Definiera framg\u00e5ng tillsammans \u2013 fyll i riktiga siffror h\u00e4r (paket, kr, antal f\u00f6reningar).",
            "Viktigast just nu: bevisa modellen med n\u00e5gra f\u00f6reningar, inte att j\u00e4kta volym.",
            "Framg\u00e5ng = n\u00f6jda f\u00f6reningar som vill k\u00f6ra igen + en process vi kan kopiera.",
        ],
    },
    {
        "kind": "hero", "kicker": "02 \u00b7 VISION", "line1": "Roots om 5 \u00e5r:",
        "line2": "sj\u00e4lvklart s\u00e4tt att samla in \u2013 och b\u00e4ttre h\u00e5r p\u00e5 k\u00f6pet.",
        "notes": [
            "M\u00e5la den stora bilden: n\u00e4r en f\u00f6rening ska dra in pengar ska Roots vara f\u00f6rsta tanken.",
            "Vi bygger \u00e5terkommande aff\u00e4rer och riktiga relationer \u2013 inte eng\u00e5ngskampanjer.",
            "Produkter folk faktiskt vill fortsätta k\u00f6pa = intäkt \u00e5r efter \u00e5r.",
        ],
    },
    {
        "kind": "points", "kicker": "02 \u00b7 VARF\u00d6R VI VINNER", "title": "Varf\u00f6r vi vinner",
        "bullets": [
            "Relationer \u2013 inte annonser",
            "35 % tillbaka till f\u00f6reningen",
            "Premium folk vill \u00e5terk\u00f6pa",
            "En plattform som g\u00f6r jobbet",
        ],
        "notes": [
            "Vi tog bort branschens dyraste kostnad (20\u201340 % marknadsf\u00f6ring) \u2013 pengarna g\u00e5r till produkt + f\u00f6rening.",
            "35 % \u00e4r en stark, tydlig andel \u2013 h\u00f6gre \u00e4n mycket av det som finns.",
            "\u00c5terk\u00f6p: n\u00e4r flaskan tar slut kommer kunden tillbaka.",
            "Plattformen tar admin, betalning och logistik-stöd \u2013 f\u00f6reningen slipper krånglet.",
        ],
    },

    # ═════════════════ 03 · STRATEGI & MARKNAD ═════════════════
    {"kind": "divider", "num": "03", "title": "Strategi & marknad",
     "notes": ["Vilka vi g\u00e5r p\u00e5 f\u00f6rst \u2013 och hur vi bevisar modellen."]},
    {
        "kind": "cards", "kicker": "03 \u00b7 M\u00c5LGRUPP", "title": "Vilka bearbetar vi?",
        "cards": [
            ("Idrott f\u00f6rst", "Fotboll, innebandy, hockey, handboll \u2013 stora medlemsk\u00e5rer."),
            ("R\u00e4tt storlek", "F\u00f6reningar med m\u00e5nga medlemmar och lag."),
            ("En v\u00e4g in", "D\u00e4r vi redan har relation eller k\u00e4nnedom."),
            ("Motorn finns", "En drivande eldsj\u00e4l som f\u00e5r saker att h\u00e4nda."),
        ],
        "notes": [
            "B\u00f6rja d\u00e4r sannolikheten \u00e4r h\u00f6gst: stora idrottsf\u00f6reningar med m\u00e5nga s\u00e4ljande medlemmar.",
            "'Motorn' \u00e4r avg\u00f6rande \u2013 den personen st\u00e5r f\u00f6r ~80 % av utfallet.",
            "Prioritera A/B/C och s\u00e4tt en hypotes f\u00f6re m\u00f6tet: 'den h\u00e4r klubben borde s\u00e4lja X paket'.",
        ],
    },
    {
        "kind": "points", "kicker": "03 \u00b7 PILOT & POC", "title": "Pilot & bevis",
        "bullets": [
            "5\u201310 allians\u00f6reningar f\u00f6rst",
            "Mindre scope \u2013 l\u00e4gre tr\u00f6skel",
            "Vad kr\u00e4vs: motor, m\u00e5l, uppstart",
            "Bevisa \u2192 sedan skalar vi",
        ],
        "notes": [
            "Pilot-l\u00e4ge s\u00e4nker tr\u00f6skeln \u2013 f\u00f6rsta g\u00e5ngen beh\u00f6ver inte vara hela f\u00f6reningen.",
            "POC = n\u00e5gra f\u00f6reningar som lyckas och blir v\u00e5ra referenser.",
            "Vi samlar l\u00e4rdomar och putsar spelboken innan vi trycker p\u00e5 gasen.",
        ],
    },
    {
        "kind": "points", "kicker": "03 \u00b7 RISKER", "title": "Risker vi m\u00f6ter",
        "bullets": [
            "Tr\u00f6tta f\u00f6r\u00e4ldrar & s\u00e4ljleda",
            "Leverans & logistik",
            "Att 'motorn' tappar energi",
            "\u2192 vi m\u00f6ter dem med st\u00f6d & struktur",
        ],
        "notes": [
            "S\u00e4ljleda: d\u00e4rf\u00f6r premiumprodukter folk faktiskt vill ha + allt digitalt, ingen kontanthantering.",
            "Logistik: packat och klart \u2013 f\u00f6reningen delar bara ut.",
            "Motorn: vi ger status, verktyg och coachning s\u00e5 orken h\u00e5ller hela perioden.",
            "Var \u00e4rliga med riskerna \u2013 vi har svar p\u00e5 dem.",
        ],
    },

    # ═════════════════ 04 · PLAN & AKTIVITETER ═════════════════
    {"kind": "divider", "num": "04", "title": "Plan & aktiviteter",
     "notes": ["Fr\u00e5n m\u00e5lbild till konkret plan och aktivitetsm\u00e5l per s\u00e4ljare."]},
    {
        "kind": "points", "kicker": "04 \u00b7 PLAN", "title": "Planen till \u00e5rsskiftet",
        "bullets": [
            "Kickoff \u2192 gemensam leadslista",
            "Boka & signa allians\u00f6reningar",
            "K\u00f6r pilotperioder",
            "Utv\u00e4rdera \u2192 skala",
        ],
        "notes": [
            "Vi kommer \u00f6verens om planen h\u00e4r och nu \u2013 alla ska k\u00e4nna att de \u00e4gt den.",
            "Konkret bearbetningsplan f\u00f6r de f\u00f6rsta 3 m\u00e5naderna.",
            "S\u00e4tt startdatum f\u00f6r bearbetning och vilka 5\u201310 allians\u00f6reningar vi vill ha.",
        ],
    },
    {
        "kind": "cards", "kicker": "04 \u00b7 AKTIVITETSM\u00c5L", "title": "Aktivitetsm\u00e5l per s\u00e4ljare",
        "cards": [
            ("M\u00f6ten", "[X] bokade s\u00e4ljm\u00f6ten / vecka."),
            ("Signade", "[Y] f\u00f6reningar under h\u00f6sten."),
            ("Uppf\u00f6ljning", "Veckovis synk & pipeline-genomg\u00e5ng."),
            ("CRM", "Allt loggas \u2013 en sanning f\u00f6r alla."),
        ],
        "notes": [
            "Fyll i riktiga siffror \u2013 aktivitet driver resultat, s\u00e5 vi m\u00e4ter aktivitet, inte bara avslut.",
            "Vi f\u00f6ljer upp varje vecka och hj\u00e4lps \u00e5t d\u00e4r det k\u00e4rvar.",
            "Disciplin i CRM \u00e4r icke f\u00f6rhandlingsbart \u2013 annars ser vi inte l\u00e4get.",
        ],
    },

    # ═════════════════ 05 · ERBJUDANDET ═════════════════
    {"kind": "divider", "num": "05", "title": "Erbjudandet",
     "notes": ["Nu g\u00e5r vi igenom vad vi faktiskt s\u00e4ljer \u2013 och samlar feedback."]},
    {
        "kind": "products", "kicker": "05 \u00b7 PRODUKTER", "title": "Tre produkter, en filosofi",
        "cards": [
            ("First Growth", "Schampo", "SyriCalm\u00ae lugnar h\u00e5rbotten"),
            ("Pure Root", "Balsam", "Pro-Vitamin B5 & E-vitamin"),
            ("Soft Rinse", "Body wash", "SyriCalm\u00ae, sn\u00e4llt mot huden"),
        ],
        "notes": [
            "H\u00e5ll det kort: premium, nordiskt, sn\u00e4llt mot hud och h\u00e5rbotten.",
            "Hj\u00e4lteingrediens: SyriCalm\u00ae (lugnar) + Pro-Vitamin B5. Full INCI finns i produktbladet.",
            "Po\u00e4ng: det h\u00e4r \u00e4r inte 'ännu en f\u00f6reningsf\u00f6rs\u00e4ljning' \u2013 det \u00e4r produkter folk vill \u00e5terk\u00f6pa.",
            "Fokus i m\u00f6tet ligger p\u00e5 'Why', inte p\u00e5 att r\u00e4kna upp ingredienser.",
        ],
    },
    {
        "kind": "points", "kicker": "05 \u00b7 S\u00c4LJPRESENTATION", "title": "S\u00e4ljpresentationen",
        "bullets": [
            "Bygger p\u00e5 'Why' \u2013 inte h\u00e5rd produktsälj",
            "R\u00e4knesnurran live i m\u00f6tet",
            "L\u00e5t f\u00f6reningen s\u00e4ga siffrorna",
            "Finns klar att anv\u00e4nda",
        ],
        "notes": [
            "Vi har en f\u00e4rdig s\u00e4ljpresentation \u2013 g\u00e5 igenom den, ge feedback.",
            "R\u00e4knesnurran \u00e4r v\u00e5r 'killer': fyll i live, l\u00e5t DEM s\u00e4ga antal och paket.",
            "'Vad tror du \u00e4r rimligt per spelare?' \u2013 d\u00e5 blir m\u00e5let deras eget.",
        ],
    },
    {
        "kind": "points", "kicker": "05 \u00b7 WORKSHOP", "title": "Inv\u00e4ndningar & argument",
        "bullets": [
            "\u201cVi har redan en leverant\u00f6r\u201d",
            "\u201cF\u00f6r\u00e4ldrarna \u00e4r tr\u00f6tta\u201d",
            "\u201c399 kr \u00e4r mycket\u201d",
            "\u2192 vi tr\u00e4nar svaren tillsammans",
        ],
        "notes": [
            "Workshop: vi samlar de vanligaste inv\u00e4ndningarna och spikar b\u00e4sta svaren.",
            "M\u00e5l: alla svarar likadant och tryggt ute hos f\u00f6reningen.",
            "\u201cVi har leverant\u00f6r\u201d \u2192 h\u00f6gre f\u00f6rtjänst, premium, vi sk\u00f6ter admin/logistik.",
            "\u201c399 kr\u201d \u2192 motsvarande premium kostar 500\u2013700 kr i butik, och man st\u00f6ttar f\u00f6reningen.",
        ],
    },
    {
        "kind": "points", "kicker": "05 \u00b7 MARKNADSAVTAL", "title": "Marknadsavtal",
        "bullets": [
            "Vad vi erbjuder allians\u00f6reningar",
            "Basniv\u00e5 + bonus vid h\u00f6gre niv\u00e5",
            "Tydligt och enkelt",
            "Skapar lojalitet \u00f6ver tid",
        ],
        "notes": [
            "G\u00e5 igenom upplägget f\u00f6r allians\u00f6reningar (fyll i detaljer/niv\u00e5er).",
            "Psykologi: 'det h\u00e4r vill vi inte missa' \u2013 bonus vid bra start.",
            "Vi premierar den som varit v\u00e5r kontaktperson \u2013 bygger lojalitet.",
        ],
    },

    # ═════════════════ 06 · AX TILL LIMPA ═════════════════
    {"kind": "divider", "num": "06", "title": "Ax till limpa \u2013 s\u00e5 funkar plattformen",
     "notes": ["Nu k\u00f6r vi hela resan i systemet, steg f\u00f6r steg. H\u00e4r visar vi live."]},
    {
        "kind": "flow", "kicker": "06 \u00b7 \u00d6VERBLICK", "title": "Hela resan",
        "steps": ["Lead", "Registrering", "Kampanj", "Lag & s\u00e4ljare",
                  "Personlig shop", "S\u00e4ljperiod", "Avr\u00e4kning", "Utbetalning"],
        "notes": [
            "\u00d6verblick: fr\u00e5n att en f\u00f6rening s\u00e4tts upp tills pengarna \u00e4r hos dem.",
            "Vi g\u00e5r igenom varje steg p\u00e5 f\u00f6ljande slides \u2013 och visar det live i plattformen.",
            "Allt h\u00e4nger ihop i en plattform: webb, dashboard, betalning, CRM.",
        ],
    },
    {
        "kind": "points", "kicker": "06 \u00b7 STEG 1", "title": "S\u00e4ljaren & f\u00f6reningen s\u00e4tter upp",
        "bullets": [
            "S\u00e4ljare skapar lead i CRM",
            "F\u00f6reningen registrerar sig",
            "Kampanj: m\u00e5l, s\u00e4ljperiod, leveranstyp",
            "35 % till f\u00f6reningen",
        ],
        "notes": [
            "S\u00e4ljaren l\u00e4gger f\u00f6reningen som lead i portalen (pipeline, potential, k\u00e4lla).",
            "F\u00f6reningsadmin registrerar sig och f\u00e5r en onboarding-checklista.",
            "Kampanjen skapas med: m\u00e5l (kr eller paket), start-/slutdatum, leveranstyp (samlat till klubben eller hem).",
            "VIKTIGT internt: marginalen defaultar till 25 % i systemet \u2013 s\u00e4tt den till 35 % n\u00e4r kampanjen skapas.",
        ],
    },
    {
        "kind": "points", "kicker": "06 \u00b7 STEG 2", "title": "Lag & s\u00e4ljare",
        "bullets": [
            "Bjud in lagansvarig (l\u00e4nk, 14 dagar)",
            "S\u00e4ljare via l\u00e4nk ELLER Excel-import",
            "Varje s\u00e4ljare f\u00e5r egen shop + QR",
            "M\u00e5l p\u00e5 tre niv\u00e5er: klubb / lag / individ",
        ],
        "notes": [
            "Lagansvarig bjuds in via l\u00e4nk (giltig 14 dagar) och skapar sitt lag.",
            "S\u00e4ljare kommer in tv\u00e5 s\u00e4tt: registreringsl\u00e4nk de fyller i sj\u00e4lva, eller import av Excel/CSV (upp till 2000).",
            "Varje s\u00e4ljare f\u00e5r automatiskt en personlig shop med egen l\u00e4nk och QR-kod.",
            "M\u00e5l kan s\u00e4ttas p\u00e5 klubb-, lag- och individniv\u00e5 \u2013 synligt hela v\u00e4gen ner.",
        ],
    },
    {
        "kind": "screens", "kicker": "06 \u00b7 S\u00c5 SER DET UT", "title": "S\u00e5 ser det ut",
        "screens": [
            ("demo/forening-poster.jpg", "F\u00f6reningen", "M\u00e5l, lag & \u00f6verblick"),
            ("demo/lag-poster.jpg", "Lagledaren", "Bjuder in & f\u00f6ljer live"),
            ("demo/seller-poster.jpg", "S\u00e4ljaren", "Personlig shop + QR"),
        ],
        "notes": [
            "Visa de riktiga vyerna \u2013 g\u00e4rna live i plattformen.",
            "Po\u00e4ng: samma enkla upplevelse oavsett roll, mobilf\u00f6rst.",
            "Det h\u00e4r \u00e4r vad f\u00f6reningen ser n\u00e4r vi visar 'hur enkelt det \u00e4r'.",
        ],
    },
    {
        "kind": "points", "kicker": "06 \u00b7 STEG 3", "title": "Inf\u00f6r s\u00e4ljstart",
        "bullets": [
            "Allt f\u00f6rberett i systemet",
            "Personliga shoppar & QR redo",
            "M\u00e5l synliga hela v\u00e4gen ner",
            "F\u00e4rdiga delningsmallar (SMS/e-post)",
        ],
        "notes": [
            "N\u00e4r perioden n\u00e4rmar sig \u00e4r allt redan p\u00e5 plats \u2013 shoppar, m\u00e5l, struktur.",
            "S\u00e4ljarna f\u00e5r f\u00e4rdiga mallar att dela sin l\u00e4nk via SMS/e-post \u2013 l\u00e5g tr\u00f6skel att komma ig\u00e5ng.",
            "Push innan start: inspiration, 's\u00e5 gjorde andra', konkreta tips.",
        ],
    },
    {
        "kind": "cards", "kicker": "06 \u00b7 STEG 4", "title": "Under s\u00e4ljperioden",
        "cards": [
            ("Betalning", "Klarna \u2013 Swish, kort & faktura."),
            ("Live-stats", "Uppdateras var 20:e sekund."),
            ("Topplistor", "Niv\u00e5er, medaljer & milstolpar."),
            ("Chatt & notiser", "Lagledare \u2194 s\u00e4ljare."),
        ],
        "notes": [
            "K\u00f6paren betalar enkelt via Klarna \u2013 Swish, kort eller faktura. Ingen kontanthantering.",
            "S\u00e4ljaren kan ocks\u00e5 registrera en order manuellt (kontant/Swish vid d\u00f6rren).",
            "Live: f\u00f6rs\u00e4ljning, m\u00e5l-% och topplistor uppdateras hela tiden \u2013 driver energi.",
            "Gamification: niv\u00e5er Starter \u2192 Diamant och milstolpar. Chatt lagledare\u2194s\u00e4ljare + notiser.",
        ],
    },
    {
        "kind": "points", "kicker": "06 \u00b7 STEG 5", "title": "Perioden tar slut",
        "bullets": [
            "Shop st\u00e4nger \u2013 inga nya ordrar",
            "Avr\u00e4kning per lag",
            "F\u00f6reningens andel r\u00e4knas ut",
            "Klart f\u00f6r utbetalning",
        ],
        "notes": [
            "N\u00e4r perioden \u00e4r slut st\u00e4ngs shoppen \u2013 systemet slutar ta emot ordrar.",
            "Avr\u00e4kning: alla betalda ordrar summeras per lag och f\u00f6reningens andel r\u00e4knas ut.",
            "Internt idag: att 's\u00e4tta perioden till avslutad' g\u00f6rs av oss (ops) \u2013 inte helt automatiskt \u00e4nnu. Bra att veta.",
        ],
    },
    {
        "kind": "cards", "kicker": "06 \u00b7 STEG 6", "title": "Efter perioden",
        "cards": [
            ("F\u00f6reningen", "Resultat, avr\u00e4kning & utbetalning."),
            ("S\u00e4ljaren", "Egna ordrar & slutresultat."),
            ("K\u00f6paren", "Orderbekr\u00e4ftelse & orderstatus."),
            ("Leverans", "Samlat till klubben eller hem."),
        ],
        "notes": [
            "F\u00f6reningen: ser resultat och f\u00e5r utbetalning (kvittomail n\u00e4r pengarna \u00e4r p\u00e5 v\u00e4g).",
            "K\u00f6paren: f\u00e5r orderbekr\u00e4ftelse direkt och kan f\u00f6lja orderstatus (Mottagen \u2192 Betald \u2192 Skickad \u2192 Levererad).",
            "Leverans: bulk packas per lag/s\u00e4ljare och skickas till klubben; eller hem vid direktleverans.",
            "Roadmap (\u00e4rligt internt): automatiska leveransmail och ombeställnings-flöde \u00e4r p\u00e5 v\u00e4g.",
        ],
    },
    {
        "kind": "points", "kicker": "06 \u00b7 UNDER HUVEN", "title": "CRM, back-end & front-end",
        "bullets": [
            "En plattform \u2013 webb, dashboard, betalning",
            "CRM: lead \u2192 kund, pipeline & offerter",
            "Realtid i s\u00e4ljvyerna",
            "Byggt in-house \u2013 v\u00e4rde ~6\u201310 MSEK",
        ],
        "notes": [
            "Allt h\u00e4nger ihop: publik sajt, s\u00e4ljarens shop, dashboards, betalning och CRM.",
            "CRM: leads, pipeline (Lead \u2192 Kund), offerter och s\u00e4ljkalender \u2013 en sanning.",
            "Motsvarande bygge hos en byr\u00e5: ~6\u201310 MSEK och 9\u201312 m\u00e5nader \u2013 vi har det redan.",
        ],
    },

    # ═════════════════ 07 · F\u00d6RUTS\u00c4TTNINGAR ═════════════════
    {"kind": "divider", "num": "07", "title": "F\u00f6ruts\u00e4ttningar f\u00f6r s\u00e4ljarna",
     "notes": ["Vad beh\u00f6ver du som s\u00e4ljare f\u00f6r att lyckas fr\u00e5n dag ett?"]},
    {
        "kind": "cards", "kicker": "07 \u00b7 VERKTYGSL\u00c5DAN", "title": "Vad du beh\u00f6ver",
        "cards": [
            ("Material", "S\u00e4ljpresentation, produktblad, kalkylator."),
            ("Kl\u00e4der", "Profil \u2013 vi ser ut som ett team."),
            ("Samples", "Produkter att visa och k\u00e4nna p\u00e5."),
            ("Access", "Inlogg, CRM och f\u00e4rdiga mallar."),
        ],
        "notes": [
            "G\u00e5 igenom vad som redan finns och vad vi beh\u00f6ver ta fram.",
            "Samples \u00e4r viktiga \u2013 vi beh\u00f6ver produkter att visa i m\u00f6tena.",
            "Best\u00e4m vem som fixar vad och till n\u00e4r.",
        ],
    },

    # ═════════════════ 08 · ORGANISATION ═════════════════
    {"kind": "divider", "num": "08", "title": "Organisation & samarbete",
     "notes": ["Tydliga roller och ett s\u00e4tt att h\u00e5lla ihop \u2013 kontinuerligt."]},
    {
        "kind": "cards", "kicker": "08 \u00b7 S\u00c5 JOBBAR VI", "title": "S\u00e5 jobbar vi ihop",
        "cards": [
            ("Roller", "Vem g\u00f6r vad \u2013 tydligt och avtalat."),
            ("Synk", "Veckom\u00f6te + pipeline-genomg\u00e5ng."),
            ("Kommunikation", "WhatsApp-grupper + mail."),
            ("En sanning", "Allt hamnar i CRM."),
        ],
        "notes": [
            "Tydligg\u00f6r roller och ansvar \u2013 vem \u00e4ger leads, vem st\u00f6ttar, vem beslutar.",
            "S\u00e4tt m\u00f6tesstruktur: veckovis synk, format och tid.",
            "Best\u00e4m kanaler: vilka WhatsApp-grupper beh\u00f6vs, vad tas p\u00e5 mail.",
        ],
    },

    # ═════════════════ 09 · AVSLUTNING ═════════════════
    {"kind": "divider", "num": "09", "title": "Avslutning & beslut",
     "notes": ["Vi landar dagen i konkreta beslut."]},
    {
        "kind": "points", "kicker": "09 \u00b7 BESLUT", "title": "Beslutspunkter",
        "bullets": [
            "M\u00e5lbild & aktivitetsm\u00e5l \u2013 spikade?",
            "Allians\u00f6reningar \u2013 vilka f\u00f6rst?",
            "Marginal 35 % som standard",
            "N\u00e4sta synk \u2013 n\u00e4r?",
        ],
        "notes": [
            "G\u00e5 laget runt \u2013 st\u00e4ng varje beslutspunkt innan vi br\u00f6t upp.",
            "Spika m\u00e5l, f\u00f6rsta f\u00f6reningarna och vem som g\u00f6r vad.",
            "Kom ih\u00e5g: s\u00e4tt marginalen till 35 % i varje kampanj.",
            "Boka n\u00e4sta avst\u00e4mning direkt.",
        ],
    },
    {
        "kind": "close", "title": "Nu k\u00f6r vi.",
        "subtitle": "One team. Starkare f\u00f6reningsliv.",
        "notes": [
            "Summera energin: vi har produkten, plattformen och planen \u2013 nu handlar allt om att komma ut.",
            "Tacka alla. Boka n\u00e4sta steg.",
        ],
    },
]
