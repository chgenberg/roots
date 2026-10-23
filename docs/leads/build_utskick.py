"""Bygger utskicksfilen för lead-mejl sats 2 (Kent och Niclas).

Läser Leadslista_kompletterad.xlsx, behåller flikarna Leadsbas och Kontroll
orörda och lägger till: Läs mig, en utskicksflik per säljare, Uppvärmning
och Antaganden. Utskicksflikarna har rubriken på rad 1 så att de går att
importera direkt i /portal/lead-mejl.

    python3 docs/leads/build_utskick.py IN.xlsx UT.xlsx
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from openpyxl import load_workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

SELLERS = ("Kent", "Niclas")
PACKS, PACK_PRICE, CLUB_SHARE = 6, 399, 0.35
BIG_CLUB = 1000

# Leadsbas, kolumnindex (0-baserat). Rubrikerna är dubblerade, därför index.
C_NAME, C_LAN, C_KOMMUN, C_ORG, C_SPORT, C_SELLER = 0, 1, 2, 3, 4, 5
C_SURPLUS, C_KUVERT, C_ORGNR, C_EMAIL, C_PHONE, C_CONTACT, C_SKIP, C_ROLE = 6, 7, 8, 9, 10, 11, 12, 13
C_ORGNR2, C_SITE, C_MEMBERS, C_YEAR, C_EMAIL2 = 15, 16, 17, 18, 19
C_EMAIL_EXTRA = (20, 21, 22, 23)
C_PHONE2 = 24

EMAIL_RE = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[a-z]{2,}$", re.I)

BROWN = "5B3A29"
INK = "2B2118"
SAND = "F4EEE6"
FILL_ME = "FFF2C2"
TRACK = "E6EEE8"
READY = "DDEFD9"

STATUSES = [
    "Ej skickad", "Skickad", "Öppnad", "Öppnat förslaget", "Vill veta mer",
    "Svarat", "Möte bokat", "Inte intresserad", "Studsade", "Avregistrerad",
]


def text(v) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s in ("0", "None") else s


def emails_of(row) -> list[str]:
    out: list[str] = []
    for i in (C_EMAIL2, C_EMAIL, *C_EMAIL_EXTRA):
        for part in re.split(r"[;,\s/]+", text(row[i])):
            p = part.lower().removeprefix("mailto:")
            if EMAIL_RE.match(p) and p not in out:
                out.append(p)
    return out


def site_of(row) -> str:
    s = text(row[C_SITE])
    return s if re.match(r"^(https?://|www\.)", s, re.I) else ""


def members_of(row) -> int | None:
    v = row[C_MEMBERS]
    return v if isinstance(v, int) and v > 0 else None


def number(v) -> float:
    return float(v) if isinstance(v, (int, float)) else 0.0


def collect(ws):
    leads = {s: [] for s in SELLERS}
    skipped = []
    for rownum, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        seller = text(row[C_SELLER])
        if seller not in leads:
            continue
        if text(row[C_SKIP]):
            skipped.append((seller, text(row[C_NAME]), rownum))
            continue
        mails = emails_of(row)
        members = members_of(row)
        leads[seller].append({
            "row": rownum,
            "name": text(row[C_NAME]),
            "contact": text(row[C_CONTACT]),
            "email": mails[0] if mails else "",
            "more": ", ".join(mails[1:]),
            "site": site_of(row),
            "phone": text(row[C_PHONE2]) or text(row[C_PHONE]),
            "kommun": text(row[C_KOMMUN]),
            "lan": text(row[C_LAN]).title() if text(row[C_LAN]) != "Tillagd" else "Tillagd",
            "sport": text(row[C_SPORT]),
            "orgnr": text(row[C_ORGNR2]) or text(row[C_ORGNR]),
            "members": members,
            "year": row[C_YEAR] if isinstance(row[C_YEAR], int) and row[C_YEAR] > 0 else None,
            "surplus": number(row[C_SURPLUS]),
            "kuvert": number(row[C_KUVERT]),
            "check": "",
        })
    return leads, skipped


def mark_shared(leads) -> int:
    """Samma adress för flera föreningar: behåll den på en rad, spärra resten."""
    by_mail = defaultdict(list)
    for seller in SELLERS:
        for lead in leads[seller]:
            if lead["email"]:
                by_mail[lead["email"]].append(lead)
    shared = 0
    for mail, group in by_mail.items():
        if len(group) < 2:
            continue
        shared += 1
        group.sort(key=lambda l: (l["members"] is None, -l["surplus"]))
        keeper = group[0]
        for other in group[1:]:
            other["check"] = (
                f"Samma adress ({mail}) som {keeper['name']}, rad {keeper['row']} i Leadsbas. "
                "Hitta egen adress eller töm rutan om ett gemensamt mejl räcker."
            )
            other["email"] = ""
            other["more"] = ", ".join(x for x in [mail, other["more"]] if x)
    return shared


def mark_big(leads) -> None:
    for seller in SELLERS:
        for lead in leads[seller]:
            m = lead["members"]
            if m is not None and m > BIG_CLUB and not lead["check"]:
                lead["check"] = (
                    f"Stor förening ({m:,} medlemmar). Bedöm antal deltagare "
                    "och töm sedan den här rutan.".replace(",", " ")
                )


def has_mx(domain: str) -> bool:
    out = subprocess.run(
        ["dig", "+short", "+time=3", "+tries=2", "MX", domain],
        capture_output=True, text=True, check=False,
    ).stdout.strip()
    return bool(out)


def mark_dead_domains(leads) -> int:
    domains = {l["email"].split("@")[1] for s in SELLERS for l in leads[s] if l["email"]}
    with ThreadPoolExecutor(max_workers=32) as pool:
        dead = {d for d, ok in zip(domains, pool.map(has_mx, domains)) if not ok}
    n = 0
    for seller in SELLERS:
        for lead in leads[seller]:
            if lead["email"] and lead["email"].split("@")[1] in dead and not lead["check"]:
                lead["check"] = (
                    f"Domänen {lead['email'].split('@')[1]} tar inte emot mejl. "
                    "Hitta en ny adress och töm sedan den här rutan."
                )
                n += 1
    return n


def priority(lead) -> int:
    ready = bool(lead["email"]) and lead["members"] is not None and not lead["check"]
    if ready and lead["surplus"] > 0:
        return 1
    if ready:
        return 2
    return 3


HEADERS = [
    # (rubrik, bredd, grupp) grupp: base | fill | calc | track
    ("Förening", 34, "base"),
    ("Kontaktperson", 20, "fill"),
    ("E-post", 32, "fill"),
    ("Fler e-postadresser", 28, "base"),
    ("Webbplats", 30, "fill"),
    ("Antal deltagare", 11, "fill"),
    ("Medlemmar enligt källa", 11, "base"),
    ("Medlemsår", 9, "base"),
    ("Belopp per deltagare", 11, "calc"),
    ("Total försäljning", 13, "calc"),
    ("Behållning 35 %", 13, "calc"),
    ("Klar att skicka", 22, "calc"),
    ("Att göra", 34, "calc"),
    ("Kontrollera", 40, "fill"),
    ("Prioritet", 8, "base"),
    ("Telefon", 15, "base"),
    ("Kommun", 15, "base"),
    ("Län", 14, "base"),
    ("Idrott", 16, "base"),
    ("Organisationsnummer", 14, "base"),
    ("Överskott H20–V21", 12, "base"),
    ("Kuvert H2025", 9, "base"),
    ("Rad i Leadsbas", 9, "base"),
    ("Skickat", 11, "track"),
    ("Öppnat mejlet", 11, "track"),
    ("Öppnat förslaget", 11, "track"),
    ("Vill veta mer", 11, "track"),
    ("Svarat", 11, "track"),
    ("Status", 16, "track"),
    ("Nästa steg", 26, "track"),
    ("Följ upp senast", 12, "track"),
    ("Anteckning", 36, "track"),
]
COL = {h: get_column_letter(i + 1) for i, (h, _, _) in enumerate(HEADERS)}

HEAD_FILL = {
    "base": PatternFill("solid", fgColor=BROWN),
    "fill": PatternFill("solid", fgColor="E8B93A"),
    "calc": PatternFill("solid", fgColor="8A6A55"),
    "track": PatternFill("solid", fgColor="4F6B5A"),
}
HEAD_FONT = {
    "base": Font(bold=True, color="FFFFFF"),
    "fill": Font(bold=True, color=INK),
    "calc": Font(bold=True, color="FFFFFF"),
    "track": Font(bold=True, color="FFFFFF"),
}
THIN = Side(style="thin", color="E2D8CC")


def write_seller_sheet(wb, title: str, leads: list[dict]):
    ws = wb.create_sheet(title)
    for i, (h, width, group) in enumerate(HEADERS, start=1):
        c = ws.cell(1, i, h)
        c.fill, c.font = HEAD_FILL[group], HEAD_FONT[group]
        c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[1].height = 34

    leads = sorted(leads, key=lambda l: (priority(l), -l["surplus"], l["name"].lower()))
    fill_me = PatternFill("solid", fgColor=FILL_ME)
    for r, lead in enumerate(leads, start=2):
        e, n, b, t, k, chk = (COL[h] for h in (
            "E-post", "Antal deltagare", "Belopp per deltagare",
            "Total försäljning", "Kontrollera", "Kontaktperson"))
        values = {
            "Förening": lead["name"],
            "Kontaktperson": lead["contact"] or None,
            "E-post": lead["email"] or None,
            "Fler e-postadresser": lead["more"] or None,
            "Webbplats": lead["site"] or None,
            "Antal deltagare": lead["members"],
            "Medlemmar enligt källa": lead["members"],
            "Medlemsår": lead["year"],
            "Belopp per deltagare": "=Antaganden!$B$4",
            "Total försäljning": f'=IF({n}{r}="","",{n}{r}*{b}{r})',
            "Behållning 35 %": f'=IF({t}{r}="","",ROUND({t}{r}*Antaganden!$B$5,0))',
            "Klar att skicka": (
                f'=IF({e}{r}="","Nej – saknar e-post",'
                f'IF(OR({n}{r}="",{n}{r}=0),"Nej – saknar antal deltagare",'
                f'IF({k}{r}<>"","Nej – se Kontrollera","Ja")))'
            ),
            "Att göra": (
                f'=TRIM(IF({e}{r}="","Hitta e-post. ","")'
                f'&IF(OR({n}{r}="",{n}{r}=0),"Fyll i antal deltagare. ","")'
                f'&IF({k}{r}<>"","Kolla rutan Kontrollera. ","")'
                f'&IF({chk}{r}="","Valfritt: kontaktperson.",""))'
            ),
            "Kontrollera": lead["check"] or None,
            "Prioritet": priority(lead),
            "Telefon": lead["phone"] or None,
            "Kommun": lead["kommun"] or None,
            "Län": lead["lan"] or None,
            "Idrott": lead["sport"] or None,
            "Organisationsnummer": lead["orgnr"] or None,
            "Överskott H20–V21": lead["surplus"] or None,
            "Kuvert H2025": lead["kuvert"] or None,
            "Rad i Leadsbas": lead["row"],
            "Status": "Ej skickad",
        }
        for i, (h, _, group) in enumerate(HEADERS, start=1):
            c = ws.cell(r, i, values.get(h))
            c.border = Border(bottom=THIN)
            if group == "fill" and values.get(h) in (None, ""):
                c.fill = fill_me
        for h in ("Belopp per deltagare", "Total försäljning", "Behållning 35 %", "Överskott H20–V21"):
            ws[f"{COL[h]}{r}"].number_format = '# ##0" kr"'
        for h in ("Skickat", "Följ upp senast"):
            ws[f"{COL[h]}{r}"].number_format = "yyyy-mm-dd"
        ws[f"{COL['Kontrollera']}{r}"].alignment = Alignment(wrap_text=True, vertical="top")

    last = max(2, len(leads) + 1)
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{last}"
    klar = COL["Klar att skicka"]
    ws.conditional_formatting.add(
        f"A2:{get_column_letter(len(HEADERS))}{last}",
        FormulaRule(formula=[f'${klar}2="Ja"'], fill=PatternFill("solid", fgColor=READY)),
    )
    dv = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"{COL['Status']}2:{COL['Status']}{last}")
    yn = DataValidation(type="list", formula1='"Ja,Nej"', allow_blank=True)
    ws.add_data_validation(yn)
    for h in ("Öppnat mejlet", "Öppnat förslaget", "Vill veta mer", "Svarat"):
        yn.add(f"{COL[h]}2:{COL[h]}{last}")
    return leads


def stats(leads):
    def has(l, k):
        return bool(l[k])
    return {
        "total": len(leads),
        "email": sum(has(l, "email") for l in leads),
        "members": sum(l["members"] is not None for l in leads),
        "ready": sum(priority(l) < 3 for l in leads),
        "prio1": sum(priority(l) == 1 for l in leads),
        "contact": sum(has(l, "contact") for l in leads),
        "site": sum(has(l, "site") for l in leads),
        "no_email": sum(not l["email"] and not l["check"] for l in leads),
        "need_members": sum(bool(l["email"]) and l["members"] is None for l in leads),
        "check": sum(bool(l["check"]) for l in leads),
    }


def write_assumptions(wb):
    ws = wb.create_sheet("Antaganden")
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 70
    ws["A1"] = "Antaganden i räkneexemplet"
    ws["A1"].font = Font(bold=True, size=14, color=BROWN)
    rows = [
        ("Paket per deltagare", PACKS, "Roots Premiumpaket"),
        ("Pris per paket", PACK_PRICE, "kr"),
        ("Belopp per deltagare", "=B2*B3", "[belopp] i mejlet. Ändra här så räknas alla flikar om."),
        ("Andel till föreningen", CLUB_SHARE, "Fast 35 %. Ändras inte utan beslut."),
    ]
    for i, (a, b, c) in enumerate(rows, start=2):
        ws.cell(i, 1, a)
        ws.cell(i, 2, b)
        ws.cell(i, 3, c).font = Font(color="6B5B4E")
    ws["B4"].number_format = '# ##0" kr"'
    ws["B3"].number_format = '# ##0" kr"'
    ws["B5"].number_format = "0 %"
    for cell in ("B2", "B3"):
        ws[cell].fill = PatternFill("solid", fgColor=FILL_ME)
    ws["A7"] = "Mejlets räknerad"
    ws["A7"].font = Font(bold=True)
    ws["A8"] = ("Om [antal deltagare] personer säljer för [belopp] kr var blir försäljningen "
                "[total försäljning] kr. Med 35 % till föreningen ger det [behållning] kr.")
    ws["A8"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A8:C8")
    ws.row_dimensions[8].height = 36


def write_warmup(wb, ready: dict[str, int], total_mail: dict[str, int]):
    ws = wb.create_sheet("Uppvärmning")
    widths = {"A": 16, "B": 16, "C": 14, "D": 14, "E": 14, "F": 16, "G": 60}
    for k, v in widths.items():
        ws.column_dimensions[k].width = v
    ws["A1"] = "Uppvärmning av utskicken"
    ws["A1"].font = Font(bold=True, size=14, color=BROWN)
    ws["A2"] = ("Förslag. Få mejl per dag i början så att roots.nu bygger rykte och hamnar i inkorgen, "
                "och så att Kent och Niclas hinner följa upp de som öppnar. Siffrorna i gult går att ändra.")
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:G2")
    ws.row_dimensions[2].height = 32

    head = ["Vecka", "Vardagar", "Kent per dag", "Niclas per dag", "Totalt per dag", "Totalt hittills", "Fokus"]
    for i, h in enumerate(head, start=1):
        c = ws.cell(4, i, h)
        c.fill, c.font = HEAD_FILL["base"], HEAD_FONT["base"]
    plan = [
        (1, 5, 10, 5, "Prioritet 1 först (tidigare kontakt). Följ upp öppnade samma vecka."),
        (2, 5, 20, 8, "Håll studs under 4 %. Pausa om många studsar eller svarar 'sluta'."),
        (3, 5, 30, 8, "Fortsätt med prioritet 2 och de rader Kent/Niclas har kompletterat."),
        (4, 5, 40, 8, "40 per dag och säljare är agentens tak idag."),
    ]
    for i, (v, days, kent, nic, focus) in enumerate(plan, start=5):
        ws.cell(i, 1, f"Vecka {v}")
        ws.cell(i, 2, days)
        ws.cell(i, 3, kent).fill = PatternFill("solid", fgColor=FILL_ME)
        ws.cell(i, 4, nic).fill = PatternFill("solid", fgColor=FILL_ME)
        ws.cell(i, 5, f"=C{i}+D{i}")
        ws.cell(i, 6, f"=B{i}*E{i}" if i == 5 else f"=F{i-1}+B{i}*E{i}")
        ws.cell(i, 7, focus)

    r = 11
    ws.cell(r, 1, "Läget i listan").font = Font(bold=True)
    labels = [
        ("Kent: klara att skicka nu", ready["Kent"]),
        ("Kent: har e-post", total_mail["Kent"]),
        ("Niclas: klara att skicka nu", ready["Niclas"]),
        ("Niclas: har e-post", total_mail["Niclas"]),
    ]
    for i, (a, b) in enumerate(labels, start=r + 1):
        ws.cell(i, 1, a)
        ws.cell(i, 3, b)

    r = 18
    ws.cell(r, 1, "Regler").font = Font(bold=True)
    rules = [
        "Bara vardagar, 08–16. Ingen massutskick-knapp på kvällen.",
        "Börja med ett testmejl till egna adresser på Gmail, Outlook/Hotmail och Telia och kolla att det landar i inkorgen.",
        "Studs (felaktig adress) under 4 % och skräppostanmälan under 0,08 % (Resends gränser). Går det över: pausa och rensa listan.",
        "Den som öppnar förslaget eller klickar 'Jag vill veta mer' får ett samtal inom två vardagar.",
        "Svar och avregistreringar markeras i agenten samma dag. Den som säger nej mejlas aldrig igen.",
        "Resend tillåter mer (ny domän: 150 dag 1 upp till 2 000 dag 7), men kalla mejl från en personlig adress mår bäst av lugnt tempo.",
    ]
    for i, t in enumerate(rules, start=r + 1):
        ws.cell(i, 1, f"• {t}")
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=7)
        ws.cell(i, 1).alignment = Alignment(wrap_text=True)
        ws.row_dimensions[i].height = 30


def write_readme(wb, st: dict[str, dict], skipped, shared: int):
    ws = wb.create_sheet("Läs mig", 0)
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 110
    lines: list[tuple[str, str]] = [
        ("h1", "Leadslista sats 2 – Kent och Niclas"),
        ("p", f"Byggd {date.today():%Y-%m-%d} från Leadslista_kompletterad.xlsx och mejltexten "
              "'Enklare föreningsförsäljning för [Föreningsnamn]'. Flikarna Leadsbas och Kontroll är orörda."),
        ("h2", "Flikarna"),
        ("p", "Kent – utskick / Niclas – utskick: en rad per förening som är tilldelad säljaren. "
              "Importeras direkt i Lead-mejl (välj fliken vid import)."),
        ("p", "Antaganden: belopp per deltagare (6 × 399 kr = 2 394 kr) och 35 % till föreningen. Styr räkneexemplet."),
        ("p", "Uppvärmning: hur många mejl per dag de första veckorna, och reglerna för uppföljning."),
        ("h2", "Färgerna i rubrikraden"),
        ("p", "Gul = Kent och Niclas fyller i (tomma gula rutor saknas). Brun = från listan. "
              "Ljusbrun = räknas automatiskt. Grön = fylls i efter utskick (skickat, öppnat, svarat, nästa steg)."),
        ("p", "Hela raden blir grön när den är klar att skicka."),
        ("h2", "Läget"),
    ]
    for seller in SELLERS:
        s = st[seller]
        lines.append(("p", (
            f"{seller}: {s['total']} föreningar. {s['email']} har e-post, {s['members']} har medlemsantal, "
            f"{s['ready']} är klara att skicka nu (varav {s['prio1']} med tidigare försäljning, prioritet 1). "
            f"{s['contact']} har kontaktperson, {s['site']} har webbplats."
        )))
    lines += [
        ("p", f"{len(skipped)} föreningar markerade 'Ta ej med' är inte med i utskicksflikarna."),
        ("p", f"{shared} e-postadresser delas av flera föreningar. Adressen står kvar på en rad; "
              "övriga rader har en förklaring i Kontrollera."),
        ("h2", "Manuellt jobb för Kent och Niclas (i den här ordningen)"),
    ]
    k, n = st["Kent"], st["Niclas"]
    lines += [
        ("p", "Antal deltagare är förifyllt med föreningens alla medlemmar. Bedöm och justera där det "
              "behövs, så räknas försäljning och behållning om direkt."),
        ("p", f"1. Fyll i Antal deltagare där e-post finns men antal saknas (Kent {k['need_members']}, "
              f"Niclas {n['need_members']}). Sortera på Prioritet och Överskott så tas de viktigaste först."),
        ("p", f"2. Gå igenom rutan Kontrollera ({k['check'] + n['check']} rader): delade adresser, "
              "stora föreningar och adresser vars domän inte tar emot mejl. Töm rutan när det är löst."),
        ("p", f"3. Hitta e-post för de som saknar (Kent {k['no_email']}, Niclas {n['no_email']})."),
        ("p", "4. Valfritt: kontaktperson (ger 'Hej Anna!' i stället för 'Hej!') och webbplats "
              "(ger föreningens logga i shopförslaget)."),
        ("p", "Skriv bara i gula kolumner och de gröna uppföljningskolumnerna. Ändra inte Förening eller Rad i Leadsbas."),
        ("h2", "Så används kolumnerna i mejlet"),
        ("p", "[Föreningsnamn] = Förening. [Förnamn] = första namnet i Kontaktperson. "
              "[antal deltagare] = Antal deltagare. [belopp] = Belopp per deltagare. "
              "[total försäljning] = Total försäljning. [Behållning] = Behållning 35 %. "
              "[Se shopförslaget] = länk till föreningens egen shop, med logga från Webbplats."),
    ]
    if skipped:
        lines.append(("h2", "Ta ej med"))
        for seller, name, row in skipped:
            lines.append(("p", f"{name} ({seller}, rad {row} i Leadsbas)"))

    r = 1
    for kind, t in lines:
        if kind == "h2":
            r += 1
        c = ws.cell(r, 2, t)
        if kind == "h1":
            c.font = Font(bold=True, size=16, color=BROWN)
            ws.row_dimensions[r].height = 26
        elif kind == "h2":
            c.font = Font(bold=True, size=12, color=BROWN)
        else:
            c.alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 15 * max(1, -(-len(t) // 120))
        r += 1
    ws.sheet_view.showGridLines = False


def main(src: str, dst: str):
    wb = load_workbook(src)
    leads, skipped = collect(wb["Leadsbas"])
    shared = mark_shared(leads)
    mark_big(leads)
    dead = mark_dead_domains(leads)
    st = {}
    for seller in SELLERS:
        write_seller_sheet(wb, f"{seller} – utskick", leads[seller])
        st[seller] = stats(leads[seller])
    write_warmup(
        wb,
        {s: st[s]["ready"] for s in SELLERS},
        {s: st[s]["email"] for s in SELLERS},
    )
    write_assumptions(wb)
    write_readme(wb, st, skipped, shared)
    originals = [wb["Leadsbas"], wb["Kontroll"]]
    wb._sheets = [ws for ws in wb.worksheets if ws not in originals] + originals
    wb.active = 0
    for ws in wb.worksheets:
        ws.sheet_view.tabSelected = ws.title == "Läs mig"
    wb.save(dst)
    for seller in SELLERS:
        print(seller, st[seller])
    print("ta ej med:", len(skipped), "delade adresser:", shared, "döda domäner:", dead)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
