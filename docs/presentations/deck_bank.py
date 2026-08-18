"""Bankpresentation — underlag för kreditdiskussion.

Syfte: visa vad Ourroots AB redan byggt (produkt + plattform), hur
kapitalet använts effektivt jämfört med byråmarknaden 2026, och hur
driftskostnaden ser ut framåt. Inte en säljpitch till föreningar.

    python3 docs/presentations/deck_bank.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from slide_model import Column, Deck, Slide  # noqa: E402

FILENAME = "Roots_Bankpresentation.pptx"
DECK_NAME = "Roots · Bankunderlag"
PDF_NAME = "Roots_Bankpresentation.pdf"


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
        number=next(n), layout="cover", kicker="OURROOTS AB · BANKUNDERLAG",
        title="Plattformen är byggd.\nKapitalet ska skala den.",
        subtitle="Premium hårvård via digital föreningsförsäljning — "
                 "produkt, teknik och go-to-market i samma bolag.",
        images=["images/sport-pres-cover.jpg"],
        notes="Rama in: banken har redan tillgång till demomiljön. "
              "Detta dokument är det skriftliga underlaget — vad som finns, "
              "vad det kostat och varför nästa kapitalsteg är skalning "
              "snarare än experiment.",
    ))

    # ── 02 · Bolaget i korthet ────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="BOLAGET",
        title="Vad Roots är",
        items=[
            "Affärsmodell | Premium hårvård som säljs via idrottsföreningar. "
            "Cirka 35 % av försäljningen går tillbaka till föreningen.",
            "Erbjudande | Premiumpaket 399 kr (schampo + balsam + body wash) + "
            "komplett digital plattform för lag, säljare och köpare.",
            "Bolag | Ourroots AB · 559355-7126 · Hallängsvägen 8, 439 55 Åsa · "
            "info@roots.nu",
            "Läge | Produkt och plattform är live. Säljstart pågår. "
            "Demomiljö delad med banken.",
        ],
        caption="Roots äger både varumärke och teknik — inte enbart en webbutik.",
        notes="Håll det faktabaserat. Poängen för banken: det finns en "
              "färdig intäktsmaskin att skala, inte en idé på papper.",
    ))

    # ── 03 · Problemet vi löser ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="columns", kicker="MARKNADEN",
        title="Föreningslivet behöver finansiering — utan pärmar",
        left=Column(
            heading="Traditionellt",
            items=[
                "Fysiska produkter och listor",
                "Kontanter och efterarbete",
                "Osäker uppföljning",
                "Låg premiumkänsla",
            ],
        ),
        right=Column(
            heading="Roots",
            items=[
                "Personlig digital shop per säljare",
                "Onlinebetalning, ingen kontanthantering",
                "Realtidsstatistik till föreningen",
                "Premiumprodukt köparen vill ha kvar",
            ],
        ),
        caption="Samma behov som Teamboost, Klubbförsäljning och Lagsälj — "
                "men med egen premiumprodukt och egen plattform.",
        notes="Marknaden finns redan: digital klubbförsäljning växer i Sverige. "
              "Roots differentierar med egen hårvård + helägd teknikstack.",
    ))

    # ── 04 · Konkurrentlandskap ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="table", kicker="OMVÄRLD · TRADITIONELLA AKTÖRER",
        title="Salamikungen, Newbody och Ravelli — publika siffror",
        columns=["Aktör", "Till klubben · omsättning · resultat"],
        items=[
            "Delikatesskungen | Till klubb: ca 60–90 kr/produkt. "
            "Oms. ca 38,9 Mkr (2025). Resultat ca 3,3 Mkr.",
            "Newbody Family | Till klubb: ca 25 %. "
            "Oms. ca 259 Mkr (2025). EBIT ca 32 Mkr · resultat ca 19,5 Mkr.",
            "Ravelli | Till klubb: ca 28–33 % (55–68 kr/paket). "
            "Oms. ca 20,8 Mkr (2024). Resultat ca 0,3 Mkr.",
            "Roots | 35 % låst · premiumprodukt · egen digital plattform.",
        ],
        caption="Källor: bolagens webb + Allabolag/Hitta (bokslut). "
                "Indikativt — inte due diligence.",
        notes="Poängen: kategorin är bevisad och lönsam (Newbody ~259 Mkr). "
              "Roots tar samma behov men med högre andel till klubben än Newbody "
              "och med premium hårvård + egen teknik.",
    ))

    # ── 05 · Produkt vs marknad ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="compare", kicker="PRODUKTEN",
        title="Roots mot jämförbara premiummärken",
        subtitle="Pris per 100 ml · procent = hur mycket billigare Roots är",
        items=[
            "Schampo | Roots | Roots Schampoo | 79,60 kr | 199 kr / 250 ml | Vårt pris | Sulfatsnålt · SyriCalm®",
            "Schampo | Maria Nila | True Soft Shampoo | 91,14 kr | 319 kr / 350 ml | −13 % | Sulfatfritt · torrt hår",
            "Schampo | Sachajuan | Moisturizing Shampoo | 131,60 kr | 329 kr / 250 ml | −40 % | Ocean Silk",
            "Schampo | Davines | Essential Minu Shampoo | 131,60 kr | 329 kr / 250 ml | −40 % | Färgskydd",
            "Balsam | Roots | Roots Conditioner | 79,60 kr | 199 kr / 250 ml | Vårt pris | Panthenol · SyriCalm®",
            "Balsam | Maria Nila | True Soft Conditioner | 91,14 kr | 319 kr / 350 ml | −13 % | Sulfatfritt · torrt hår",
            "Balsam | Sachajuan | Moisturizing Conditioner | 138,00 kr | 345 kr / 250 ml | −42 % | Återfuktning",
            "Balsam | Davines | Essential Minu Conditioner | 139,60 kr | 349 kr / 250 ml | −43 % | Färgskydd",
            "Body wash | Roots | Roots Body Wash | 71,60 kr | 179 kr / 250 ml | Vårt pris | Sulfatsnålt · SyriCalm®",
            "Body wash | Estelle & Thild | Citrus Menthe | 103,50 kr | 207 kr / 200 ml | −31 % | COSMOS Organic",
            "Body wash | L'Occitane | Verbena Shower Gel | 87,60 kr | 219 kr / 250 ml | −18 % | Verbena · citrus",
            "Body wash | Verso | Body Oil Cleanser | 200,00 kr | 600 kr / 300 ml | −64 % | BHA · exfolierande",
        ],
        notes="Återskapad som riktiga kort. Styckpriser i jämförelsen; "
              "huvuderbjudandet i sälj är Premiumpaketet 399 kr.",
    ))

    # ── 06 · Erbjudandet ──────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="kpi", kicker="FÖRSÄLJNINGSERBJUDANDET",
        title="Vi säljer generellt i paket — hela rutinen",
        items=[
            "399 kr | Premiumpaket: 1 schampo + 1 balsam + 1 body wash",
            "35 % | Till föreningen (= ca 140 kr per paket)",
            "149 kr | Styckpris schampo/balsam (body wash 129)",
            "Påfyllning | Mellan kampanjer via samma shop",
        ],
        caption="Paketet är standarderbjudandet. Styck finns kvar som alternativ.",
        notes="399 sparar 28 kr mot 427 i styck. 35 % av 399 ≈ 139,65 kr till klubben.",
    ))

    # ── 07 · Antaganden ───────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="SKALNING · ANTAGANDEN",
        title="Så räknar vi en typisk förening",
        items=[
            "Medlemmar | 400–500 aktiva per förening (vi använder 450 i mittläget)",
            "Sälj per medlem | 6 Premiumpaket à 399 kr under kampanjen",
            "Per förening | 2 700 paket · ca 1,08 Mkr i omsättning · "
            "ca 377 tkr till föreningen",
            "Marknad | RF ca 18 000 idrottsföreningar i Sverige "
            "(väl över 13 000)",
        ],
        caption="Plus recurring: återköp mellan kampanjer räknas inte in nedan — "
                "uppsidan är större.",
        notes="Var tydlig: detta är modell, inte prognos. 6 paket/medlem är "
              "ambitiöst men i linje med hur traditionell föreningsförsäljning "
              "räknar säljmål per säljare.",
    ))

    # ── 08 · Skalningsscenarier ───────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="table", kicker="SKALNING · KAMPANJ",
        title="20, 40 och 100 föreningar — mittläge (450 medlemmar)",
        columns=["Scenario", "Omsättning · till föreningar · till Roots"],
        items=[
            "20 föreningar | Oms. ca 21,5 Mkr · klubbar ca 7,5 Mkr · Roots ca 14,0 Mkr",
            "40 föreningar | Oms. ca 43,1 Mkr · klubbar ca 15,1 Mkr · Roots ca 28,0 Mkr",
            "100 föreningar | Oms. ca 107,7 Mkr · klubbar ca 37,7 Mkr · Roots ca 70,0 Mkr",
            "Känslighet 400–500 medl. | Per förening ca 0,96–1,20 Mkr omsättning",
            "Recurring | Extra mellan kampanjer via personliga shoppar — ej inräknat",
        ],
        caption="Per förening: 450 × 6 × 399 kr. 35 % / 65 % fördelning. "
                "Indikativ modell.",
        notes="100 föreningar = under 1 % av RF:s ca 18 000 föreningar. "
              "Det är därför skalningen är trovärdig som adressbar marknad.",
    ))

    # ── 09 · Vad som är byggt ─────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="PLATTFORMEN",
        title="Inte en webbshop — ett komplett operativsystem",
        items=[
            "Publik sajt | Marknadsföring SV/EN, produkter, guider, SEO, kontakt",
            "Köpflöde | Personliga shoppar, Klarna-kassa, webhooks, orderkoppling",
            "Förening & lag | Dashboard, säljare, CSV-import, mål, avräkning",
            "Säljportal | Pipeline, offerter, räknesnurrа, statistik, AI-stöd",
            "Backoffice | 9 roller, MFA, BankID-klart, Fortnox, GDPR-radering",
        ],
        caption="~80 000 rader kod · ~117 API-endpoints · 63 sidor · live i demomiljön.",
        notes="Detta är kärnan i kreditargumentet: CAPEX i teknik är redan "
              "tagen. Lånet finansierar tillväxt, lager och go-to-market.",
    ))

    # ── 08–11 · Skärmdumpar ───────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="skarm", kicker="SKÄRM · PUBLIK SAJT",
        title="Första intrycket säljer innan mötet",
        items=[
            "Varumärke och erbjudande på plats",
            "Tydlig väg in för föreningar",
            "Redo att visas för styrelser",
        ],
        images=["publik-start.png"],
        notes="Skärmbild från liveplattformen med demodata.",
    ))

    slides.append(Slide(
        number=next(n), layout="skarm", kicker="SKÄRM · PRODUKTER",
        title="Sortimentet är publikt och köpbart",
        items=[
            "Tre SKU + paketlogik",
            "Premiumposition utan dagligvarupris",
            "Samma produkter i varje lagshop",
        ],
        images=["publik-produkter.png"],
    ))

    slides.append(Slide(
        number=next(n), layout="skarm", kicker="SKÄRM · FÖRENING",
        title="Föreningen ser pengarna samma dag",
        items=[
            "Dashboard per lag och säljare",
            "Ingen Excel-lista i efterhand",
            "Avräkning inbyggd i flödet",
        ],
        images=["forening-oversikt.png"],
    ))

    slides.append(Slide(
        number=next(n), layout="phones", kicker="SKÄRM · SÄLJARENS FICKA",
        title="Ungdomen säljer från telefonen",
        items=["Min shop", "Statistik"],
        images=["minshop-start.png", "minshop-statistik.png"],
        caption="Personlig länk, ingen pärm.",
    ))

    slides.append(Slide(
        number=next(n), layout="desktops", kicker="SKÄRM · SÄLJPORTAL",
        title="Internt säljarbete är digitalt från dag ett",
        items=["Översikt", "Räknesnurran"],
        images=["portal-oversikt.png", "portal-raknesnurra.png"],
        caption="Samma system säljaren använder i kundmöten.",
    ))

    # ── 12 · Utvecklingskostnad faktisk ───────────────────────────────
    slides.append(Slide(
        number=next(n), layout="kpi", kicker="INVESTERING HITILLS",
        title="Så här mycket har plattformen kostat oss",
        items=[
            "240 tkr | Ersättning för utveckling",
            "30 tkr | AI-tokens / verktyg (högt räknat)",
            "270 tkr | Total utvecklingskostnad",
            "≈14 tkr/mån | Drift + underhåll framåt",
        ],
        caption="Infrastruktur några tusenlappar/mån + 10 tkr/mån tekniskt "
                "underhåll och vidareutveckling.",
        notes="Var transparent: 270 tkr är faktisk kostnad, inte marknadsvärde. "
              "Nästa slide visar vad en byrå hade tagit för samma scope.",
    ))

    # ── 13 · Byråtimmar ───────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="table", kicker="BYRÅKALKYL 2026",
        title="Samma plattform — estimerade byråtimmar",
        columns=["Modul (det som faktiskt finns)", "Estimerade timmar"],
        items=[
            "Discovery, UX, designsystem | 180–280 h",
            "Marknadssajt SV/EN + SEO | 200–320 h",
            "E-handel, Klarna, orderflöde | 280–420 h",
            "Förening, lag, GDPR | 450–700 h",
            "Säljportal CRM + räknesnurra | 400–650 h",
            "Avräkning, Fortnox | 220–380 h",
            "Auth, roller, MFA, BankID | 280–420 h",
            "AI, DevOps, QA, projekt | 650–1 050 h",
        ],
        caption="Summa ca 2 650–4 220 h. Blended byråpris 2026: "
                "ca 1 250–1 450 kr/h.",
        notes="Källor: ClickWebb SaaS 2026, Swivrr skräddarsydd mjukvara, "
              "Ketryon. Roots är multi-sided ops-plattform — inte Shopify.",
    ))

    # ── 14 · Byråpris i kronor ────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="table", kicker="MARKNADSPRIS",
        title="Vad det skulle kosta att beställa samma sak 2026",
        columns=["Kalkyl", "Belopp"],
        items=[
            "Låg: 2 650 h × 1 250 kr | ca 3,3 Mkr",
            "Mitt: 3 400 h × 1 350 kr | ca 4,6 Mkr",
            "Hög: 4 220 h × 1 450 kr | ca 6,1 Mkr",
            "Vägledande spann | ca 3,5 – 6 Mkr",
            "Marknadsguider SaaS | Konkurrenskraftig v1: 0,8–2 Mkr · "
            "avancerad/enterprise: 2–5 Mkr+",
            "Roots faktiska kostnad | 0,27 Mkr",
        ],
        caption="Guider: ClickWebb, Swivrr, Ketryon (2026). Roots ≈ avancerad "
                "SaaS/ops-plattform — 900 tkr räcker knappt till enkel e-handel.",
        notes="900 tkr räcker till enkel e-handel med integrationer. "
              "Roots har fyra portaler, pengaflöde, Fortnox och RBAC.",
    ))

    # ── 15 · Effektivitet ─────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="bignumber", kicker="KAPITALEFFEKTIVITET",
        title="Byggkostnaden är redan tagen — till en bråkdel av byråpris",
        items=[
            "~17×",
            "Lägre än mittspannet för svensk byrå (ca 4,5 Mkr mot 270 tkr).",
            "Ägande av koden | Inga licenslås till byråplattform",
            "Låg burn i drift | Cirka 13–15 tkr per månad i teknik",
            "Redo att skala | Nästa krona går till volym, inte ombyggnad",
        ],
        caption="Varje lånekrona kan gå till lager, sälj och rörelsekapital.",
        notes="270 / 4 600 ≈ 6 % av byråalternativet.",
    ))

    # ── 16 · Driftkalkyl ──────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="calc", kicker="LÖPANDE KOSTNAD",
        title="Driftbudget teknik — månad för månad",
        items=[
            "Hosting / databas / CDN | ~1–2 tkr",
            "E-post, lagring, övervakning | ~1 tkr",
            "Betalväxel & övriga SaaS | ~1–2 tkr",
            "Tekniskt underhåll & vidareutveckling | 10 tkr",
        ],
        columns=[
            "Cirka 13–15 tkr / månad",
            "Några tusenlappar i infrastruktur plus 10 tkr "
            "för underhåll och utveckling. Årstakt ca 160–180 tkr — "
            "mot 15–20 % av byråbyggkostnad (ofta 500–900+ tkr/år) "
            "bara i förvaltning för ett 4–5 Mkr-bygge.",
        ],
        notes="Tumregel 15–20 % av byggkostnad/år. För 4,5 Mkr = 675–900 tkr/år.",
    ))

    # ── 16 · Go-to-market signal ──────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="points", kicker="SÄLJSTART",
        title="Första signalerna från marknaden",
        items=[
            "Säljorganisationen är igång",
            "Första muntliga accept inom första veckan",
            "Demomiljö aktiv och delad med banken",
            "Nästa steg: konvertera dialoger till avtal och volym",
        ],
        images=["images/sport-m2.jpg"],
        caption="Tidiga signaler — inte PoC i siffror. Plattformen är produktionsklar.",
        notes="Var ärlig: två muntliga accept är positiva men inte kreditgrund. "
              "Det som är kreditrelevant är att verktyget för att ta emot "
              "volym redan finns.",
    ))

    # ── 17 · Vad kapitalet ska göra ───────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="cards", kicker="ANVÄNDNING AV MEDEL",
        title="Lånet ska skala det som redan fungerar",
        items=[
            "Rörelsekapital | Lager, frakt och betalvillkor när ordrar tar fart",
            "Go-to-market | Säljkapacitet, material och lokal närvaro",
            "Vidareutveckling | Prioriterade förbättringar i befintlig plattform",
            "Inte ombyggnad | Teknikstacken behöver inte finansieras från noll",
        ],
        caption="Exakt belopp och amorteringsplan diskuteras i dialog med banken.",
        notes="Vi anger medvetet inte lånebelopp här — det är bankdialog. "
              "Sliden sätter riktningen: skala, inte bygga om.",
    ))

    # ── 18 · Team ─────────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="team", kicker="MÄNNISKORNA",
        title="Team med förenings- och produktvana",
        subtitle="Roots byggs av människor som kan kedjan från laget till kassan.",
        items=[
            "Kent Gustafson",
            "Fredrik Lindqvist",
            "Johan Lindqvist",
            "Christopher Genberg",
            "Ola Nordlund",
            "Johan Fogell",
            "Niclas Corse",
            "Matilda Stukat Grauers",
        ],
        images=[
            "personal/kent-gustafson.jpg",
            "personal/fredrik-lindqvist.jpg",
            "personal/johan-lindqvist.jpg",
            "personal/christopher-genberg.jpg",
            "personal/ola-nordlund.jpg",
            "personal/johan-fogell.jpg",
            "personal/niclas-corse.jpg",
            "personal/matilda.jpg",
        ],
        notes="Kort presentation — namn och gemenskap.",
    ))

    # ── 19 · Sammanfattning ───────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="hero", kicker="SAMMANFATTNING",
        title="Färdig plattform. Effektivt bygge. Låg driftkostnad. Redo att skala.",
        items=[],
        notes="Tre meningar att lämna kvar: (1) tekniken finns, (2) den "
              "kostade en bråkdel av byråpris, (3) kapitalet behövs för "
              "volym — inte för att bevisa att systemet kan byggas.",
    ))

    # ── 20 · Avslut ───────────────────────────────────────────────────
    slides.append(Slide(
        number=next(n), layout="close", kicker="NÄSTA STEG",
        title="Vi tar gärna en genomgång live",
        items=[
            "Öppna demomiljön ni redan har inlogg till",
            "Gå igenom föreningsportal och säljarflöde tillsammans",
            "Diskutera belopp, säkerheter och tidplan",
            "Kontakt: info@roots.nu · Ourroots AB · 559355-7126",
        ],
        notes="Avsluta med öppenhet: banken kan klicka sig igenom systemet. "
              "Presentationen är komplement, inte ersättning.",
    ))

    return Deck(title=DECK_NAME, slides=slides)


if __name__ == "__main__":
    from build_decks import HERE, render

    deck = build()
    out = HERE / FILENAME
    render(deck, out, DECK_NAME)
    for s in deck.slides:
        print(f"  {s.number:02d} {s.layout:10} {s.title[:58]}")
    print(f"\nWrote {out}")
