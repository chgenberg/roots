#!/usr/bin/env python3
"""Personligt mejl (första utskicket) för godkännande: mall, två ifyllda exempel och plan för vecka 1.

Läser de gröna raderna (Segment = Personligt mejl) i flikarna "Kent – utskick" och "Niclas – utskick".

Usage: python3 docs/leads/build_personligt_utkast_docx.py LEADSLISTA.xlsx [OUT.docx]
"""
import os
import sys

import openpyxl
from docx.enum.text import WD_BREAK
from docx.shared import Cm, Inches, Pt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "meetings"))
from build_folkspel_notes import (  # noqa: E402
    FOREST, LOGO, SAND_DARK, H1, body, border, bullet, callout, doc_background, kicker, set_font, space_after,
)
from build_mejlutkast_docx import write_mail  # noqa: E402
from docx import Document  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Downloads/Roots leadslista.xlsx")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser("~/Desktop/Roots_personligt_mejl_godkannande.docx")

PACKAGES, PRICE, SHARE = 6, 399, 0.35
PER_DAY = 5
WEEK1 = ["tis 3/11", "ons 4/11", "tor 5/11", "fre 6/11"]

SUBJECT = "Ett förslag till [Föreningsnamn] från Roots"
SUPPORT = {
    "Niclas": "Personligt stöd hela vägen. Jag hjälper er att planera och komma igång, och finns med under "
              "försäljningen.",
    "Kent": "Personligt stöd hela vägen. Jag finns här i Norrland, hjälper er att planera och komma igång, och "
            "finns med under försäljningen.",
}


def mail(seller: str) -> list:
    return [
        "Hej!",
        "[Avsändare] här. Jag har tidigare haft kontakt med [Föreningsnamn] genom mitt arbete på Folkspel. Nu "
        "jobbar jag på Roots, och jag vill gärna berätta om en ny möjlighet för er att stärka föreningskassan.",
        "Roots erbjuder premiumprodukter inom hår- och kroppsvård, med schampo, balsam och body wash som människor "
        "använder i vardagen. Vi kallar det Premium för föreningslivet.",
        "Bakom Roots finns människor med lång erfarenhet av föreningsförsäljning och gedigen kunskap inom hår- och "
        "hudvård. Vi vet hur mycket ideellt arbete som ligger bakom en fungerande förening. Därför är enkelhet vår "
        "utgångspunkt – Roots ska vara den hjälpande handen.",
        ("heading", "Vad innebär det för er?"),
        ("points", [
            "35 % till föreningen vid er försäljningsaktivitet. En tydlig förtjänst som gör skillnad för "
            "föreningen, lagen och verksamheten.",
            "Produkter som tar slut – och köps igen. När kunderna återkommer och handlar får föreningen fortsatt "
            "ersättning.",
            "Premiumprodukter för hela familjen. Användbara vardagsprodukter, utvecklade med kunskap och omsorg.",
            "En egen digital säljsida. Medlemmarna delar sina personliga säljlänkar och kunderna beställer och "
            "betalar digitalt.",
            "Samlad leverans till föreningen och/eller hemleverans till kunden.",
            SUPPORT[seller],
        ]),
        ("heading", "Vad skulle [Föreningsnamn] kunna tjäna?"),
        "För att göra det konkret har vi räknat på ett exempel för just er:",
        "[Antal deltagare] medlemmar × [Försäljning per medlem] kr = [Total försäljning] kr i försäljning",
        "Med 35 % till föreningen innebär det [Behållning] kr till [Föreningsnamn] under en försäljningsperiod.",
        "Det är ett räkneexempel utifrån att varje medlem säljer 6 paket à 399 kr. Intäkter från framtida "
        "återköp kan tillkomma.",
        ("heading", "Så här skulle er egen säljsida kunna se ut"),
        "Vi har också tagit fram ett förslag med ert föreningsnamn och er logotyp, så att ni kan få en känsla för "
        "upplägget:",
        "👉 Se förslaget för [Föreningsnamn]",
        "Jag tar gärna ett kort möte och visar hur det fungerar och hur vi skulle kunna lägga upp en försäljning "
        "som passar er.",
        "Har du 30 minuter nästa vecka? Jag kommer gärna förbi eller tar ett digitalt möte – det som passar er bäst.",
        ("lines", ["Vänliga hälsningar,", "[Avsändare]", "[Titel] | Roots", "[Telefonnummer]", "[E-postadress]",
                   "https://roots.nu"]),
        ("lines", ["—", "Vill du inte få fler mejl från mig? Svara bara ”nej tack” så hör jag inte av mig igen. "
                        "Så hanterar Roots personuppgifter: roots.nu/integritet"]),
    ]


