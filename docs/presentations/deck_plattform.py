"""Plattformspresentation: en rundtur i Roots för säljarna.

Syftet är att en säljare ska kunna gå igenom hela kedjan — från det föreningen
googlar fram innan mötet till pengarna som räknas av efteråt — och veta exakt
vad varje vy visar.

Tre regler styr innehållet:

    Riktiga bilder  Varje skärmbild är fotograferad ur plattformen med
                    docs/presentations/capture_screens.mjs, mot demodata i den
                    lokala databasen. Inga mockuper och inga skisser: det som
                    står på sliden finns på riktigt.

    Stödord         Punkterna är stödord, inte meningar. Det säljaren ska säga
                    står i talarmanuset. En slide ska gå att läsa på tre
                    sekunder medan man tittar på bilden.

    Kontrollerade   Siffror och löften är hämtade ur koden, inte ur minnet:
    påståenden      35 % är LOCKED_MARGIN_PERCENT i packages/contracts, priserna
                    står i produktkatalogen, och löftesbandet högst upp på sajten
                    kommer ur announcement-bar.tsx. Demokampanjerna i bilderna är
                    seedade med 30 % marginal — säg 35 %, som är det vi erbjuder,
                    och peka inte på procenttalet i demobilderna.

Bygg med:

    python3 docs/presentations/deck_plattform.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Deck, Slide  # noqa: E402

FILENAME = "Roots_Plattformen.pptx"
DECK_NAME = "Roots · Plattformen"


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
        title="En rundtur i plattformen",
        subtitle="Från första klicket till sista kronan",
        notes="Låt den ligga uppe medan alla sätter sig.\n\n"
              "Rama in vad det här är: en rundtur genom allt föreningen, "
              "laget, ungdomen och du själv möter. Alla bilder är riktiga "
              "skärmbilder ur systemet med demodata i.\n\n"
              "Säg också vad det inte är: ingen genomgång av produkterna, "
              "den ligger i produktpresentationen.",
    ))

    # ── 02 · Vad vi faktiskt säljer in ────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="points", kicker="INNAN VI BÖRJAR",
        title="Det är inte produkterna som är nyheten",
        items=[
            "Ingen pärm, ingen listor-i-efterhand",
            "Föreningen ser sina siffror samma dag",
            "Ungdomen säljer från sin telefon",
            "Föreningens andel räknas av automatiskt",
        ],
        images=["images/m2.jpg"],
        caption="Konkurrenten säljer kartonger. Vi säljer överblicken.",
        notes="Poängen med hela presentationen på en slide.\n\n"
              "Traditionell föreningsförsäljning: en pärm, en lista, en "
              "deadline, och först flera veckor senare vet någon vad det "
              "faktiskt blev. Alla i rummet känner igen sig.\n\n"
              "Vår skillnad är inte flaskan i sig — den är att allt är "
              "synligt medan det pågår, för alla fyra rollerna samtidigt.\n\n"
              "Låt den här sitta. Resten av presentationen är bara bevis för "
              "påståendet.",
    ))

    # ── 03 · Kedjan ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="timeline", kicker="KEDJAN",
        title="Fem steg, samma system",
        items=[
            "Räkna | Ni räknar tillsammans i mötet",
            "Skriv på | Offert och påskrift",
            "Bjud in | Lagledaren bjuder in spelarna",
            "Sälj | Ungdomen delar sin länk",
            "Räkna av | Föreningens andel dras automatiskt",
        ],
        caption="Ingenting lämnar systemet på vägen.",
        notes="Håll den kort — det här är innehållsförteckningen, inte "
              "innehållet.\n\n"
              "Det värdefulla att säga: varje steg lämnar spår i samma system. "
              "Ingen exporterar en Excel-fil, ingen mejlar en lista. Därför "
              "kan föreningen se en order samma dag den läggs.\n\n"
              "Resten av presentationen följer exakt den här ordningen, så "
              "publiken vet var de är hela tiden.",
    ))

    # ── 04 · Publikt: första intrycket ────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 0 · INNAN MÖTET",
        title="Det de ser när de googlar oss",
        items=[
            "Löftesbandet står överst på varje sida",
            "35 % till föreningen",
            "Inga uppstartsavgifter",
            "Utvecklat i Norden",
        ],
        images=["publik-start.png"],
        caption="Sajten har redan börjat sälja innan du ringer.",
        notes="Börja med att bygga trovärdighet: ordförande googlar oss efter "
              "att du bokat mötet. Det här är vad de hittar.\n\n"
              "Bandet högst upp rullar fem löften, och vart och ett är "
              "kontrollerat mot vad vi faktiskt håller: 35 % av "
              "försäljningen, utan sulfater/silikoner/parabener, utvecklat i "
              "Norden, inga uppstartsavgifter, intäkterna tillbaka till "
              "föreningslivet.\n\n"
              "Notera vad som INTE står där: ingenting om var produkterna "
              "tillverkas, och ingen löfte om fri frakt — fraktgränsen sätts "
              "per kampanj. Lova inte mer än bandet gör.",
    ))

    # ── 05 · Publikt: föreningssidan ──────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 0 · INNAN MÖTET",
        title="Sidan du hänvisar till",
        items=[
            "Skriven för styrelsen, inte för konsumenten",
            "Svarar på invändningarna i förväg",
            "Länk att skicka efter första samtalet",
        ],
        images=["publik-foreningsliv.png"],
        notes="Praktiskt tips till säljarna: skicka /foreningsliv direkt efter "
              "första telefonsamtalet, innan mötet. Den är skriven för en "
              "styrelse som ska övertyga varandra internt — inte för någon "
              "som ska köpa schampo.\n\n"
              "Det sparar dig halva mötet, för då har de redan tagit "
              "invändningarna med varandra.",
    ))

    # ── 06 · Publikt: så fungerar det ─────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 0 · INNAN MÖTET",
        title="Fyra steg de kan läsa själva",
        items=[
            "Hela upplägget utan inloggning",
            "Tar bort osäkerheten kring hur",
            "Bra att öppna i mötet på deras skärm",
        ],
        images=["publik-sa-fungerar.png"],
        notes="Den vanligaste tysta invändningen i ett föreningsmöte är inte "
              "priset — det är »hur mycket jobb blir det här för oss?«.\n\n"
              "Sidan svarar på det utan att någon behöver logga in. Öppna den "
              "gärna på deras egen skärm i mötet, så äger de rundturen i "
              "stället för att titta på din laptop.",
    ))

    # ── 07 · Räknesnurran ─────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 1 · I MÖTET",
        title="Räknesnurran gör räknandet till deras",
        items=[
            "Antal säljare × snittförsäljning",
            "Förtjänsten ändras medan ni drar i reglaget",
            "Dela som länk — de räknar själva hemma",
            "Du får notis när de fyller i sina uppgifter",
        ],
        images=["portal-raknesnurra.png"],
        caption="25 säljare × 1 500 kr = 13 125 kr till föreningen.",
        notes="Presentationens viktigaste verktyg. Om säljarna bara lär sig "
              "en sida i portalen ska det vara den här.\n\n"
              "VARFÖR DEN FUNGERAR: du säger inte en siffra — de drar i "
              "reglaget själva. Ett tal man räknat fram själv argumenterar "
              "man inte emot.\n\n"
              "SÅ HÄR GÖR DU: fråga hur många som faktiskt säljer, inte hur "
              "många medlemmar de har. Sätt snittet lågt, hellre 1 200 än "
              "2 000 — låt utfallet överraska uppåt.\n\n"
              "LÄNKEN: sparar antagandena och kan skickas till styrelsen. När "
              "de fyller i sina uppgifter blir det ett lead hos dig. Det är "
              "din bästa uppföljningsanledning: »jag såg att ni räknade på "
              "trettio säljare«.\n\n"
              "MARGINALEN är låst till 35 %. Demobilden visar 35 %, men "
              "kampanjerna i demodatan ligger på 30 % — peka inte på "
              "procenttalet i de senare bilderna.",
    ))

    # ── 08 · Pipeline ─────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 1 · I MÖTET",
        title="Din pipeline, inte ditt minne",
        items=[
            "Lead · Utkast · Skickad · Accepterad · Nekad",
            "Dra kortet till nästa steg",
            "Dagar sedan senaste händelsen syns på kortet",
            "Totalt pipeline-värde överst",
        ],
        images=["portal-pipeline.png"],
        notes="Säljarens eget verktyg — den här sidan är för dig, inte för "
              "föreningen.\n\n"
              "Siffran på kortet är affärens värde, brickan bredvid är antal "
              "dagar sedan något hände. Det är den man ska titta på: allt "
              "över ett par veckor i »Skickad« behöver ett samtal.\n\n"
              "Korten dras med musen mellan stegen. Vissa hopp är medvetet "
              "spärrade — man kan inte dra ett lead direkt till accepterad, "
              "eftersom en offert måste ha skickats först.",
    ))

    # ── 09 · Offerter ─────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 2 · PÅSKRIFT",
        title="Offerten är samma affär, ett steg fram",
        items=[
            "Skapas ur samma underlag som räkningen",
            "Status följer med tillbaka till pipeline",
            "Accepterad offert startar kampanjen",
        ],
        images=["portal-offerter.png"],
        notes="Kopplingen att lyfta: räknesnurran, offerten och pipeline är "
              "samma affär sedd från tre håll. Du fyller inte i samma "
              "uppgifter tre gånger.\n\n"
              "När offerten accepteras är det inte bara en status som ändras "
              "— det är då föreningens kampanj kan sättas upp och laget "
              "bjudas in. Nästa bild visar vad de då får.",
    ))

    # ── 10 · Säljarens översikt ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 2 · PÅSKRIFT",
        title="Din egen förstasida",
        items=[
            "Aktiva klubbar, offerter ute, stängda i månaden",
            "Pipeline-värde",
            "AI-assistenten föreslår nästa åtgärd",
        ],
        images=["portal-oversikt.png"],
        notes="Kort stopp här — det är en översikt, inget att fördjupa sig "
              "i.\n\n"
              "Det värda att nämna är AI-rutan nere till höger: den tittar på "
              "din pipeline och pekar på vad som ligger och väntar. Den "
              "ersätter inte omdöme, men den fångar det man glömmer en fredag "
              "eftermiddag.",
    ))

    # ── 11 · Föreningens dashboard ────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 3 · FÖRENINGEN",
        title="Det här är vad de köper",
        items=[
            "Total försäljning, ordrar, lag, säljare",
            "Trend över kampanjen",
            "Framsteg mot målet i procent",
            "Lag-ranking",
        ],
        images=["forening-oversikt.png"],
        caption="Uppdateras samma dag som ordern läggs.",
        notes="Den viktigaste bilden i hela mötet. Visa den länge.\n\n"
              "Argumentet: en kassör som har haft hand om en "
              "föreningsförsäljning vet hur det brukar gå till — man vet "
              "ingenting förrän allt är slut, och sedan stämmer summorna "
              "ändå inte.\n\n"
              "Här ser styrelsen läget samma dag. Målraden och lag-rankingen "
              "är dessutom det som får lagen att tävla med varandra, vilket "
              "höjer utfallet utan att någon behöver tjata.\n\n"
              "Om de frågar vem som ser vad: föreningen ser alla lag, "
              "lagledaren ser sitt lag, spelaren ser sitt eget.",
    ))

    # ── 12 · Föreningens lag ──────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 3 · FÖRENINGEN",
        title="Lagen läggs upp en gång",
        items=[
            "Ett lag per grupp, klass eller sektion",
            "Lagledaren bjuds in med länk",
            "Föreningen behöver inte hantera spelarna själv",
        ],
        images=["forening-lag.png"],
        notes="Invändningen den här bilden besvarar: »vem ska administrera "
              "det här hos oss?«.\n\n"
              "Svaret är att föreningen lägger upp lagen en gång och sedan "
              "släpper det. Lagledaren tar sitt lag, spelarna registrerar sig "
              "själva via länk. Kansliet hanterar aldrig enskilda spelare.\n\n"
              "Det är ofta det som fäller avgörandet i en styrelse som redan "
              "känner sig underbemannad.",
    ))

    # ── 13 · Avräkningen ──────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 3 · FÖRENINGEN",
        title="Ingen diskussion om delningen",
        items=[
            "Total försäljning, föreningens andel, vår andel",
            "Uppdelat per lag",
            "Räknas löpande, inte i efterhand",
        ],
        images=["forening-avrakning.png"],
        caption="Öppna böcker är enklare att sälja än bra villkor.",
        notes="Förtroendesliden. Visa den även om ingen frågar.\n\n"
              "Poängen är inte procentsatsen utan att de ser båda sidor av "
              "delningen, hela tiden, utan att be om det. Det är ovanligt i "
              "branschen och det är värt att säga högt.\n\n"
              "Se upp: demokampanjen i bilden är seedad med 30 %. Vårt "
              "erbjudande är 35 %. Prata om principen, inte om talet i "
              "bilden — eller nämn att det är demodata om någon läser "
              "noga.",
    ))

    # ── 14 · Lagledaren ───────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 4 · LAGET",
        title="Lagledaren får en länk och en tavla",
        items=[
            "Lagets försäljning och förtjänst",
            "Milstolpar: nästa 10 paket sålda",
            "Inbjudningslänk att klistra in i lagchatten",
        ],
        images=["lag-oversikt.png"],
        caption="Tröskeln för en ideell tränare måste vara noll.",
        notes="Den som gör jobbet i praktiken är en förälder som tränar P14 "
              "på fritiden. Om det här är krångligt händer ingenting.\n\n"
              "Därför är hela lagledarens uppgift en enda sak: kopiera "
              "länken längst ned och klistra in den i lagchatten. Sedan "
              "registrerar spelarna sig själva.\n\n"
              "Milstolparna är till för lagledaren att peppa med — »tre paket "
              "kvar till nästa«.",
    ))

    # ── 15 · Min shop ─────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 4 · UNGDOMEN",
        title="Ungdomen får en butik i fickan",
        items=[
            "Sålt, ordrar, egen förtjänst, andel av målet",
            "Nivåer: Starter, Brons, Silver",
            "Nästa nivå visar hur långt det är kvar",
            "Registrera order för kontantköp",
        ],
        images=["minshop-start.png"],
        caption="Samma logik som spelen de redan spelar.",
        notes="Här avgörs utfallet. En kampanj lyckas eller misslyckas på om "
              "femtonåringen orkar bry sig.\n\n"
              "Nivåerna är avsiktligt lånade från spelvärlden — man ser hur "
              "långt det är till nästa, aldrig bara var man är. Det är "
              "skillnaden mellan att ge upp och att skicka ett meddelande "
              "till.\n\n"
              "»Registrera order« finns för mormor som betalar kontant: "
              "ungdomen lägger in ordern själv så att den ändå räknas.\n\n"
              "Allt är byggt för telefon först. Ingen ungdom öppnar en laptop "
              "för det här.",
    ))

    # ── 16 · Statistiken ──────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 4 · UNGDOMEN",
        title="Egen statistik, inte föreningens",
        items=[
            "Vad som sålts och när",
            "Egen trend över kampanjen",
            "Ingen ser någon annans siffror",
        ],
        images=["minshop-statistik.png"],
        notes="Kort bild. Det enda som behöver sägas är integritetsdelen: "
              "spelaren ser sitt eget, lagledaren ser lagets, föreningen ser "
              "helheten.\n\n"
              "Får du frågan om utpekande — nej, ingen ungdom hängs ut inför "
              "andra på sin egen sida. Ranking finns på lagnivå.",
    ))

    # ── 17 · Supporterns vy ───────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 5 · KÖPET",
        title="Mormor behöver inget konto",
        items=[
            "»Köp av Leo« — namnet står överst",
            "Kampanjens syfte i klartext",
            "Framsteg mot målet syns för köparen",
            "149 · 149 · 129 kr, paket 399 kr",
        ],
        images=["shop-start.png"],
        caption="Man köper inte schampo. Man köper Leos cup.",
        notes="Den psykologiska poängen: köparen ser vem hon hjälper och till "
              "vad. Texten om vad pengarna går till skrivs av föreningen "
              "själv — resa, boende, matchanmälningar.\n\n"
              "Framstegsraden finns även här, för köparen. Det är samma "
              "mekanism som i en insamling: man vill fylla stapeln.\n\n"
              "Ingen inloggning, inget konto, ingen app. Länken i ett "
              "sms räcker.\n\n"
              "Priserna: schampo 149, conditioner 149, body wash 129, "
              "paketet 399. Det är paketet som ska visas först.",
    ))

    # ── 18 · Kassan ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="STEG 5 · KÖPET",
        title="Kassan tar slut på invändningarna",
        items=[
            "Vanlig e-handelskassa",
            "Ordern knyts till rätt säljare automatiskt",
            "Föreningen ser den samma dag",
        ],
        images=["shop-kassa.png"],
        notes="Sista tekniska bilden. Håll den kort.\n\n"
              "Det enda som behöver sägas: det är en vanlig kassa, av samma "
              "slag som köparen använt hundra gånger. Ingen ska behöva lära "
              "sig någonting.\n\n"
              "Och kopplingen bakåt — ordern hittar rätt säljare, rätt lag "
              "och rätt förening av sig själv. Det är därför siffrorna i "
              "alla föregående bilder stämmer utan att någon för lista.",
    ))

    # ── 19 · Avslut ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="TA MED DIG DET HÄR",
        title="Visa plattformen — prata mindre",
        items=[
            "Öppna räknesnurran i mötet — låt dem dra i reglaget",
            "Skicka länken innan mötet, den säljer åt dig",
            "Föreningens dashboard är det de faktiskt köper",
            "Avräkningen visar du innan de hinner fråga",
            "Lagledarens enda uppgift: klistra in en länk",
        ],
        notes="Sammanfattningen är avsiktligt fem handlingar, inte fem "
              "egenskaper. Det som skiljer ett bra möte från ett dåligt är "
              "inte vad du kan om systemet — det är om du lät dem röra vid "
              "det.\n\n"
              "Avsluta med att alla har egna inloggningar till demomiljön och "
              "bör gå igenom rundturen själva innan första skarpa mötet.",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    render(deck, HERE / FILENAME, DECK_NAME)
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:9} {s.title[:58]}")
