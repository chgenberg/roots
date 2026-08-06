"""Säljmaterial: produkterna, uppsidan och hur säljarna tar in dem.

Till skillnad från de fyra Master Source-presentationerna är det här ett
säljstöd som skrivs här i filen. Tre regler styr innehållet:

    Minimalism    Bilden bär rubrik och korta punkter. Allt resonemang ligger i
                  talarmanuset, aldrig på sliden. En punkt är en tanke, inte en
                  mening.

    Produktfakta  Priser, volymer, ingredienser och påståenden är hämtade ur
                  sajten och produktkatalogen (apps/web/.../produkter och
                  packages/db/src/seed.ts). pH och konserveringssystem kommer
                  ur FORMULATIONS.md. Inget påstående får finnas här som inte
                  finns där — särskilt inte var produkterna tillverkas, som
                  sajten medvetet inte uttalar sig om.

    Kodak         Berättelsen om George Eastman, Steve Sasson och konkursen
                  2012, som öppnar presentationen. Poängen är inte Kodak utan
                  parallellen: marknadsledaren som såg möjligheten först och
                  ändå lät bli att ta den.

Bygg med:

    python3 docs/presentations/deck_produkter.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Column, Deck, Slide  # noqa: E402

FILENAME = "Roots_Produkter_och_Paket.pptx"
DECK_NAME = "Roots · Produkter & paket"


def _n():
    i = 0
    while True:
        i += 1
        yield i


def build() -> Deck:
    n = _n()
    slides: list[Slide] = []

    # ── 01 · Omslag ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="logo", kicker="SÄLJMATERIAL",
        title="Tre produkter. En uppsida.",
        notes="Låt den ligga uppe medan folk sätter sig. Säg ingenting om "
              "produkterna än — börja med Kodak.",
    ))

    # ── 02 · Kodak reser sig ──────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="story", kicker="KODAK · 1888–1996",
        title="Företaget som ägde ögonblicket",
        items=[
            "1888: kameran för alla",
            "»You press the button, we do the rest«",
            "90 % av all film i USA",
            "28 miljarder dollar, 140 000 anställda",
            "»Kodak Moment« blev vardagsspråk",
        ],
        images=["kodak.jpeg"],
        caption="Ingen var i närheten.",
        notes="Bygg upp hur totalt dominerande Kodak var — alla i rummet "
              "känner igen logotypen. Desto större blir fallet på nästa "
              "slide.\n\n"
              "Bakgrund om du vill måla ut det: George Eastman var 24 år och "
              "banktjänsteman utan utbildning i kemi. Han experimenterade i "
              "sin mammas kök för att han tyckte att fotografering var för "
              "krångligt. Målet var att göra kameran »as convenient as the "
              "pencil«. Brownie-kameran kostade en dollar 1900 och gjorde "
              "fotografering till en folkhobby.\n\n"
              "Affärsmodellen var sluten: Kodaks kamera, Kodaks film, Kodaks "
              "framkallning. De sålde inte en produkt — de ägde hela "
              "kundresan.",
    ))

    # ── 03 · Kodak faller ─────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="story", kicker="KODAK · 1975–2012",
        title="Uppfinningen de la tillbaka i lådan",
        items=[
            "1975: Kodaks egen ingenjör bygger digitalkameran",
            "0,01 megapixel, stor som en brödrost",
            "Den hotade filmaffären — alltså begravdes den",
            "Sony, Canon och Fujifilm tog marknaden",
            "2012: konkurs",
        ],
        images=["Steve.jpg"],
        caption="De hade tekniken. Inte modet.",
        notes="Berättelsens vändning. Ingenjören hette Steve Sasson och står "
              "på bilden med prototypen. Ledningens reaktion var nyfikenhet "
              "och skepsis — vem vill titta på bilder på en skärm? Problemet "
              "var aldrig tekniken, utan att hela affären byggde på film.\n\n"
              "Det kallas innovator's dilemma (Christensen, 1997): "
              "framgångsrika bolag fallerar inte för att de gör fel, utan "
              "för att de fattar rätt beslut för en verklighet som håller på "
              "att ta slut.\n\n"
              "Eastman varnade själv: »The world is moving, and a company "
              "that contents itself with present accomplishments soon falls "
              "behind.«",
    ))

    # ── 04 · Bryggan till oss ─────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="columns", kicker="DÄRFÖR BERÄTTAR VI DET HÄR",
        title="Föreningsförsäljning har inte förändrats på trettio år",
        left=Column(heading="Branschen", items=[
            "Tryckt katalog",
            "Kontanter och blanketter",
            "En kampanj om året",
            "Engångsköp",
        ]),
        right=Column(heading="Roots", items=[
            "Digital butik per säljare",
            "Swish direkt i kassan",
            "Produkter som tar slut",
            "35 % till föreningen — varje gång",
        ]),
        caption="Vi konkurrerar inte om bättre kataloger.",
        notes="Bryggan från Kodak till oss. Branschen är inte dålig — den är "
              "optimerad för en verklighet som håller på att ta slut. Vi "
              "behöver inte slå dem på deras plan, vi spelar på ett annat.\n\n"
              "Ingen annan i föreningsförsäljning har sett förbrukningsvaran "
              "som möjligheten. Det är vår öppning, och den står öppen nu.\n\n"
              "Föreningens andel är 35 % av försäljningen, låst och tydligt.",
    ))

    # ── 05 · Hårbottnen som ekosystem ─────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="points", kicker="DET INGEN ANNAN PRATAR OM",
        title="Hårbotten är ett ekosystem",
        items=[
            "Ett mikrobiom: Malassezia, Cutibacterium, Staphylococcus",
            "Ett eget signalsystem: CB1-receptorer i hårsäcken",
            "Sulfater (SLS) stör både flora och barriär",
            "Antimjällaktiver slår rakt på Malassezia",
        ],
        images=["images/m2.jpg"],
        caption="Att rengöra är lätt. Att rengöra utan att rubba är svårt.",
        notes="Det här är vårt djup — ingen annan i föreningsförsäljning "
              "pratar om hårbottnens biologi. Ta det lugnt och förklara med "
              "egna ord.\n\n"
              "MIKROBIOMET: hårbotten bebos av svampen Malassezia (M. "
              "restricta, M. globosa) och bakterierna Cutibacterium acnes och "
              "Staphylococcus. Mjäll och seborroisk dermatit hänger ihop med "
              "att balansen rubbas — mer Malassezia och Staphylococcus, "
              "mindre C. acnes (PLOS One 2019; Dermatology and Therapy "
              "2025).\n\n"
              "ENDOCANNABINOIDSYSTEMET: hårsäcken både tillverkar och svarar "
              "på endocannabinoider. CB1-receptorn sitter i hårsäckens "
              "epitel och fungerar som en broms på hårväxten — anandamid och "
              "THC förkortar tillväxtfasen (Telek m.fl., FASEB J 2007). "
              "Senare forskning visar att hårsäckens stamceller behöver en "
              "grundnivå av CB1-signalering för att överleva (Exp Dermatol "
              "2021). Alltså: systemet ska lämnas ifred, inte petas i.\n\n"
              "SÅ HÄR SÄGER DU DET: »hårbotten har ett eget mikrobiom och "
              "ett eget signalsystem, och vår formel är byggd för att inte "
              "störa dem«. Säg aldrig att vi behandlar, förbättrar eller "
              "balanserar något — det är läkemedelsspråk.",
    ))

    # ── 06 · Vad vi gör åt det ────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="SÅ ÄR FORMELN BYGGD",
        title="Byggd för att inte störa",
        items=[
            "Inga sulfater | Sockerbaserade tensider i stället för SLS",
            "pH 4,5–5,5 | Hudens och hårbottnens egen nivå",
            "Mild konservering | Natriumbensoat och kaliumsorbat",
            "Inget som slår mot floran | Inga antimjällaktiver, inga cannabinoider",
        ],
        caption="Nästa steg: certifiering enligt MyMicrobiome Standard 19.20.",
        notes="VIKTIGT — så här långt får vi gå, men inte längre: vi kan "
              "berätta hur formeln är byggd, för det är fakta ur "
              "formuleringsunderlaget. Vi får INTE säga att det är bevisat "
              "att produkterna inte påverkar mikrobiomet, för det har vi "
              "inte testat ännu. EU-reglerna (655/2013) kräver dokumenterat "
              "underlag för varje påstående, även underförstådda.\n\n"
              "Formulerat för att inte störa = OK.\n"
              "Bevisat mikrobiomvänligt = INTE OK förrän testet är gjort.\n\n"
              "UNDERLAGET: pH-mål är 5,0–5,5 för schampo och body wash och "
              "4,5–5,0 för balsam — det ligger på hudens egen nivå. "
              "Konserveringen är natriumbensoat (0,4 %) och kaliumsorbat "
              "(0,3 %), båda livsmedelsgodkända, i stället för starka "
              "biocider. Tvättämnena är sockerbaserade glukosider och milda "
              "amfotera tensider, inga SLS/SLES. Ingen av de tre formlerna "
              "innehåller antimjällaktiver (zinkpyrition, klimbazol, "
              "piroctone olamine) eller några cannabinoider.\n\n"
              "VÄGEN TILL SVART PÅ VITT: MyMicrobiome Standard 19.20 är den "
              "enda etablerade certifieringen för hårbottnens mikrobiom. "
              "Fyra in vitro-tester (renhet, balans, mångfald, vitalitet) mot "
              "M. globosa, M. furfur, C. acnes och S. epidermidis. Tar 6–10 "
              "veckor och ger en märkning vi får sätta på flaskan. Det finns "
              "ingen motsvarande certifiering för endocannabinoidsystemet — "
              "där får vi hålla oss till att vi inte tillför något som "
              "griper in i det.",
    ))

    # ── 07–09 · En slide per produkt ──────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="pitch", kicker="PRODUKT 01 · 149 KR · 250 ML",
        title="Roots Schampoo",
        left=Column(heading="Fakta", items=[
            "SyriCalm® lugnar hårbotten",
            "Sockerbaserade, sulfatsnåla tvättämnen",
            "Reder ut och ger glans",
            "Utan sulfater, silikoner, parabener",
        ]),
        right=Column(heading="Känsla", items=[
            "»Hår som andas — utan att strama«",
            "Alla har schampo. Frågan är vems.",
            "Unisex — hela familjen",
        ]),
        images=["images/schampoo.jpg"],
        caption="»Du köper ändå schampo varje månad. Nu går 35 % till "
                "föreningen.«",
        notes="Bestseller på sajten och den produkt folk förstår direkt. "
              "Öppna med den — men stanna aldrig kvar i den, sälj vidare "
              "till paketet.\n\n"
              "SyriCalm® = Phragmites Communis (vass) + Poria Cocos (svamp). "
              "Finns i alla tre produkterna, det är det som håller ihop "
              "sortimentet.\n\n"
              "Fler detaljer om någon frågar: Polyquaternium reder ut och ger "
              "glans, Panthenol (B5) och glycerin ger fukt och styrka. "
              "Utvecklat i Norden — säg inget om var det tillverkas.",
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
        images=["images/conditioner.jpg"],
        caption="Sälj den aldrig ensam — schampo och balsam hör ihop.",
        notes="Balsamet är det som gör att kunden kommer tillbaka: "
              "skillnaden märks i handen. Låt kunden ta på håret medan du "
              "berättar.\n\n"
              "Detaljer: lätt emollient-komplex, betain och panthenol för "
              "djup återfuktning, antioxidanter från svartpeppar (Piper "
              "Nigrum) och Inga-bark.\n\n"
              "Kombinationen schampo + balsam är vägen in i paketet — har "
              "man två av tre är det tredje enkelt.",
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
        images=["images/body-wash.jpg"],
        caption="Lägst tröskel av de tre — perfekt sista knuff.",
        notes="Body wash är den enklaste merförsäljningen som finns. Om "
              "någon säger att de är nöjda med sitt schampo: gå hit i "
              "stället för att argumentera.\n\n"
              "Den kostar 129 kr, alltså 20 kr mindre än de andra två.",
    ))

    # ── 10 · Paketet ──────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="pitch", kicker="PAKETET · 399 KR · 3 × 250 ML",
        title="Roots Komplett paket",
        left=Column(heading="Argumenten", items=[
            "Kunden sparar 28 kr",
            "SyriCalm® i alla tre — byggda för varandra",
            "Lägsta pris per flaska",
            "35 % av 399 kr i stället för 35 % av 149 kr",
        ]),
        right=Column(heading="Så tar du in det", items=[
            "Visa paketet först",
            "»Vill du ta hela rutinen?«",
            "Tar slut samtidigt — nästa order ger sig själv",
        ]),
        images=["images/collection-1.jpg"],
        caption="Snittordern är det enda du styr över i ett säljsamtal.",
        notes="Presentationens viktigaste slide. Om säljarna bara tar med "
              "sig en sak ska det vara: visa paketet först.\n\n"
              "Varför ordningen spelar roll: börjar du med en flaska blir "
              "paketet en dyr uppgradering. Börjar du med paketet blir det "
              "utgångsläget, och kunden får tacka nej till det i stället för "
              "att tacka ja till en flaska.\n\n"
              "Siffrorna: 149 + 149 + 129 = 427 kr var för sig, 399 kr som "
              "paket. Samma säljsamtal ger alltså en större order.\n\n"
              "Räkneexempel att ha i huvudet: 25 säljare × 1 500 kr = 37 500 "
              "kr i försäljning, varav 35 % = 13 125 kr till föreningen. Det "
              "är standardvärdena i räknesnurran på sajten.",
    ))

    # ── 11 · Avslut ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="TA MED DIG DET HÄR",
        title="Vi säljer inte en katalog. Vi säljer något som tar slut.",
        items=[
            "Öppna med varför: 35 % till föreningen",
            "Visa paketet först — alltid",
            "SyriCalm®, sulfatsnålt, utvecklat i Norden",
            "Formulerad för att inte störa hårbotten",
            "Kodak hade tekniken. Inte modet.",
        ],
        notes="Avsluta där vi började. Kodak såg möjligheten först och lät "
              "bli att ta den. Vi ser samma sak i föreningsförsäljningen — "
              "skillnaden är att vi tar den.",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    render(deck, HERE / FILENAME, DECK_NAME)
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:8} {s.title[:60]}")