def kr(n: float) -> str:
    return f"{round(n):,}".replace(",", " ")


def fill(parts, values: dict):
    def f(s: str) -> str:
        for k, v in values.items():
            s = s.replace(k, v)
        return s
    out = []
    for p in parts:
        if isinstance(p, str):
            out.append(f(p))
        else:
            kind, v = p
            out.append((kind, [f(x) for x in v] if isinstance(v, list) else f(v)))
    return out


def load():
    wb = openpyxl.load_workbook(SRC)
    lists = {}
    for seller, sheet in [("Kent", "Kent – utskick"), ("Niclas", "Niclas – utskick")]:
        ws = wb[sheet]
        head = [c.value for c in ws[1]]
        ix = {k: i for i, k in enumerate(head)}
        rows = []
        for n, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if r[ix["Segment"]] != "Personligt mejl" or not r[ix["E-post"]] or not r[ix["Antal deltagare"]]:
                continue
            if r[ix["Kontrollera"]] or (r[ix["Skickat"]] not in (None, "")):
                continue
            rows.append({
                "order": r[ix["Ordning"]] or 9, "row": n,
                "name": (r[ix["Korrigerat namn"]] or r[ix["Förening"]]).strip(),
                "email": r[ix["E-post"]].strip(), "members": int(r[ix["Antal deltagare"]]),
                "kommun": r[ix["Kommun"]] or "", "sport": r[ix["Idrott"]] or "",
            })
        rows.sort(key=lambda x: (x["order"], x["row"]))
        lists[seller] = rows
    return lists


def example(seller: str, lead: dict) -> list:
    per = PACKAGES * PRICE
    total = lead["members"] * per
    return fill(mail(seller), {
        "[Föreningsnamn]": lead["name"], "[Avsändare]": seller,
        "[Antal deltagare]": kr(lead["members"]), "[Försäljning per medlem]": kr(per),
        "[Total försäljning]": kr(total), "[Behållning]": kr(total * SHARE),
    })


