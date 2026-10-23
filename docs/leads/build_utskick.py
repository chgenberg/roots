"""Bygger utskicksfilen för lead-mejl sats 2 (Kent, Niclas och Johan).

Läser Leadslista_kompletterad.xlsx, behåller flikarna Leadsbas och Kontroll
orörda och lägger till: Läs mig, en flik per avsändare, Uppvärmning
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

# Föreningar utan "Säljare Roots" får introduktionen från Johan (HK).
SELLERS = ("Kent", "Niclas", "Johan")
CENTRAL = "Johan"
PACKS, PACK_PRICE, CLUB_SHARE = 6, 399, 0.35
BIG_CLUB = 1000

# Leadsbas, kolumnindex (0-baserat), version 2 av listan (21 kolumner).
C_NAME, C_LAN, C_KOMMUN, C_ORG, C_SPORT, C_SELLER = 0, 1, 2, 3, 4, 5
C_SURPLUS, C_KUVERT, C_ORGNR, C_SITE, C_MEMBERS, C_YEAR = 6, 7, 8, 9, 10, 11
C_CONTACT, C_ROLE = 12, 13
C_EMAILS = (14, 15, 16, 17)
C_PHONE, C_SKIP, C_CATEGORY = 18, 19, 20
EXPECTED_HEADERS = {C_SELLER: "Säljare Roots", C_EMAILS[0]: "E-post 1", C_CATEGORY: "Kategori"}

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
    for i in C_EMAILS:
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
    header = [c.value for c in ws[1]]
    for i, name in EXPECTED_HEADERS.items():
        if header[i] != name:
            raise SystemExit(f"Kolumn {i + 1} heter {header[i]!r}, väntade {name!r}. Fel version av listan?")
    leads = {s: [] for s in SELLERS}
    skipped = []
    for rownum, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not text(row[C_NAME]):
            continue
        seller = text(row[C_SELLER]) or CENTRAL
        if seller not in leads:
            raise SystemExit(f"Okänd säljare {seller!r} på rad {rownum}.")
        if text(row[C_SKIP]):
            skipped.append((seller, text(row[C_NAME]), rownum))
            continue
        mails = emails_of(row)
        if seller == CENTRAL and not mails:
            continue
        leads[seller].append({
            "row": rownum,
            "name": text(row[C_NAME]),
            "contact": text(row[C_CONTACT]),
            "email": mails[0] if mails else "",
            "more": ", ".join(mails[1:]),
            "site": site_of(row),
            "phone": text(row[C_PHONE]),
            "kommun": text(row[C_KOMMUN]),
            "lan": text(row[C_LAN]).title(),
            "sport": text(row[C_SPORT]),
            "orgnr": text(row[C_ORGNR]),
            "members": members_of(row),
            "year": row[C_YEAR] if isinstance(row[C_YEAR], int) and row[C_YEAR] > 0 else None,
            "surplus": number(row[C_SURPLUS]),
            "kuvert": number(row[C_KUVERT]),
            "category": text(row[C_CATEGORY]).upper(),
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
        group.sort(key=lambda l: (l["category"] != "A", l["members"] is None, -l["surplus"]))
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
            if lead["email"] and lead["email"].split("@")[1] in dead:
                lead["check"] = " ".join(x for x in [
                    f"{lead['email']}: domänen tar inte emot mejl. Hitta en ny adress, "
                    "skriv den i E-post och töm sedan den här rutan.",
                    lead["check"],
                ] if x)
                lead["email"] = ""
                n += 1
    return n


def ready_personal(lead) -> bool:
    return bool(lead["email"]) and lead["members"] is not None and not lead["check"]


def priority(lead) -> int:
    """1 = klar för personligt mejl och prioriterad (kategori A eller tidigare försäljning)."""
    if ready_personal(lead):
        return 1 if lead["category"] == "A" or lead["surplus"] > 0 else 2
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
    ("Klar för intro", 12, "calc"),
    ("Klar för personligt mejl", 22, "calc"),
    ("Att göra", 34, "calc"),
    ("Kontrollera", 40, "fill"),
    ("Prioritet", 8, "base"),
    ("Kategori", 8, "base"),
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

    leads = sorted(leads, key=lambda l: (
        priority(l), l["category"] != "A", not l["email"], -l["surplus"], l["name"].lower()))
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
            "Klar för intro": f'=IF({e}{r}="","Nej","Ja")',
            "Klar för personligt mejl": (
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
            "Kategori": lead["category"] or None,
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
    klar = COL["Klar för personligt mejl"]
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
        "cat_a": sum(l["category"] == "A" for l in leads),
        "cat_a_need": sum(l["category"] == "A" and not ready_personal(l) for l in leads),
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


INTRO_DAYS = [
    (date(2026, 10, 27), 150), (date(2026, 10, 28), 250), (date(2026, 10, 29), 400),
    (date(2026, 10, 30), 600), (date(2026, 11, 2), 800), (date(2026, 11, 3), 1000),
    (date(2026, 11, 4), 1000), (date(2026, 11, 5), 1000),
]
WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"]


def intro_schedule(counts: dict[str, int]) -> list[tuple[date, int, dict[str, int]]]:
    """Kents och Niclas föreningar först (i proportion), sedan Johans, inom dagstaket."""
    left = dict(counts)
    days = []
    for day, cap in INTRO_DAYS:
        room, split = cap, {}
        districts = left["Kent"] + left["Niclas"]
        if districts:
            take = min(room, districts)
            kent = min(left["Kent"], round(take * left["Kent"] / districts))
            nic = min(left["Niclas"], take - kent)
            kent = take - nic
            split.update(Kent=kent, Niclas=nic)
            left["Kent"] -= kent
            left["Niclas"] -= nic
            room -= take
        if room and left[CENTRAL]:
            take = min(room, left[CENTRAL])
            split[CENTRAL] = take
            left[CENTRAL] -= take
            room -= take
        days.append((day, cap - room, split))
        if not any(left.values()):
            break
    return days


def write_warmup(wb, intro: dict[str, int], ready: dict[str, int]):
    ws = wb.create_sheet("Uppvärmning")
    widths = {"A": 16, "B": 12, "C": 12, "D": 12, "E": 12, "F": 14, "G": 62}
    for k, v in widths.items():
        ws.column_dimensions[k].width = v
    ws["A1"] = "Uppvärmning av utskicken"
    ws["A1"].font = Font(bold=True, size=14, color=BROWN)
    ws["A2"] = ("Få mejl per dag i början så att roots.nu bygger rykte och hamnar i inkorgen, och så att "
                "Kent, Niclas och Johan hinner ta hand om svaren. Under Resends tak för en ny domän "
                "(150 dag 1, 250, 400, 700, 1 000, 1 500, 2 000).")
    ws["A2"].alignment = Alignment(wrap_text=True)
    ws.merge_cells("A2:G2")
    ws.row_dimensions[2].height = 32

    ws["A4"] = "1. Introduktionsmejlet (samma text till alla, inget räkneexempel)"
    ws["A4"].font = Font(bold=True, color=BROWN)
    head = ["Dag", "Kent", "Niclas", "Johan", "Totalt", "Totalt hittills", "Kommentar"]
    for i, h in enumerate(head, start=1):
        c = ws.cell(5, i, h)
        c.fill, c.font = HEAD_FILL["base"], HEAD_FONT["base"]
    r = 6
    first = r
    for n, (day, total, split) in enumerate(intro_schedule(intro)):
        ws.cell(r, 1, f"{WEEKDAYS[day.weekday()]} {day.day}/{day.month}")
        for col, seller in ((2, "Kent"), (3, "Niclas"), (4, CENTRAL)):
            ws.cell(r, col, split.get(seller) or None)
        ws.cell(r, 5, f"=SUM(B{r}:D{r})")
        ws.cell(r, 6, f"=E{r}" if r == first else f"=F{r - 1}+E{r}")
        note = {0: "Testmejl till egna adresser först. Kolla att det landar i inkorgen."}.get(n, "")
        if not note and split.get(CENTRAL) and not any(split.get(s) for s in ("Kent", "Niclas")):
            note = "Bara Johans föreningar kvar."
        ws.cell(r, 7, note or None)
        r += 1
    ws.cell(r, 1, "Summa").font = Font(bold=True)
    for col in (2, 3, 4, 5):
        L = get_column_letter(col)
        ws.cell(r, col, f"=SUM({L}{first}:{L}{r - 1})").font = Font(bold=True)

    r += 2
    ws.cell(r, 1, "2. Personligt mejl med räkneexempel och shopförslag").font = Font(bold=True, color=BROWN)
    r += 1
    ws.cell(r, 1, ("Startar 5–7 arbetsdagar efter att föreningen fick introduktionen, med prioritet 1 först "
                   "(Niclas kategori A, Kents tidigare försäljning). Bara rader där Klar för personligt mejl = Ja."))
    ws.cell(r, 1).alignment = Alignment(wrap_text=True)
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
    ws.row_dimensions[r].height = 30
    r += 1
    for i, h in enumerate(["Vecka", "Vardagar", "Kent per dag", "Niclas per dag", "Totalt per dag", "Totalt hittills", "Fokus"], start=1):
        c = ws.cell(r, i, h)
        c.fill, c.font = HEAD_FILL["base"], HEAD_FONT["base"]
    plan = [
        ("Från 3/11", 5, 10, 10, "Ring de som inte svarat efter 3–5 arbetsdagar."),
        ("Från 10/11", 5, 20, 20, "Håll studs under 4 %. Pausa om många studsar eller svarar 'sluta'."),
        ("Från 17/11", 5, 30, 30, "Fortsätt med prioritet 2 och de rader som har kompletterats."),
        ("Från 24/11", 5, 40, 40, "40 per dag och säljare är agentens tak idag."),
    ]
    start = r + 1
    for i, (v, days, kent, nic, focus) in enumerate(plan, start=start):
        ws.cell(i, 1, v)
        ws.cell(i, 2, days)
        ws.cell(i, 3, kent).fill = PatternFill("solid", fgColor=FILL_ME)
        ws.cell(i, 4, nic).fill = PatternFill("solid", fgColor=FILL_ME)
        ws.cell(i, 5, f"=C{i}+D{i}")
        ws.cell(i, 6, f"=B{i}*E{i}" if i == start else f"=F{i - 1}+B{i}*E{i}")
        ws.cell(i, 7, focus)
    r = start + len(plan)
    ws.cell(r, 1, f"Klara för personligt mejl nu: Kent {ready['Kent']}, Niclas {ready['Niclas']}.")
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)

    r += 2
    ws.cell(r, 1, "Regler").font = Font(bold=True)
    rules = [
        "Bara vardagar, 08–16.",
        "Studs (felaktig adress) under 4 % och skräppostanmälan under 0,08 % (Resends gränser). Går det över: pausa och rensa listan.",
        "Den som klickar 'Jag vill veta mer' eller svarar kontaktas inom två arbetsdagar.",
        "Den som svarar eller anmäler intresse får inga fler standardmejl. Den som säger nej mejlas aldrig igen.",
        "'Öppnat' är en fingervisning (Apple Mail visar nästan allt som öppnat). Klick och svar är de säkra signalerna.",
    ]
    for i, t in enumerate(rules, start=r + 1):
        ws.cell(i, 1, f"• {t}")
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=7)
        ws.cell(i, 1).alignment = Alignment(wrap_text=True)
        ws.row_dimensions[i].height = 30


def write_readme(wb, st: dict[str, dict], skipped, shared: int, dead: int):
    ws = wb.create_sheet("Läs mig", 0)
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 110
    k, n, j = st["Kent"], st["Niclas"], st[CENTRAL]
    intro_total = k["email"] + n["email"] + j["email"]
    lines: list[tuple[str, str]] = [
        ("h1", "Leadslista sats 2 – Kent, Niclas och Johan"),
        ("p", f"Byggd {date.today():%Y-%m-%d} från Leadslista_kompletterad.xlsx (version med Säljare Roots och "
              "Kategori). Flikarna Leadsbas och Kontroll är orörda."),
        ("h2", "Två utskick"),
        ("p", "1. Introduktionsmejlet 'Möt Roots – enklare försäljning för er förening' går brett från tisdag 27 okt. "
              "Samma text till alla, med knappen 'Jag vill veta mer'. Kräver bara e-post."),
        ("p", "2. Det personliga mejlet med räkneexempel och shopförslag kommer 5–7 arbetsdagar senare, från Kent "
              "och Niclas till deras egna föreningar. Kräver e-post och antal deltagare."),
        ("h2", "Flikarna"),
        ("p", "Kent – utskick / Niclas – utskick: alla föreningar som är taggade på säljaren. Importeras i Lead-mejl."),
        ("p", f"{CENTRAL} – intro: föreningar utan säljare som har e-post. Får introduktionen från Johan Lindqvist."),
        ("p", "Uppvärmning: hur många mejl per dag, dag för dag, och reglerna för uppföljning."),
        ("p", "Antaganden: belopp per deltagare (6 × 399 kr = 2 394 kr) och 35 % till föreningen."),
        ("h2", "Färgerna i rubrikraden"),
        ("p", "Gul = Kent och Niclas fyller i (tomma gula rutor saknas). Brun = från listan. "
              "Ljusbrun = räknas automatiskt. Grön = fylls i efter utskick (skickat, öppnat, svarat, nästa steg). "
              "Hela raden blir grön när den är klar för det personliga mejlet."),
        ("h2", "Läget"),
        ("p", f"Introduktionen: {intro_total} föreningar med e-post (Kent {k['email']}, Niclas {n['email']}, "
              f"Johan {j['email']}). Varje adress finns bara på en rad."),
        ("p", f"Kent: {k['total']} föreningar, {k['members']} med medlemsantal, {k['ready']} klara för personligt "
              f"mejl ({k['prio1']} med tidigare försäljning = prioritet 1)."),
        ("p", f"Niclas: {n['total']} föreningar, varav {n['cat_a']} i kategori A. {n['members']} med medlemsantal, "
              f"{n['ready']} klara för personligt mejl."),
        ("p", f"{len(skipped)} föreningar markerade 'Ta ej med' är inte med. {shared} adresser delas av flera "
              f"föreningar och står bara på en rad. {dead} adresser ligger på domäner som inte tar emot mejl "
              "och är flyttade till Kontrollera."),
        ("h2", "Manuellt jobb för Kent och Niclas"),
        ("p", "Antal deltagare är förifyllt med föreningens alla medlemmar där det finns. Bedöm och justera, "
              "så räknas försäljning och behållning om direkt."),
        ("p", f"1. Niclas: fyll i Antal deltagare för kategori A först ({n['cat_a_need']} rader). "
              f"Kent: börja med prioritet och överskott ({k['need_members']} rader med e-post saknar antal)."),
        ("p", f"2. Gå igenom Kontrollera (Kent {k['check']}, Niclas {n['check']}): delade adresser, stora "
              "föreningar och döda adresser. Töm rutan när det är löst."),
        ("p", f"3. Hitta e-post där den saknas (Kent {k['no_email']}, Niclas {n['no_email']}). Nya adresser "
              "före måndag kväll hinner med i introduktionen."),
        ("p", "4. Valfritt: kontaktperson (ger 'Hej Anna!' i stället för 'Hej!') och webbplats "
              "(ger föreningens logga i shopförslaget)."),
        ("p", "Skriv bara i gula kolumner och de gröna uppföljningskolumnerna. Ändra inte Förening eller Rad i Leadsbas."),
        ("h2", "Så används kolumnerna i det personliga mejlet"),
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
        title = f"{seller} – intro" if seller == CENTRAL else f"{seller} – utskick"
        write_seller_sheet(wb, title, leads[seller])
        st[seller] = stats(leads[seller])
    write_warmup(
        wb,
        {s: st[s]["email"] for s in SELLERS},
        {s: st[s]["ready"] for s in SELLERS},
    )
    write_assumptions(wb)
    write_readme(wb, st, skipped, shared, dead)
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
