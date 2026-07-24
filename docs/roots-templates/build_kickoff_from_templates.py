#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Säljkickoff — byggd på mall-biblioteket (roots_templates.Deck).

Samma presentation som docs/sales-kickoff, men här renderad enbart genom
de återanvändbara mallarna. Visar hur snabbt en färdig deck sätts ihop när
mallarna finns: mappa varje innehålls-dict till rätt mall-metod.

Kör:  .venv/bin/python docs/roots-templates/build_kickoff_from_templates.py
"""
import os
import sys

from roots_templates import Deck

# Återanvänd exakt samma innehåll (en sanning) från säljkickoffen.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__),
                                                 "..", "sales-kickoff")))
from content import SLIDES  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "Roots_Saljkickoff_Mallbaserad.pptx")

d = Deck(footer_label="Säljkickoff 2026")

# En rad per innehållstyp → en mall-metod. Inget layout-arbete kvar.
DISPATCH = {
    "cover": lambda x: d.cover(x["kicker"], x["title1"], x["title2"], x["subtitle"]),
    "agenda": lambda x: d.agenda(x["kicker"], x["title"], x["items"]),
    "divider": lambda x: d.divider(x["num"], x["title"]),
    "points": lambda x: d.title_bullets(x["kicker"], x["title"], x["bullets"]),
    "hero": lambda x: d.hero(x["kicker"], x["line1"], x["line2"]),
    "cards": lambda x: d.cards(x["kicker"], x["title"], x["cards"]),
    "products": lambda x: d.products(x["kicker"], x["title"], x["cards"]),
    "flow": lambda x: d.flow(x["kicker"], x["title"], x["steps"]),
    "screens": lambda x: d.screens(x["kicker"], x["title"], x["screens"]),
    "close": lambda x: d.closing(x["title"], x["subtitle"]),
}

for slide in SLIDES:
    DISPATCH[slide["kind"]](slide)

d.save(OUT)
print("PPTX:", OUT, f"({len(d.prs.slides._sldIdLst)} slides)")