def plan_table(doc, seller: str, rows: list):
    days = [WEEK1[i // PER_DAY] if i // PER_DAY < len(WEEK1) else None for i in range(len(rows))]
    picked = [(d, r) for d, r in zip(days, rows) if d]
    t = doc.add_table(rows=1, cols=5)
    t.style = "Table Grid"
    for cell, text in zip(t.rows[0].cells, ["Dag", "Förening", "E-post", "Deltagare", "Till föreningen"]):
        cell.text = ""
        set_font(cell.paragraphs[0].add_run(text), size=8.5, color=SAND_DARK, bold=True)
    for day, r in picked:
        cells = t.add_row().cells
        vals = [day, r["name"], r["email"], kr(r["members"]), f"{kr(r['members'] * PACKAGES * PRICE * SHARE)} kr"]
        for cell, v in zip(cells, vals):
            cell.text = ""
            set_font(cell.paragraphs[0].add_run(v), size=8.5)
    t.autofit = False
    widths = [Cm(1.9), Cm(4.4), Cm(5.6), Cm(1.8), Cm(2.4)]
    for col, w in zip(t.columns, widths):
        col.width = w
    for row in t.rows:
        for w, cell in zip(widths, row.cells):
            cell.width = w
    p = doc.add_paragraph()
    space_after(p, 10)


def build():
    lists = load()
    doc = Document()
    doc.styles["Normal"].font.size = Pt(11)
    for sec in doc.sections:
        sec.top_margin, sec.bottom_margin = Inches(0.95), Inches(0.8)
        sec.left_margin = sec.right_margin = Inches(1.0)
        sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
        set_font(sec.header.paragraphs[0].add_run("Roots  ·  Mejlutkast för godkännande  ·  Internt"),
                 size=8, color=SAND_DARK)
        set_font(sec.footer.paragraphs[0].add_run("Utkast 2 november 2026  ·  Ourroots AB"), size=8, color=SAND_DARK)
    doc_background(doc, "FAF6EF")

    if os.path.exists(LOGO):
        p = doc.add_paragraph()
        p.add_run().add_picture(LOGO, width=Inches(1.6))
        space_after(p, 16)
    p = doc.add_paragraph()
    space_after(p, 4)
    set_font(p.add_run("MEJLUTKAST  ·  FÖR GODKÄNNANDE"), size=10, color=FOREST, bold=True)
    p = doc.add_paragraph()
    space_after(p, 6)
    set_font(p.add_run("Personligt mejl till de gröna\nföreningarna, från Kent och Niclas"), "Alan Sans", 24,
             bold=True)
    p = doc.add_paragraph()
    border(p, "6B794F", 12, "bottom", 1)
    space_after(p, 10)
    nk, nn = len(lists["Kent"]), len(lists["Niclas"])
    body(doc, "Till Kent och Niclas  ·  2 november 2026", 10, SAND_DARK, after=12)

    callout(doc, "Upplägget",
            f"Vi börjar med föreningarna som är markerade ”Personligt mejl” (gröna): {nk} hos Kent och {nn} hos "
            f"Niclas. Vi värmer upp mejlservern med {PER_DAY} mejl per säljare och dag, bara måndag till fredag. "
            "Mejlet går från er egen adress, och svar kommer direkt till er.")

    kicker(doc, "Att godkänna")
    H1(doc, "Det här behöver ett ja eller en ändring")
    bullet(doc, "Texten i mejlet (exemplen nedan). Det är samma mejl från er båda; bara stödraden skiljer sig.")
    bullet(doc, "Inga namn: mejlet börjar med ”Hej!”, eftersom ansvarig kan ha bytts sedan sist. Folkspel-raden "
                "nämner därför föreningen, inte personen.")
    bullet(doc, "Räkneexemplet räknas fram per förening: antal deltagare × 6 paket à 399 kr, 35 % till föreningen.")
    bullet(doc, "Länken ”Se förslaget för …” öppnar föreningens egen shopförslag med namn och logga.")
    bullet(doc, f"Ordningen för första veckan (sista sidan). Kents {nk} är klara efter två dagar; därefter bara Niclas.")
    bullet(doc, "Er titel, telefon och e-post i signaturen hämtas från er profil i portalen. Stämmer de?")

    kicker(doc, "Att titta lite extra på")
    H1(doc, "Två mottagare som inte är idrottsföreningar")
    body(doc, "Hjärtebarnsfonden – Norr (Kent) och PRO Håbo (Niclas) står som personligt mejl. Mejlet fungerar för "
              "dem också, men säg till om de ska vänta eller få en egen text.", 10.5)

    for seller in ("Niclas", "Kent"):
        doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        kicker(doc, f"Exempel  ·  Från {seller}")
        lead = lists[seller][0]
        H1(doc, f"Till {lead['name']}")
        body(doc, f"Så här ser mejlet ut ifyllt. Ämne: ”{SUBJECT.replace('[Föreningsnamn]', lead['name'])}”", 10,
             SAND_DARK, after=12)
        write_mail(doc, SUBJECT.replace("[Föreningsnamn]", lead["name"]), example(seller, lead))

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    kicker(doc, "Vecka 1")
    H1(doc, f"{PER_DAY} per säljare och dag, i listans ordning")
    body(doc, "Prioritet 1 först, sedan i den ordning raderna står i fliken. Går vecka 1 bra (få studsar, inga "
              "skräppostklagomål) ökar vi takten veckan efter.", 10.5, after=10)
    for seller in ("Kent", "Niclas"):
        kicker(doc, seller)
        plan_table(doc, seller, lists[seller])

    doc.save(OUT)
    print("Saved", OUT, {k: len(v) for k, v in lists.items()})


if __name__ == "__main__":
    build()
