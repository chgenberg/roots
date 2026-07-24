# Roots presentationsmallar

Ett återanvändbart mall-bibliotek för Roots-presentationer. Samma känsla,
färger och typsnitt som hemsidan (**Alan Sans** rubrik + **Inter** brödtext)
och den tidigare säljkickoffen. 16:9.

## Filer

| Fil | Vad |
| --- | --- |
| `roots_templates.py` | Mall-biblioteket. `Deck`-klass med en metod per layout. |
| `build_template_catalog.py` | Bygger **Roots_Presentationsmallar.pptx** — visar alla mallar med platshållar-innehåll. |
| `build_kickoff_from_templates.py` | Bygger **Roots_Saljkickoff_Mallbaserad.pptx** — samma säljkickoff, men helt gjord av mallarna. |

Färdiga `.pptx` ligger även på skrivbordet.

## Mallarna (16 st)

Titelsida · Avsnittsdelare · Endast rubrik · Rubrik + text · Punktlista ·
Agenda · Rubrik + bild + text · Bild + text (spegel) · Helbild · Två kolumner ·
Kort (2–4) · Nyckeltal · Statement/hero · Citat · Produktkort · Flöde · Skärmar ·
Avslutning.

## Bygg om

```bash
.venv/bin/python docs/roots-templates/build_template_catalog.py
.venv/bin/python docs/roots-templates/build_kickoff_from_templates.py
```

## Gör en ny presentation

```python
from roots_templates import Deck

d = Deck(footer_label="Mitt möte 2026")
d.cover(kicker="...", title1="Rubrik", title2="del två", subtitle="...")
d.title_bullets(kicker="AVSNITT", title="Tre poänger", bullets=["A", "B", "C"])
d.title_image(kicker="...", title="...", body=["..."], image="images/collection-1.jpg")
d.stat(kicker="...", title="...", stats=[("35 %", "till föreningen"), ("0 kr", "uppstart")])
d.closing(title="Tack.", subtitle="Frågor?")
d.save("Min_presentation.pptx")
```

Byt bara ut text och bild — layouten sköter resten. Bilder anges relativt
`apps/web/public/` (t.ex. `images/collection-1.jpg`, `brand/roots-logo-black.png`).
