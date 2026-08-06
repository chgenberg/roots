"""De tre presentationerna, byggda direkt ur Master Source.

Ingen brödtext skrivs av här. Varje sträng hämtas ur kollegans specifikationer
via ms_source, eftersom modulinstruktionen är uttrycklig:

    "Den svenska texten ska användas exakt enligt respektive Slide Specification
    och får inte översättas eller omformuleras av designagenten."

Vad som bestäms här är alltså bara struktur: vilka MS-ID som ingår i vilken
presentation, i vilken ordning, och vilken renderare som motsvarar respektive
Layout/Grafik-anvisning. Ordagrannheten kontrolleras av verify_verbatim.py.

Presentationerna:

    D1  Säljpresentation      MS-001–015. Commercial Playbook mot förening:
                              vision, affären och plattformen — den arc som
                              specifikationerna själva anger, avslutad med
                              potentialkalkylen i MS-015.
    D2  Roadmap år 1–5        MS-114 (Year 1 Execution Roadmap) och MS-115
                              (Five-Year Growth Roadmap).
    D3  Övergripande          Vision, erbjudandet, plattformen och vårt
                              arbetssätt (MS-017–020) för internt bruk.
    D4  År 1 i detalj         MS-114 ensam, med de avsnitt som inte får plats
                              i D2: värdepelarna, beslutsfaserna, vad BUILD och
                              PREPARE TO SCALE innebär, budgetens och
                              säljplanens innehåll, och ett eget uppslag per
                              kvartal.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "knowledge-os"))

import ms_source as ms  # noqa: E402
from slide_model import Column, Deck, Slide  # noqa: E402

SPECS, DOCS = ms.load()

# Kickern är navigation, inte innehåll: den namnger modulen sliden kommer ur.
MODULE_KICKER = {
    "roots-master-source-modul-1-vision-v1-0.md": "VISION",
    "roots-master-source-modul-2-affaren-v1-0.md": "AFFÄREN",
    "roots-master-source-modul-3-plattform-v1-0.md": "PLATTFORMEN",
    "roots-master-source-fran-modul-4-till-slutet-av-chatten.md": "COMMERCIAL PLAYBOOK",
}

NOTE_FIELDS = [
    ("Syfte", "Syfte"),
    ("Frågan sliden besvarar", "Frågan sliden besvarar"),
    ("Huvudbudskap", "Huvudbudskap"),
    ("Stödjande budskap", "Stödjande budskap"),
    ("Take-away", "Take-away"),
    ("Speaker Notes", "Speaker Notes"),
    ("Presentatörens uppgift", "Presentatörens uppgift"),
    ("Övergång", "Övergång"),
    ("Designnoteringar", "Designnoteringar"),
    ("Editorial Notes", "Editorial Notes"),
    ("Faktastatus", "Faktastatus"),
]


def notes_for(ms_id: str) -> str:
    """Talarmanuset — allt kollegan skrivit om sliden, ordagrant."""
    spec = SPECS[ms_id]
    out: list[str] = []
    for field, label in NOTE_FIELDS:
        lines = spec.paras(field)
        if not lines:
            continue
        out.append(f"{label.upper()}")
        out.extend(lines)
        out.append("")
    out.append(f"Källa: {ms_id} · {spec.source_file}")
    return "\n".join(out)


def _slide(number: int, layout: str, ms_id: str, **kwargs) -> Slide:
    spec = SPECS[ms_id]
    return Slide(
        number=number,
        layout=layout,
        kicker=kwargs.pop("kicker", MODULE_KICKER.get(spec.source_file, "")),
        title=kwargs.pop("title", spec.text("Titel")),
        subtitle=kwargs.pop("subtitle", spec.text("Undertitel")),
        notes=kwargs.pop("notes", notes_for(ms_id)),
        source=ms_id,
        **kwargs,
    )


def _cells(pairs) -> list[str]:
    return [f"{a} | {b}" for a, b in pairs]


# ══════════════════════ D1 · Säljpresentation ═══════════════════════════
def build_d1() -> Deck:
    S = SPECS
    n = iter(range(1, 99))
    slides: list[Slide] = []

    # Omslag: MS-001 är signatursliden som öppnar berättelsen.
    slides.append(Slide(
        number=next(n), layout="cover", kicker="COMMERCIAL PLAYBOOK",
        title=S["MS-001"].text("Titel"), subtitle=S["MS-001"].text("Undertitel"),
        images=["images/m3.jpg"], source="MS-001",
        notes=notes_for("MS-001"),
    ))

    # MS-001 · "ROOTS som ett centralt nav med tre jämnstora pelare"
    slides.append(_slide(
        next(n), "cards", "MS-001",
        items=_cells(S["MS-001"].pairs("Slide-innehåll", "Tre bärande delar")),
        caption=S["MS-001"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-002 · "Två tydliga visuella fält med ett luftigt mellanrum"
    left = S["MS-002"].under("Slide-innehåll", "Vänster sida")
    right = S["MS-002"].under("Slide-innehåll", "Höger sida")
    slides.append(_slide(
        next(n), "columns", "MS-002",
        left=Column(heading=left[0], items=left[1:]),
        right=Column(heading=right[0], items=right[1:]),
        caption=S["MS-002"].under("Slide-innehåll", "Mellan ytorna")[0],
    ))

    # MS-003 · "En stor siffra som blickfång, med tre mindre produktroller"
    slides.append(_slide(
        next(n), "bignumber", "MS-003",
        items=[S["MS-003"].under("Slide-innehåll", "Stor huvuduppgift")[0],
               S["MS-003"].under("Slide-innehåll", "Under")[0]]
        + _cells(S["MS-003"].pairs("Slide-innehåll", "Tre produktkort")),
    ))

    # MS-004 · "Tre vertikala premiumkort med en kort slutsats längst ned"
    slides.append(_slide(
        next(n), "cards", "MS-004",
        items=_cells(S["MS-004"].pairs("Slide-innehåll", "Tre byggstenar")),
        caption=S["MS-004"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-005 · "Fyra jämbördiga pelare eller kvadranter runt ROOTS-logotypen"
    slides.append(_slide(
        next(n), "cards", "MS-005",
        items=_cells(S["MS-005"].pairs("Slide-innehåll", "Fyra värdepelare")),
        caption=S["MS-005"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-006 · "Ett centralt ROOTS-nav med tio funktionskort runt omkring"
    slides.append(_slide(
        next(n), "flywheel", "MS-006",
        items=S["MS-006"].bullets("Slide-innehåll"),
        columns=["ROOTS", ""],
        caption=S["MS-006"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-007 · "Cirkulär affärsmodell med sex steg"
    flow = S["MS-007"].flow("Slide-innehåll")
    slides.append(_slide(
        next(n), "flywheel", "MS-007",
        items=flow[:6],
        columns=["ROOTS", ""],
        caption=S["MS-007"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-008 · "Tre flaskor. Mycket luft. Produktnamn. Kort benefit."
    products = S["MS-008"].lines("Slide-innehåll")[1:4]
    benefits = S["MS-008"].bullets("Stödjande budskap")
    slides.append(_slide(
        next(n), "products", "MS-008",
        items=[f"{name} | {benefits[i] if i < len(benefits) else ''}"
               for i, name in enumerate(products)],
        images=["images/schampoo.jpg", "images/conditioner.jpg",
                "images/body-wash.jpg"],
        caption=S["MS-008"].under("Slide-innehåll", "Nederst")[0],
    ))

    # MS-009 · "Tre premiumpelare." Inga beskrivningar anges i specifikationen.
    slides.append(_slide(
        next(n), "words", "MS-009",
        items=S["MS-009"].under("Slide-innehåll", "Tre byggstenar"),
    ))

    # MS-010 · "En horisontell kundresa med fem steg"
    slides.append(_slide(
        next(n), "timeline", "MS-010",
        items=S["MS-010"].flow("Slide-innehåll"),
    ))

    # MS-011 · "Stor dashboard. Minimalistisk." Fyra informationskort.
    slides.append(_slide(
        next(n), "words", "MS-011",
        items=S["MS-011"].bullets("Slide-innehåll"),
    ))

    # MS-012 · "Personer kopplade mot samma nav."
    slides.append(_slide(
        next(n), "flywheel", "MS-012",
        items=S["MS-012"].lines("Stödjande budskap"),
        columns=["Gemensam", "databas"],
    ))

    # MS-013 · "Linjärt flöde med fyra steg"
    slides.append(_slide(
        next(n), "timeline", "MS-013",
        items=S["MS-013"].lines("Stödjande budskap"),
    ))

    # MS-014 · "Tre sammanlänkade cirklar runt ett centralt ROOTS Support Center"
    slides.append(_slide(
        next(n), "flywheel", "MS-014",
        items=S["MS-014"].bullets("Slide-innehåll"),
        columns=["Support", "Center"],
    ))

    # MS-015 · "Delad layout: vänster kalkylpanel, höger resultatkort"
    slides.append(_slide(
        next(n), "calc", "MS-015",
        items=S["MS-015"].bullets("Slide-innehåll"),
        columns=[S["MS-015"].text("Take-away"), S["MS-015"].text("Huvudbudskap")],
    ))

    # Avslut: MS-015 är sista sliden i mötesresan, dess take-away stänger mötet.
    slides.append(Slide(
        number=next(n), layout="close", kicker="NÄSTA STEG",
        title=S["MS-015"].text("Take-away"),
        items=S["MS-015"].bullets("Stödjande budskap"),
        source="MS-015", notes=notes_for("MS-015"),
    ))

    return Deck(title="Säljpresentation", slides=slides)


# ══════════════════════ D2 · Roadmap år 1–5 ═════════════════════════════
Q_STOP = {
    "Fokus", "Prioriteringar", "Leverans", "Primär leverans",
    "Föreningarnas försäljningsperioder", "Order- och leveransunderlag",
    "Leveransfas", "Q1 – Commercial Proof of Concept",
    "Q2 – Operational Proof of Concept", "Q3 – Operational Readiness",
    "Q4 – Commercial Execution & Delivery",
}

YEAR_STOP = {"Huvudmål", "Fokus", "Resultat"} | {
    f"År {i} – {name}" for i, name in enumerate(
        ["Foundation & Proof", "Expansion", "National Scale",
         "Operational Excellence", "Category Leadership"], start=1)
}


def _quarter(doc: ms.Doc, heading: str) -> tuple[str, str, str]:
    """Fokus, prioriteringar och leverans för ett kvartal i MS-114."""
    paras = doc.paras("Verksamhetsårets Roadmap")
    start = paras.index(heading) + 1
    end = len(paras)
    for i in range(start, len(paras)):
        if paras[i].startswith("Q") and " – " in paras[i]:
            end = i
            break
    block = paras[start:end]

    def part(label: str) -> list[str]:
        if label not in block:
            return []
        first = block.index(label) + 1
        out = []
        for p in block[first:]:
            if p in Q_STOP:
                break
            out.append(p)
        return out

    focus = part("Fokus")
    delivery = part("Leverans") or part("Primär leverans")

    # Q4 har inga "Prioriteringar" — fasens arbete står i stället som egna
    # underrubriker. Då används deras etiketter.
    priorities = part("Prioriteringar")
    if not priorities:
        priorities = [p for p in block
                      if p in Q_STOP and p not in {"Fokus", "Leverans",
                                                   "Primär leverans", heading}]
        priorities = [f"{p}." for p in priorities]

    # Kvartalskortet rymmer en rad, inte ett stycke. Q4:s leverans är en lång
    # mening — då används satsen fram till första kommat, ordagrant.
    text = delivery[0] if delivery else ""
    if len(text) > 95 and "," in text:
        text = text.split(",")[0]

    return focus[0] if focus else "", " ".join(priorities), text


def _year(doc: ms.Doc, heading: str) -> tuple[str, str]:
    """Huvudmål och resultat för ett år i MS-115."""
    paras = doc.paras("Five-Year Business Roadmap")
    start = paras.index(heading) + 1
    end = len(paras)
    for i in range(start, len(paras)):
        if paras[i].startswith("År ") and " – " in paras[i]:
            end = i
            break
    block = paras[start:end]

    def part(label: str) -> list[str]:
        if label not in block:
            return []
        first = block.index(label) + 1
        out = []
        for p in block[first:]:
            if p in YEAR_STOP:
                break
            out.append(p)
        return out

    goal = part("Huvudmål")
    result = part("Resultat")
    return (goal[0] if goal else "", result[0] if result else "")


def build_d2() -> Deck:
    Y1, Y5 = DOCS["MS-114"], DOCS["MS-115"]
    n = iter(range(1, 99))
    slides: list[Slide] = []

    y1_notes = "\n".join(
        ["HUVUDBUDSKAP", *Y1.paras("Huvudbudskap"), "",
         "SPEAKER NOTES", *Y1.paras("Speaker Notes"), "",
         "PRESENTATÖRENS UPPGIFT", *Y1.paras("Presentatörens uppgift"), "",
         "Källa: MS-114 · ms-114.md"])
    y5_notes = "\n".join(
        ["HUVUDBUDSKAP", *Y5.paras("Huvudbudskap"), "",
         "SPEAKER NOTES", *Y5.paras("Speaker Notes"), "",
         "PRESENTATÖRENS UPPGIFT", *Y5.paras("Presentatörens uppgift"), "",
         "Källa: MS-115 · ms-115.md"])

    titel = Y1.paras("Titel")
    slides.append(Slide(
        number=next(n), layout="cover", kicker="MS-114 · MS-115",
        title=titel[0], subtitle=titel[1], images=["images/m2.jpg"],
        source="MS-114", notes=y1_notes,
    ))

    # Huvudbudskapet i MS-114 inleds med årets tes och avslutas med citatet.
    hb = Y1.paras("Huvudbudskap")
    slides.append(Slide(
        number=next(n), layout="hero", kicker="ÅR 1", title=hb[0],
        subtitle=hb[-1], source="MS-114", notes=y1_notes,
    ))

    # Executive North Star: tre strategiska uppdrag.
    ns = Y1.paras("Executive North Star")
    build = Y1.sub("Executive North Star", "BUILD", {"PROVE", "PREPARE TO SCALE"})
    prove = Y1.sub("Executive North Star", "PROVE", {"BUILD", "PREPARE TO SCALE"})
    prep = Y1.sub("Executive North Star", "PREPARE TO SCALE", {"BUILD", "PROVE"})
    slides.append(Slide(
        number=next(n), layout="cards", kicker="EXECUTIVE NORTH STAR",
        title=ns[0], subtitle=ns[1],
        items=[f"BUILD | {build[0]}", f"PROVE | {prove[0]}",
               f"PREPARE TO SCALE | {prep[-1]}"],
        source="MS-114", notes=y1_notes,
    ))

    # De två Proof of Concept som året vilar på.
    poc = Y1.paras("Executive North Star")
    c_start = poc.index("1. Commercial Proof of Concept") + 2
    c_end = poc.index("2. Operational Proof of Concept")
    o_start = c_end + 2
    o_end = poc.index("PREPARE TO SCALE")
    slides.append(Slide(
        number=next(n), layout="columns", kicker="PROVE",
        title=Y1.paras("Primär affärsfunktion")[0],
        subtitle=Y1.paras("Primär affärsfunktion")[-1],
        left=Column(heading="Commercial Proof of Concept",
                    items=[p.rstrip(",.") for p in poc[c_start:c_end]]),
        right=Column(heading="Operational Proof of Concept",
                     items=[p.rstrip(",.") for p in poc[o_start:o_end - 1]]),
        source="MS-114", notes=y1_notes,
    ))

    # Budgetmål och säljmål — medvetet olika. Mottot står som underrubrik,
    # eftersom det förklarar varför de skiljer sig.
    budget = Y1.paras("Business Plan")
    commercial = Y1.paras("Commercial Plan")
    motto = commercial[commercial.index("Vi arbetar efter mottot:") + 1]
    slides.append(Slide(
        number=next(n), layout="kpi", kicker="MÅLBILD",
        title="Budgetmål och säljmål", subtitle=motto,
        items=[f"{budget[budget.index('Budget') + 1]} | {budget[1]}",
               f"{commercial[commercial.index('Mål') + 1]} | {commercial[1]}"],
        source="MS-114", notes=y1_notes,
    ))

    # Verksamhetsårets fyra faser.
    quarters = ["Q1 – Commercial Proof of Concept",
                "Q2 – Operational Proof of Concept",
                "Q3 – Operational Readiness",
                "Q4 – Commercial Execution & Delivery"]
    road = Y1.paras("Verksamhetsårets Roadmap")
    slides.append(Slide(
        number=next(n), layout="quarters", kicker="VERKSAMHETSÅRETS ROADMAP",
        title="Fyra faser med eget syfte och tydlig leverans",
        subtitle=road[0],
        items=[f"{q} | {focus} | {delivery}"
               for q in quarters
               for focus, _, delivery in [_quarter(Y1, q)]],
        source="MS-114", notes=y1_notes,
    ))

    # Prioriteringar per fas, med kvartalets egna punkter.
    slides.append(Slide(
        number=next(n), layout="roles", kicker="PRIORITERINGAR",
        title="Vad vi prioriterar i varje fas",
        items=[f"{q} | {prio}" for q in quarters
               for _, prio, _ in [_quarter(Y1, q)]],
        source="MS-114", notes=y1_notes,
    ))

    # Roller och ansvar.
    roles_section = "Roller & ansvar (Operating Model)"
    role_names = ["Ledning", "Area Sales Managers", "Nätverkssäljare", "Marknad",
                  "Produkt & kvalitet", "Digital plattform",
                  "Logistik & kundservice"]
    # "Ansvarar för:" inleder varje rolls lista och ska inte avbryta den.
    intros = {"Ansvarar för:", "Ansvarar för att:"}
    role_items = []
    for name in role_names:
        duties = [p for p in Y1.sub(roles_section, name, set(role_names))
                  if p not in intros]
        # Rollernas listor avslutas med ett förklarande stycke — det hör i
        # talarmanuset, inte på kortet.
        duties = [d.rstrip(",.") for d in duties if len(d) < 60]
        role_items.append(f"{name} | {', '.join(duties)}")
    slides.append(Slide(
        number=next(n), layout="roles", kicker="OPERATING MODEL",
        title=roles_section.split(" (")[0],
        subtitle=Y1.paras(roles_section)[0],
        items=role_items, source="MS-114", notes=y1_notes,
    ))

    # Success Definition.
    succ = Y1.paras("Success Definition")
    groups = ["Kommersiellt", "Operativt", "Strategiskt", "Organisatoriskt"]
    succ_items = []
    for g in groups:
        # Sista gruppen följs av avsnittets slutsats, som inte är ett kriterium.
        block = [p for p in Y1.sub("Success Definition", g, set(groups))
                 if p != succ[-1]]
        succ_items.append(f"{g} | {' '.join(block)}")
    slides.append(Slide(
        number=next(n), layout="cards", kicker="SUCCESS DEFINITION",
        title=succ[0], subtitle=succ[1], items=succ_items,
        source="MS-114", notes=y1_notes,
    ))

    # Risker och motåtgärder, ordagrant ur tabellen.
    slides.append(Slide(
        number=next(n), layout="table", kicker="RISKS & MITIGATION",
        title="Risker och motåtgärder",
        subtitle=Y1.paras("Risks & Mitigation")[0],
        columns=["Risk", "Motåtgärd"],
        items=[f"{risk} | {fix}" for risk, fix in Y1.table("Risks & Mitigation")],
        source="MS-114", notes=y1_notes,
    ))

    # Beslut vid årets slut. Rubriken är avsnittets egen etikett ur Beslutsfas,
    # eftersom sektionens inledning är för lång för en rubrik.
    dec = Y1.paras("Executive Decisions")
    slides.append(Slide(
        number=next(n), layout="points", kicker="EXECUTIVE DECISIONS",
        title="Beslut inför skalning", subtitle=dec[0],
        items=[p.rstrip(",.") for p in dec[2:-1]],
        source="MS-114", notes=y1_notes,
    ))

    # Take-away för år 1.
    take = Y1.paras("Take-away")
    slides.append(Slide(
        number=next(n), layout="hero", kicker="TAKE-AWAY",
        title=f"{take[-2]} {take[-1]}", subtitle=take[0],
        source="MS-114", notes=y1_notes,
    ))

    # ── MS-115 ────────────────────────────────────────────────────────
    t5 = Y5.paras("Titel")
    slides.append(Slide(
        number=next(n), layout="cover", kicker="MS-115",
        title=t5[0], subtitle=t5[1], images=["images/m7.jpg"],
        source="MS-115", notes=y5_notes,
    ))

    ns5 = Y5.paras("Executive North Star")
    slides.append(Slide(
        number=next(n), layout="hero", kicker="EXECUTIVE NORTH STAR",
        title=ns5[0], subtitle=ns5[2], source="MS-115", notes=y5_notes,
    ))

    years = ["År 1 – Foundation & Proof", "År 2 – Expansion",
             "År 3 – National Scale", "År 4 – Operational Excellence",
             "År 5 – Category Leadership"]
    slides.append(Slide(
        number=next(n), layout="years", kicker="FIVE-YEAR BUSINESS ROADMAP",
        title=t5[0], subtitle=Y5.paras("Undertitel")[0],
        items=[f"{y.split(' – ')[0]} | {y.split(' – ')[1]} | {goal} | {result}"
               for y in years for goal, result in [_year(Y5, y)]],
        source="MS-115", notes=y5_notes,
    ))

    # Strategiska utvecklingsområden.
    dev = Y5.paras("Strategiska utvecklingsområden")
    areas = ["Kommersiell utveckling", "Produktutveckling", "Digital utveckling",
             "Organisationsutveckling", "Partnerutveckling"]
    slides.append(Slide(
        number=next(n), layout="cards", kicker="UTVECKLINGSOMRÅDEN",
        title="Fem områden som utvecklas parallellt", subtitle=dev[0],
        items=[f"{a} | {Y5.sub('Strategiska utvecklingsområden', a, set(areas))[0]}"
               for a in areas],
        source="MS-115", notes=y5_notes,
    ))

    # Årlig prioriteringsmodell.
    prio = Y5.paras("Årlig prioriteringsmodell")
    slides.append(Slide(
        number=next(n), layout="table", kicker="PRIORITERINGSMODELL",
        title="Ett dominerande tema per år", subtitle=prio[0],
        columns=["År", "Primärt fokus"],
        items=[f"{a} | {b}" for a, b in Y5.table("Årlig prioriteringsmodell")],
        source="MS-115", notes=y5_notes,
    ))

    # Strategiska principer.
    princ = Y5.paras("Strategiska principer")
    slides.append(Slide(
        number=next(n), layout="points", kicker="STRATEGISKA PRINCIPER",
        title=princ[0].rstrip(":"), subtitle=princ[-1],
        items=princ[1:-1], source="MS-115", notes=y5_notes,
    ))

    take5 = Y5.paras("Take-away")
    slides.append(Slide(
        number=next(n), layout="close", kicker="TAKE-AWAY",
        title=take5[0], items=[p.rstrip(",.") for p in take5[2:7]],
        source="MS-115", notes=y5_notes,
    ))

    return Deck(title="Roadmap år 1–5", slides=slides)


# ══════════════════════ D4 · År 1 i detalj ══════════════════════════════
# Rollerna delas på två slides. I D2 ryms alla sju på ett uppslag bara genom
# att de långa ansvarsraderna kortas; här får varje roll sin fulla lista.
ROLES_COMMERCIAL = ["Ledning", "Area Sales Managers", "Nätverkssäljare",
                    "Marknad"]
ROLES_OPERATIONAL = ["Produkt & kvalitet", "Digital plattform",
                     "Logistik & kundservice"]
ROLE_INTROS = {"Ansvarar för:", "Ansvarar för att:"}


def _duties(doc: ms.Doc, name: str) -> str:
    """En rolls ansvarslista, utan inledningen och utan slutkommentaren."""
    section = "Roller & ansvar (Operating Model)"
    stop = set(ROLES_COMMERCIAL) | set(ROLES_OPERATIONAL)
    paras = [p for p in doc.sub(section, name, stop) if p not in ROLE_INTROS]
    # Flera roller avslutas med ett förklarande stycke om rollens uppdrag.
    # Det hör i talarmanuset — kortet ska bära själva listan.
    return ", ".join(p.rstrip(",.") for p in paras if len(p) < 60)


def _labelled(paras: list[str], start: int) -> list[str]:
    """Etikett/beskrivning-par från och med index start, som "namn | text"."""
    out = []
    for i in range(start, len(paras) - 1, 2):
        label = paras[i].split(". ", 1)[-1]
        out.append(f"{label} | {paras[i + 1]}")
    return out


def build_d4() -> Deck:
    Y1 = DOCS["MS-114"]
    n = iter(range(1, 99))
    slides: list[Slide] = []

    notes = "\n".join(
        ["HUVUDBUDSKAP", *Y1.paras("Huvudbudskap"), "",
         "SPEAKER NOTES", *Y1.paras("Speaker Notes"), "",
         "PRESENTATÖRENS UPPGIFT", *Y1.paras("Presentatörens uppgift"), "",
         "EDITORIAL & VERIFIERING", *Y1.paras("Editorial & verifiering"), "",
         "Källa: MS-114 · ms-114.md"])

    def add(layout: str, kicker: str, **kw) -> None:
        slides.append(Slide(number=next(n), layout=layout, kicker=kicker,
                            source="MS-114", notes=notes, **kw))

    titel = Y1.paras("Titel")
    under = Y1.paras("Undertitel")
    hb = Y1.paras("Huvudbudskap")

    add("cover", "ÅR 1 · EXECUTION ROADMAP", title=titel[0], subtitle=titel[1],
        images=["images/m2.jpg"])

    add("hero", "HUVUDBUDSKAP", title=hb[0], subtitle=under[1])

    # De tre uppdragen, med källans egna förklaringar av vart och ett.
    add("cards", "BUILD · PROVE · PREPARE TO SCALE",
        title=titel[1], subtitle=titel[2],
        items=[f"{t.split(' – ')[0]} | {t.split(' – ')[1].rstrip(',.')}"
               for t in titel[3:6]])

    # Vad roadmapen ska svara på.
    fraga = Y1.paras("Frågan sliden besvarar")
    add("points", "FRÅGAN VI BESVARAR", title=fraga[0], subtitle=fraga[1],
        items=[p.rstrip(",.") for p in fraga[2:7]])

    # Vad var och en ska bära med sig ur kick-offen.
    intent = Y1.paras("Executive Intent")
    add("points", "EFTER KICK-OFFEN", title=intent[8].rstrip(":"),
        items=[p.rstrip(",.") for p in intent[9:14]],
        images=["images/m4.jpg"])

    # Värdepelarna — fem principer som inte får plats i D2.
    varde = Y1.paras("Värdepelare")
    add("cards", "VÄRDEPELARE", title=varde[0],
        subtitle=Y1.paras("Syfte")[-1], items=_labelled(varde, 1))

    # Vilka beslut roadmapen stödjer under året. Sektionens egen inledning
    # namnger dokumentet ("MS-114 används…") och hör därför inte på duken.
    beslut = Y1.paras("Beslutsfas")
    roll = Y1.paras("Primär beslutsroll")
    add("cards", "BESLUTSFAS", title=roll[0], subtitle=roll[-1],
        items=_labelled(beslut, 1))

    # ── De tre uppdragen, ett i taget ─────────────────────────────────
    ns = Y1.paras("Executive North Star")
    add("points", "BUILD", title=ns[3], subtitle=ns[4],
        items=[p.rstrip(",.") for p in ns[5:11]])

    add("columns", "PROVE", title=ns[12], subtitle=ns[13],
        left=Column(heading=ns[14].split(". ", 1)[1],
                    items=[p.rstrip(",.") for p in ns[16:21]]),
        right=Column(heading=ns[21].split(". ", 1)[1],
                     items=[p.rstrip(",.") for p in ns[23:30]]))

    # Fyra korta punkter fyller inte en hel duk — bilden gör pausen medveten.
    add("points", "PREPARE TO SCALE", title=ns[37], subtitle=ns[32],
        items=[p.rstrip(",.") for p in ns[33:37]], images=["images/m7.jpg"])

    # ── Målbilden ─────────────────────────────────────────────────────
    budget = Y1.paras("Business Plan")
    commercial = Y1.paras("Commercial Plan")
    motto = commercial[commercial.index("Vi arbetar efter mottot:") + 1]
    # Källans egna informationsfält under roadmapen: de två målen och årets
    # avgränsning. Avgränsningen hör ihop med målen och läggs därför här.
    layout_notes = Y1.paras("Layout & Design Notes")
    add("kpi", "MÅLBILD", title="Budgetmål och säljmål", subtitle=motto,
        items=[f"{budget[budget.index('Budget') + 1]} | {budget[0]}",
               f"{commercial[commercial.index('Mål') + 1]} | {commercial[0]}"],
        caption=layout_notes[23])

    add("points", "BUSINESS PLAN", title=budget[1], subtitle=budget[4],
        items=[p.rstrip(",.") for p in budget[5:11]], caption=budget[14])

    add("points", "COMMERCIAL PLAN", title=commercial[1],
        subtitle=commercial[4],
        items=[p.rstrip(",.") for p in commercial[5:12]],
        caption=commercial[15])

    # ── Verksamhetsåret ───────────────────────────────────────────────
    quarters = ["Q1 – Commercial Proof of Concept",
                "Q2 – Operational Proof of Concept",
                "Q3 – Operational Readiness",
                "Q4 – Commercial Execution & Delivery"]
    road = Y1.paras("Verksamhetsårets Roadmap")
    add("quarters", "VERKSAMHETSÅRETS ROADMAP",
        title="Fyra faser med eget syfte och tydlig leverans",
        subtitle=road[0],
        items=[f"{q} | {focus} | {delivery}" for q in quarters
               for focus, _, delivery in [_quarter(Y1, q)]])

    # Ett eget uppslag per kvartal, med kvartalets hela prioriteringslista.
    q_stop = Q_STOP | {"Fokus", "Prioriteringar", "Leverans"}
    for q in quarters[:3]:
        block = Y1.sub("Verksamhetsårets Roadmap", q, set(quarters))
        focus = block[block.index("Fokus") + 1]
        prio_start = block.index("Prioriteringar") + 1
        prio_end = block.index("Leverans")
        add("points", q.replace(" – ", " · ").upper(),
            title=focus, subtitle=block[0],
            items=[p.rstrip(".") for p in block[prio_start:prio_end]],
            caption=block[prio_end + 1])

    # Q4 är årets kvitto och beskrivs i tre steg i källan.
    q4 = Y1.sub("Verksamhetsårets Roadmap", quarters[3], set(quarters))
    q4_kicker = quarters[3].replace(" – ", " · ").upper()
    i_saljperiod = q4.index("Föreningarnas försäljningsperioder")
    i_underlag = q4.index("Order- och leveransunderlag")
    i_leverans = q4.index("Leveransfas")
    i_primar = q4.index("Primär leverans")

    add("points", q4_kicker, title=q4[i_saljperiod],
        subtitle=q4[q4.index("Fokus") + 1],
        items=q4[i_saljperiod + 1:i_underlag])

    add("points", q4_kicker, title=q4[i_underlag],
        subtitle=q4[i_underlag + 1],
        items=[p.rstrip(",.") for p in q4[i_underlag + 2:i_leverans - 1]],
        caption=q4[i_leverans - 1])

    add("columns", q4_kicker, title=q4[i_leverans],
        subtitle=q4[i_leverans + 1],
        left=Column(heading=q4[i_leverans],
                    items=[p.rstrip(",.") for p in
                           q4[i_leverans + 2:i_primar]]),
        right=Column(heading=q4[i_primar], items=[q4[i_primar + 1]]))

    # ── Organisationen ────────────────────────────────────────────────
    roles_section = "Roller & ansvar (Operating Model)"
    add("roles", "OPERATING MODEL · KOMMERSIELLT",
        title=roles_section.split(" (")[0],
        subtitle=Y1.paras(roles_section)[0],
        items=[f"{r} | {_duties(Y1, r)}" for r in ROLES_COMMERCIAL])

    add("roles", "OPERATING MODEL · OPERATIVT",
        title=roles_section.split(" (")[0],
        subtitle=Y1.paras("Primär affärsfunktion")[-1],
        items=[f"{r} | {_duties(Y1, r)}" for r in ROLES_OPERATIONAL])

    # ── Uppföljning och beslut ────────────────────────────────────────
    succ = Y1.paras("Success Definition")
    groups = ["Kommersiellt", "Operativt", "Strategiskt", "Organisatoriskt"]
    add("cards", "SUCCESS DEFINITION", title=succ[0], subtitle=succ[1],
        items=[f"{g} | " + " ".join(
            p for p in Y1.sub("Success Definition", g, set(groups))
            if p != succ[-1]) for g in groups],
        caption=succ[-1])

    add("table", "RISKS & MITIGATION", title="Risker och motåtgärder",
        subtitle=Y1.paras("Risks & Mitigation")[0],
        columns=["Risk", "Motåtgärd"],
        items=[f"{risk} | {fix}" for risk, fix in Y1.table("Risks & Mitigation")],
        caption=Y1.paras("Risks & Mitigation")[-1])

    dec = Y1.paras("Executive Decisions")
    add("points", "EXECUTIVE DECISIONS", title="Beslut inför skalning",
        subtitle=dec[0], items=[p.rstrip(",.") for p in dec[2:-1]],
        caption=dec[-1])

    take = Y1.paras("Take-away")
    add("close", "TAKE-AWAY", title=f"{take[-2]} {take[-1]}",
        items=[p.rstrip(",.") for p in take[2:7]])

    return Deck(title="År 1 – Execution Roadmap", slides=slides)


# ══════════════════════ D3 · Övergripande ═══════════════════════════════
def build_d3() -> Deck:
    S = SPECS
    Y5 = DOCS["MS-115"]
    n = iter(range(1, 99))
    slides: list[Slide] = []

    slides.append(Slide(
        number=next(n), layout="cover", kicker="ÖVERGRIPANDE PRESENTATION",
        title=S["MS-001"].text("Titel"), subtitle=S["MS-001"].text("Undertitel"),
        images=["images/h1desktop.jpg"], source="MS-001",
        notes=notes_for("MS-001"),
    ))

    slides.append(_slide(
        next(n), "cards", "MS-001",
        items=_cells(S["MS-001"].pairs("Slide-innehåll", "Tre bärande delar")),
        caption=S["MS-001"].under("Slide-innehåll", "Nederst")[0],
    ))

    slides.append(_slide(
        next(n), "cards", "MS-005",
        items=_cells(S["MS-005"].pairs("Slide-innehåll", "Fyra värdepelare")),
        caption=S["MS-005"].under("Slide-innehåll", "Nederst")[0],
    ))

    slides.append(_slide(
        next(n), "flywheel", "MS-006",
        items=S["MS-006"].bullets("Slide-innehåll"), columns=["ROOTS", ""],
        caption=S["MS-006"].under("Slide-innehåll", "Nederst")[0],
    ))

    products = S["MS-008"].lines("Slide-innehåll")[1:4]
    benefits = S["MS-008"].bullets("Stödjande budskap")
    slides.append(_slide(
        next(n), "products", "MS-008",
        items=[f"{name} | {benefits[i] if i < len(benefits) else ''}"
               for i, name in enumerate(products)],
        images=["images/schampoo.jpg", "images/conditioner.jpg",
                "images/body-wash.jpg"],
        caption=S["MS-008"].under("Slide-innehåll", "Nederst")[0],
    ))

    flow = S["MS-007"].flow("Slide-innehåll")
    slides.append(_slide(
        next(n), "flywheel", "MS-007", items=flow[:6], columns=["ROOTS", ""],
        caption=S["MS-007"].under("Slide-innehåll", "Nederst")[0],
    ))

    slides.append(_slide(
        next(n), "words", "MS-011", items=S["MS-011"].bullets("Slide-innehåll"),
    ))

    slides.append(_slide(
        next(n), "timeline", "MS-013", items=S["MS-013"].lines("Stödjande budskap"),
    ))

    slides.append(_slide(
        next(n), "flywheel", "MS-014", items=S["MS-014"].bullets("Slide-innehåll"),
        columns=["Support", "Center"],
    ))

    # Så här arbetar vi — Commercial Playbook, MS-017–020.
    steps = [s.split(". ", 1)[1] for s in S["MS-017"].lines("Slide-innehåll")[1:]]
    aims = S["MS-017"].lines("Stödjande budskap")
    slides.append(_slide(
        next(n), "timeline", "MS-017",
        items=[f"{step} | {aims[i] if i < len(aims) else ''}"
               for i, step in enumerate(steps)],
    ))

    slides.append(_slide(
        next(n), "cards", "MS-018",
        items=[f"{r.split(' – ')[0]} | {r.split(' – ')[1]}"
               for r in S["MS-018"].lines("Stödjande budskap")],
    ))

    slides.append(_slide(
        next(n), "timeline", "MS-019",
        items=S["MS-019"].flow("Slide-innehåll")[:5],
    ))

    slides.append(_slide(
        next(n), "flywheel", "MS-020",
        items=S["MS-020"].flow("Slide-innehåll"),
        columns=["Commercial", "Playbook"],
    ))

    # Riktningen framåt, ur femårsplanen.
    prio = Y5.paras("Årlig prioriteringsmodell")
    slides.append(Slide(
        number=next(n), layout="table", kicker="RIKTNING",
        title=Y5.paras("Titel")[0], subtitle=prio[0],
        columns=["År", "Primärt fokus"],
        items=[f"{a} | {b}" for a, b in Y5.table("Årlig prioriteringsmodell")],
        source="MS-115",
        notes="\n".join(["HUVUDBUDSKAP", *Y5.paras("Huvudbudskap"), "",
                         "Källa: MS-115 · ms-115.md"]),
    ))

    slides.append(Slide(
        number=next(n), layout="close", kicker="TAKE-AWAY",
        title=S["MS-005"].text("Take-away"),
        items=S["MS-005"].bullets("Stödjande budskap"),
        source="MS-005", notes=notes_for("MS-005"),
    ))

    return Deck(title="Övergripande presentation", slides=slides)


DECKS = {
    "Roots_Saljpresentation.pptx": build_d1,
    "Roots_Roadmap_Ar_1-5.pptx": build_d2,
    "Roots_Oversiktspresentation.pptx": build_d3,
    "Roots_Ar_1_Execution_Roadmap.pptx": build_d4,
}


if __name__ == "__main__":
    for filename, build in DECKS.items():
        deck = build()
        print(f"\n{deck.title}  ({len(deck.slides)} slides)  → {filename}")
        for s in deck.slides:
            print(f"  {s.number:02d} {s.layout:11} {s.source:7} {s.title[:58]}")
