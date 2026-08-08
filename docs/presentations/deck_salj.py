"""Säljpresentation — Master Source + kollegans redigeringsnoter.

Byggs som `deck_produkter` / `deck_plattform`: egen dramaturgi här i filen,
design via roots_deck.py. MS-text behålls där sliderna finns kvar; MS-005 och
MS-015-kalkylen utgår enligt noterna. Team, produktpitchar, pris och flöde
är nya noter-slides.

    python3 docs/presentations/deck_salj.py
    python3 docs/presentations/build_decks.py d1
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "knowledge-os"))

import ms_source as ms  # noqa: E402
from decks import notes_for  # noqa: E402
from slide_model import Column, Deck, Slide  # noqa: E402

FILENAME = "Roots_Saljpresentation.pptx"
DECK_NAME = "Roots · Säljpresentation"

SPECS, _DOCS = ms.load()


def _n():
    i = 0
    while True:
        i += 1
        yield i


def _cells(pairs) -> list[str]:
    return [f"{a} | {b}" for a, b in pairs]


def _slide(number: int, layout: str, ms_id: str, **kwargs) -> Slide:
    spec = SPECS[ms_id]
    module = {
        "roots-master-source-modul-1-vision-v1-0.md": "VISION",
        "roots-master-source-modul-2-affaren-v1-0.md": "AFFÄREN",
        "roots-master-source-modul-3-plattform-v1-0.md": "PLATTFORMEN",
    }.get(spec.source_file, "ROOTS")
    return Slide(
        number=number,
        layout=layout,
        kicker=kwargs.pop("kicker", module),
        title=kwargs.pop("title", spec.text("Titel")),
        subtitle=kwargs.pop("subtitle", spec.text("Undertitel")),
        notes=kwargs.pop("notes", notes_for(ms_id)),
        source=ms_id,
        **kwargs,
    )


TEAM = [
    ("Kent Gustafson", "personal/kent-gustafson.jpg"),
    ("Fredrik Lindqvist", "personal/fredrik-lindqvist.jpg"),
    ("Johan Lindqvist", "personal/johan-lindqvist.jpg"),
    ("Christopher Genberg", "personal/christopher-genberg.jpg"),
    ("Ola Nordlund", "personal/ola-nordlund.jpg"),
    ("Johan Fogell", "personal/johan-fogell.jpg"),
    ("Niclas Corse", "personal/niclas-corse.jpg"),
]


def build() -> Deck:
    S = SPECS
    n = _n()
    slides: list[Slide] = []

    # ── 01 · Omslag ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cover", kicker="ROOTS",
        title=S["MS-001"].text("Titel"),
        subtitle=S["MS-001"].text("Undertitel"),
        images=["images/sport-pres-cover.jpg"],
        source="MS-001",
        notes=notes_for("MS-001"),
    ))

    # ── 02 · Teamet ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="team", kicker="ROOTS",
        title="Teamet",
        subtitle="Roots är byggt av människor som kan föreningslivet.",
        items=[name for name, _ in TEAM],
        images=[path for _, path in TEAM],
        caption="Decennier av erfarenhet från föreningsförsäljning, produkt, "
                "varumärke, teknik och AI — personliga möten och lokal närvaro.",
        notes="Kort presentation — namn och gemenskap, ingen CV-runda.\n\n"
              "Poängen: det här är människor som känner kedjan från laget "
              "till kassan, och som byggt produkten och plattformen för att "
              "den kedjan ska bli enklare.\n\n"
              "[Internt] Matilda: lägg till när porträtt finns. "
              "Branding: behåll footer «Roots · Säljpresentation».",
    ))

    # ── 03 · Vision / tre pelare (MS-001) ──────────────────────────────
    slides.append(_slide(
        next(n), "cards", "MS-001",
        items=_cells(S["MS-001"].pairs("Slide-innehåll", "Tre bärande delar")),
        caption=S["MS-001"].under("Slide-innehåll", "Nederst")[0],
    ))

    # ── 04 · Marknadsutrymme (MS-002) + Lotter ─────────────────────────
    left = S["MS-002"].under("Slide-innehåll", "Vänster sida")
    right = S["MS-002"].under("Slide-innehåll", "Höger sida")
    left_items = list(left[1:])
    if "Lotter" not in left_items:
        left_items.insert(0, "Lotter")
    elif left_items[0] != "Lotter":
        left_items = ["Lotter"] + [x for x in left_items if x != "Lotter"]
    slides.append(_slide(
        next(n), "columns", "MS-002",
        left=Column(heading=left[0], items=left_items),
        right=Column(heading=right[0], items=right[1:]),
        caption=S["MS-002"].under("Slide-innehåll", "Mellan ytorna")[0],
    ))

    # ── 05 · Marknadsstorlek (MS-003) ──────────────────────────────────
    slides.append(_slide(
        next(n), "bignumber", "MS-003",
        items=[S["MS-003"].under("Slide-innehåll", "Stor huvuduppgift")[0],
               S["MS-003"].under("Slide-innehåll", "Under")[0]]
        + _cells(S["MS-003"].pairs("Slide-innehåll", "Tre produktkort")),
    ))

    # ── 06 · Premiumsegmentet (MS-004) ─────────────────────────────────
    slides.append(_slide(
        next(n), "cards", "MS-004",
        items=_cells(S["MS-004"].pairs("Slide-innehåll", "Tre byggstenar")),
        caption=S["MS-004"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-005 utgår enligt kollegans not.

    # ── 07 · Färdigt system (MS-006) ───────────────────────────────────
    slides.append(_slide(
        next(n), "flywheel", "MS-006",
        items=S["MS-006"].bullets("Slide-innehåll"),
        columns=["ROOTS", ""],
        caption=S["MS-006"].under("Slide-innehåll", "Nederst")[0],
    ))

    # ── 08 · Därför Beauty (MS-007) ────────────────────────────────────
    flow = S["MS-007"].flow("Slide-innehåll")
    slides.append(_slide(
        next(n), "flywheel", "MS-007",
        items=flow[:6],
        columns=["ROOTS", ""],
        caption="Vår unika kompetens: föreningsliv + premiumprodukt + plattform — "
                "i samma erbjudande. Vi bygger relationer, inte bara kampanjer.",
    ))

    # ── 09 · Tre produkter översikt (MS-008) ───────────────────────────
    products = S["MS-008"].lines("Slide-innehåll")[1:4]
    benefits = S["MS-008"].bullets("Stödjande budskap")
    slides.append(_slide(
        next(n), "products", "MS-008",
        items=[f"{name} | {benefits[i] if i < len(benefits) else ''}"
               for i, name in enumerate(products)],
        images=["images/sport-pres-schampoo.jpg",
                "images/sport-pres-conditioner.jpg",
                "images/sport-pres-body-wash.jpg"],
        caption=S["MS-008"].under("Slide-innehåll", "Nederst")[0],
    ))

    # ── 10–12 · Produktpitchar ─────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="pitch", kicker="PRODUKT 01 · 149 KR · 250 ML",
        title="Roots Schampoo",
        left=Column(heading="Fakta", items=[
            "SyriCalm® lugnar hårbotten",
            "Sockerbaserade, sulfatsnåla tvättämnen",
            "Reder ut och ger glans",
            "Utan silikoner och parabener",
        ]),
        right=Column(heading="Känsla", items=[
            "»Hår som andas — utan att strama«",
            "Alla har schampo. Frågan är vems.",
            "Unisex — hela familjen",
        ]),
        images=["images/sport-pres-schampoo.jpg"],
        caption="»Du köper ändå schampo varje månad. Nu går 35 % till "
                "föreningen.«",
        notes="Öppna med bestsellern. Stanna inte kvar — sälj vidare till "
              "paketet. Utvecklat i Norden; säg inget om tillverkningsland.",
    ))

    slides.append(Slide(
        number=next(n), layout="pitch", kicker="PRODUKT 02 · 149 KR · 250 ML",
        title="Roots Conditioner",
        left=Column(heading="Fakta", items=[
            "Pro-Vitamin B5 — närande utan att tynga",
            "Reder ut och slätar varje slinga",
            "E-vitamin skyddar mot miljöstress",
            "SyriCalm® — samma aktiv som i schampot",
        ]),
        right=Column(heading="Känsla", items=[
            "»Silkeslent hår som glider genom fingrarna«",
            "Schampot gör jobbet. Balsamet känns.",
            "Den som testar köper båda nästa gång",
        ]),
        images=["images/sport-pres-conditioner.jpg"],
        caption="Sälj den aldrig ensam — schampo och balsam hör ihop.",
        notes="Skillnaden märks i handen. Kombinationen är vägen in i paketet.",
    ))

    slides.append(Slide(
        number=next(n), layout="pitch", kicker="PRODUKT 03 · 129 KR · 250 ML",
        title="Roots Body Wash",
        left=Column(heading="Fakta", items=[
            "Mild tvättduo, sulfatsnål",
            "Panthenol återfuktar huden",
            "SyriCalm® stärker hudens barriär",
            "Krämigt lödder som inte torkar ut",
        ]),
        right=Column(heading="Känsla", items=[
            "»Len hud som inte stramar efter duschen«",
            "Alla duschar. Varje dag.",
            "Hela hushållet använder samma flaska",
        ]),
        images=["images/sport-pres-body-wash.jpg"],
        caption="Lägst tröskel av de tre — perfekt sista knuff.",
        notes="Enklaste merförsäljningen. 129 kr — 20 kr under de andra två.",
    ))

    # ── 13 · Premium – inte premiumpris (MS-009) ───────────────────────
    slides.append(_slide(
        next(n), "words", "MS-009",
        items=S["MS-009"].under("Slide-innehåll", "Tre byggstenar"),
    ))

    # ── 14 · Pris och paket ────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="ERBJUDANDET",
        title="Pris som fungerar i föreningen",
        subtitle="Styckpriser mot Premiumpaketet — och marknadens nivå.",
        items=[
            "Schampoo · 149 kr | 250 ml · 60 kr/100 ml",
            "Conditioner · 149 kr | 250 ml · 60 kr/100 ml",
            "Body Wash · 129 kr | 250 ml · 52 kr/100 ml",
            "Premiumpaket* · 399 kr | 3 × 250 ml · spara 28 kr mot 427 kr",
        ],
        caption="Premiumkvalitet – cirka 40 % lägre än ledande premiumvarumärken "
                "(typiskt 90–140 kr/100 ml). *Premiumpaketet = hela rutinen.",
        notes="Visa Premiumpaketet först. Styckpriserna finns för den som frågar.\n\n"
              "Samma priser som i shoppen och Roots_Produkter "
              "(149 / 149 / 129 → 427; Premium 399 sparar 28).",
    ))

    # ── 15 · 35 % tillbaka (säljpunch) ─────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="impact", kicker="FÖRENINGEN",
        title="35 %",
        subtitle="tillbaka till föreningen",
        items=[
            "Av varje såld krona — utan förhandling.",
            "Låst i avtalet från dag ett.",
            "Inga uppstartsavgifter. Inga dolda avdrag.",
        ],
        caption="Det är därför medlemmarna säljer med stolthet.",
        notes="Stanna på den här sliden. Låt siffran landa innan du går vidare.\n\n"
              "Marginalen är LOCKED_MARGIN_PERCENT = 35 % — säg det som ett "
              "löfte, inte som ett erbjudande man kan pruta på.\n\n"
              "Demoskärmarna ska visa 35 % — samma siffra som här.",
    ))

    # ── 16 · Varför priset håller ──────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="PRISLOGIK",
        title="Varför priset håller",
        subtitle="Tre skäl till att premiumkvalitet kan kosta mindre här.",
        items=[
            "Inget grossistled | Vi säljer direkt till föreningen — "
            "utan mellanhänder som tar marginal.",
            "Mindre beauty-marknadsföring | Pengarna går till produkten och "
            "föreningen, inte till dyra kampanjer.",
            "Relationer i föreningslivet | Förtroendet bärs av laget och "
            "nätverket — inte av annonser.",
        ],
        caption="Premium är ett värde. Inte en prislapp.",
        notes="Håll dig till de tre punkterna. Gå inte in i kostnadsstruktur "
              "eller marginaler du inte har på papper.",
    ))

    # ── 16 · Långsiktig affär (MS-010) ─────────────────────────────────
    slides.append(_slide(
        next(n), "timeline", "MS-010",
        items=S["MS-010"].flow("Slide-innehåll"),
    ))

    # ── 17 · Plattform med skärmbild (ersätter abstrakt MS-011) ────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="PLATTFORMEN",
        title=S["MS-011"].text("Titel"),
        subtitle=S["MS-011"].text("Undertitel"),
        items=S["MS-011"].bullets("Slide-innehåll"),
        images=["forening-oversikt.png"],
        caption=S["MS-011"].text("Take-away"),
        source="MS-011",
        notes=notes_for("MS-011"),
    ))

    # ── 18 · Flöde ─────────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="GENOMFÖRANDE",
        title="Från uppstart till leverans",
        subtitle="Hela kedjan synlig i plattformen — utan onödig administration.",
        items=[
            "Uppstart med föreningen | Kontakt, bankkonto, säljperiod, "
            "medlemmar och mål",
            "Försäljning igång | Tre vyer: klubbledning, lagledare och medlem",
            "Avslutad säljperiod | Omsättning, överskott, paket och styck",
            "Ekonomi | Avräkning och fördelning per lag",
            "Kommunikation | Tydlig feedback när kampanjen lyckats",
            "Utleverans | Hämtinstruktioner och listor per medlem",
        ],
        notes="Gå igenom stegen snabbt. Detaljerna sitter i plattformen — "
              "öppna gärna dashboarden eller räknesnurran i samma andetag.",
    ))

    # ── 19 · Tidslinje (kort form) ─────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="timeline", kicker="GENOMFÖRANDE",
        title="Från start till utbetalning",
        subtitle="Samma kedja som i flödet — utan onödig administration.",
        items=[
            "Uppstart",
            "Aktivering",
            "Säljperiod",
            "Summering",
            "Leverans",
            "Utbetalning",
        ],
    ))

    # ── 20–23 · Rollvyer (skärmbilder) ────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="phones", kicker="KÖPAREN",
        title="Köparen behöver ingen app",
        subtitle="En länk. En shop. Klar på en minut.",
        items=["Shoppen", "Kassan"],
        images=["shop-start.png", "shop-kassa.png"],
        caption="Man köper inte schampo — man köper lagets cup.",
        notes="Ingen inloggning, inget konto. Länken i ett sms räcker.\n\n"
              "Skärmarna visar aktuella priser (149 / 149 / 129) och 35 % bidrag.",
    ))
    slides.append(Slide(
        number=next(n), layout="phones", kicker="SÄLJAREN",
        title="Hela världen i fickan",
        subtitle="Sålt, mål och nästa nivå — utan Excel och utan krångel.",
        items=["Min shop", "Min statistik"],
        images=["minshop-start.png", "minshop-statistik.png"],
        caption="Samma logik som spelen de redan spelar.",
        notes="Här avgörs utfallet. Nivåerna peppar vidare — "
              "»Registrera order« finns för kontantköp.",
    ))
    slides.append(Slide(
        number=next(n), layout="desktops", kicker="FÖRENINGSANSVARIG",
        title="Full kontroll. Noll administration.",
        subtitle="Översikt och avräkning i samma system — samma dag ordern läggs.",
        items=["Översikt", "Avräkning"],
        images=["forening-oversikt.png", "forening-avrakning.png"],
        caption="Styrelsen ser helheten utan att jaga listor.",
        notes="Visa att ekonomi och status sitter i samma yta. "
              "Ingen exporterar Excel mitt i kampanjen.",
    ))
    slides.append(Slide(
        number=next(n), layout="desktops", kicker="LAGLEDAREN",
        title="Peppa laget — inte administrera det",
        subtitle="Lagets tavla och säljarna på en skärm. En länk till chatten.",
        items=["Lagets översikt", "Säljarna"],
        images=["lag-oversikt.png", "lag-saljare.png"],
        caption="Tröskeln för en ideell tränare måste vara noll.",
        notes="Lagledarens jobb: kopiera länken och klistra in i lagchatten.",
    ))

    # ── 20 · Roller / ekonomi / support (MS-012–014 samlade) ───────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="PLATTFORMEN",
        title="Roller, ekonomi och support",
        subtitle="Samma system — rätt vy, automatiserade flöden, hjälp när "
                 "det behövs.",
        items=[
            "Rätt information till rätt person | Styrelse, kassör, lagledare "
            "och säljare ser det som är relevant för sin roll.",
            "Automatiserade ekonomiflöden | Beställning → betalning → "
            "avräkning → utbetalning, utan onödigt manuellt arbete.",
            "Hjälp dygnet runt | AI-assistent, kunskapsbank och personlig "
            "support när det behövs som mest.",
        ],
        caption="Samma plattform. Olika perspektiv. Mindre administration.",
        notes=(notes_for("MS-012") + "\n\n---\n\n" + notes_for("MS-013")
               + "\n\n---\n\n" + notes_for("MS-014")),
    ))

    # MS-015 calc utgår. Take-away stänger mötet.

    # ── 20 · Avslut ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="NÄSTA STEG",
        title=S["MS-015"].text("Take-away"),
        items=S["MS-015"].bullets("Stödjande budskap"),
        source="MS-015",
        notes=notes_for("MS-015") + "\n\n"
              "Öppna räknesnurran i mötet — låt dem dra i reglaget. "
              "Kalkylsliden är borttagen; verktyget gör jobbet live.",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    render(deck, HERE / FILENAME, DECK_NAME)
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:9} {s.title[:58]}")
