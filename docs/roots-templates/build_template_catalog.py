#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Roots presentationsmallar — mall-katalog (.pptx).

Visar varje återanvändbar mall från roots_templates.Deck med platshållar-
innehåll, så man snabbt ser vilken layout man vill ha. Samma känsla, färger
och typsnitt (Alan Sans + Inter) som hemsidan och den förra presentationen.

Kör:  .venv/bin/python docs/roots-templates/build_template_catalog.py
"""
import os
from roots_templates import Deck

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "Roots_Presentationsmallar.pptx")

d = Deck(footer_label="Presentationsmallar")

# 00 · Titelsida för själva katalogen
d.cover(
    kicker="Designsystem för presentationer",
    title1="Roots",
    title2="presentationsmallar",
    subtitle="Ett bibliotek av färdiga slide-mallar byggda på vår brandbook. "
             "Välj en layout, byt ut texten och bilden — klart.",
)

# 01 · Avsnittsdelare
d.divider(num="01", title="Avsnittsdelare")
d.tag(d.prs.slides[-1], "Mall 01 · Divider")

# 02 · Endast rubrik
d.title_only(kicker="Mall 02 · Endast rubrik",
             title="Ett tydligt påstående som får ta plats.")
d.tag(d.prs.slides[-1], "Mall 02 · Endast rubrik")

# 03 · Rubrik + textruta
d.title_text(kicker="Mall 03 · Rubrik + text",
             title="Rubrik plus ett stycke",
             body=["Använd när du vill förklara något i löpande text. Håll det "
                   "kort — en till två korta stycken räcker.",
                   "Ett andra stycke kan komplettera det första utan att "
                   "sidan blir tung."])
d.tag(d.prs.slides[-1], "Mall 03 · Rubrik + text")

# 04 · Rubrik + punktlista
d.title_bullets(kicker="Mall 04 · Punktlista",
                title="Rubrik plus punkter",
                bullets=["Första poängen — kort och konkret",
                         "Andra poängen som bygger vidare",
                         "Tredje poängen",
                         "Fjärde poängen"])
d.tag(d.prs.slides[-1], "Mall 04 · Punktlista")

# 05 · Agenda
d.agenda(kicker="Mall 05 · Agenda",
         title="Agenda",
         items=["Nuläge", "Mål", "Strategi", "Plan", "Erbjudande",
                "System", "Förutsättningar", "Organisation", "Avslut"])
d.tag(d.prs.slides[-1], "Mall 05 · Agenda")

# 06 · Rubrik + bild (höger)
d.title_image(kicker="Mall 06 · Rubrik + bild + text",
              title="Text till vänster, bild till höger",
              body=["Perfekt när ett foto förstärker budskapet. Texten "
                    "förklarar, bilden ger känslan.",
                    "Byt enkelt ut bilden mot vilken produkt- eller "
                    "livsstilsbild som helst."],
              image="images/collection-1.jpg", img_side="right")
d.tag(d.prs.slides[-1], "Mall 06 · Rubrik + bild + text")

# 07 · Bild (vänster) + text
d.title_image(kicker="Mall 07 · Bild + text",
              title="Bild till vänster",
              body=["Samma mall som 06 men speglad. Bra för variation när du "
                    "har flera bild-sidor efter varandra."],
              image="images/collection-4.jpg", img_side="left")
d.tag(d.prs.slides[-1], "Mall 07 · Bild + text (spegel)")

# 08 · Helbild med overlay
d.image_full(title="Helbild med rubrik",
             subtitle="När bilden ska bära hela känslan.",
             image="images/collection-2.jpg")
d.tag(d.prs.slides[-1], "Mall 08 · Helbild")

# 09 · Två kolumner
d.two_col(kicker="Mall 09 · Två kolumner",
          title="Ställ två saker mot varandra",
          left_title="Före",
          left_body=["Hur det ser ut idag. Kort och tydligt.",
                      "En andra rad om det behövs."],
          right_title="Efter",
          right_body=["Hur det ser ut med Roots.",
                      "Fördelen sammanfattad."])
d.tag(d.prs.slides[-1], "Mall 09 · Två kolumner")

# 10 · Kort (3)
d.cards(kicker="Mall 10 · Kort",
        title="Tre kort bredvid varandra",
        cards=[("Kort ett", "En kort beskrivning som ryms på ett par rader."),
               ("Kort två", "Använd 2–4 kort. Layouten anpassar bredden."),
               ("Kort tre", "Bra för värden, steg eller egenskaper.")])
d.tag(d.prs.slides[-1], "Mall 10 · Kort")

# 11 · Nyckeltal
d.stat(kicker="Mall 11 · Nyckeltal",
       title="Stora siffror som fastnar",
       stats=[("35 %", "till föreningen"),
              ("0 kr", "i uppstart"),
              ("2 v", "säljperiod")])
d.tag(d.prs.slides[-1], "Mall 11 · Nyckeltal")

# 12 · Citat / statement
d.quote(text="Vi vill att föreningslivet i Sverige ska blomstra.",
        attribution="Roots")
d.tag(d.prs.slides[-1], "Mall 12 · Citat")

# 13 · Produktkort
d.products(kicker="Mall 13 · Produkter",
           title="Produktkort med bild",
           cards=[("Roots Schampoo", "Schampo", "SyriCalm® lugnar hårbotten."),
                  ("Roots Conditioner", "Balsam", "Pro-Vitamin B5 & antioxidanter."),
                  ("Roots Body Wash", "Body Wash", "Mild, sulfatsnål rengöring.")])
d.tag(d.prs.slides[-1], "Mall 13 · Produkter")

# 14 · Flöde / steg
d.flow(kicker="Mall 14 · Flöde",
       title="Steg för steg",
       steps=["Registrera", "Sätt mål", "Bjud in", "Sälj",
              "Följ live", "Avsluta", "Lever ut", "Redovisa"])
d.tag(d.prs.slides[-1], "Mall 14 · Flöde")

# 15 · Skärmar / mockups
d.screens(kicker="Mall 15 · Skärmar",
          title="Visa upp plattformen",
          screens=[("images/collection-3.jpg", "Dashboard", "Live-statistik"),
                   ("images/collection-1.jpg", "Säljarsida", "Personlig shop"),
                   ("images/collection-4.jpg", "Rapport", "Efter perioden")])
d.tag(d.prs.slides[-1], "Mall 15 · Skärmar")

# 16 · Rubrik + stor siffra
d.big_number(kicker="Mall 16 · Stor siffra",
             number="35 %",
             label="tillbaka till föreningen",
             sub="När en enda siffra är hela poängen — låt den ta plats.")
d.tag(d.prs.slides[-1], "Mall 16 · Stor siffra")

# 17 · Tidslinje
d.timeline(kicker="Mall 17 · Tidslinje",
           title="Så ser resan ut",
           milestones=[("Vecka 1", "Registrera förening & sätt mål"),
                       ("Vecka 2", "Bjud in säljare, kickoff"),
                       ("Vecka 3–4", "Säljperiod – följ live"),
                       ("Vecka 5", "Avslut, leverans & redovisning")])
d.tag(d.prs.slides[-1], "Mall 17 · Tidslinje")

# 18 · Tabell
d.table(kicker="Mall 18 · Tabell",
        title="Jämför alternativen",
        headers=["", "Roots", "Traditionell försäljning"],
        rows=[["Förtjänst till föreningen", "35 %", "20–25 %"],
              ["Uppstartskostnad", "0 kr", "Lager i förskott"],
              ["Administration", "Digital, automatisk", "Manuell"],
              ["Produkt att återköpa", "Ja", "Sällan"]])
d.tag(d.prs.slides[-1], "Mall 18 · Tabell")

# 19 · Team
d.team(kicker="Mall 19 · Team",
       title="Vilka vi är",
       members=[("images/collection-1.jpg", "Namn Efternamn", "Grundare"),
                ("images/collection-3.jpg", "Namn Efternamn", "Grundare"),
                ("images/collection-4.jpg", "Namn Efternamn", "Grundare")])
d.tag(d.prs.slides[-1], "Mall 19 · Team (byt ut foton)")

# 20 · Avslutning
d.closing(title="Tack.", subtitle="Frågor & nästa steg")
d.tag(d.prs.slides[-1], "Mall 20 · Avslutning")

d.save(OUT)
print("PPTX:", OUT, f"({len(d.prs.slides._sldIdLst)} slides)")
