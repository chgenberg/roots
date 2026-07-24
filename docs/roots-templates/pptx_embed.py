# -*- coding: utf-8 -*-
"""
Bädda in typsnitt i en .pptx så att Alan Sans + Inter följer med filen och
renderas korrekt även på datorer där typsnitten inte är installerade.

python-pptx saknar stöd för font-embedding, så vi efterbehandlar zip-arkivet:
lägger in TTF-filerna under ppt/fonts/, registrerar dem i relationships,
[Content_Types].xml och <p:embeddedFontLst> i presentation.xml.

Använd:  embed_fonts("Min.pptx")
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.abspath(os.path.join(ROOT, "..", "..", "apps", "web", "public", "fonts"))

# Typsnitt → faces. Namnen måste matcha run.font.name i presentationen.
FONT_FACES = [
    ("Alan Sans", {
        "regular": os.path.join(FONTS, "alan-sans", "AlanSans-Medium.ttf"),
        "bold": os.path.join(FONTS, "alan-sans", "AlanSans-ExtraBold.ttf"),
    }),
    ("Inter 18pt", {
        "regular": os.path.join(FONTS, "inter", "Inter_18pt-Regular.ttf"),
        "bold": os.path.join(FONTS, "inter", "Inter_18pt-Bold.ttf"),
        "italic": os.path.join(FONTS, "inter", "Inter_18pt-Italic.ttf"),
    }),
]


def embed_fonts(pptx_path):
    tmp = pptx_path + ".tmp"
    with zipfile.ZipFile(pptx_path, "r") as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    # 1) Samla in font-filer + tilldela index och rel-id.
    entries = []  # (typeface, {style: (fntname, relid, bytes)})
    idx = 0
    for typeface, faces in FONT_FACES:
        style_map = {}
        for style, path in faces.items():
            if not os.path.exists(path):
                continue
            idx += 1
            fnt = f"font{idx}.fntdata"
            rid = f"rIdEmbFont{idx}"
            with open(path, "rb") as f:
                style_map[style] = (fnt, rid, f.read())
        if style_map:
            entries.append((typeface, style_map))

    # 2) Lägg in font-filerna.
    for _, style_map in entries:
        for style, (fnt, rid, blob) in style_map.items():
            data[f"ppt/fonts/{fnt}"] = blob

    # 3) [Content_Types].xml – default för fntdata.
    ct = data["[Content_Types].xml"].decode("utf-8")
    if "fntdata" not in ct:
        insert = '<Default Extension="fntdata" ContentType="application/x-fontdata"/>'
        ct = ct.replace("</Types>", insert + "</Types>")
    data["[Content_Types].xml"] = ct.encode("utf-8")

    # 4) presentation.xml.rels – relationer till varje font.
    rels_key = "ppt/_rels/presentation.xml.rels"
    rels = data[rels_key].decode("utf-8")
    rel_xml = ""
    for _, style_map in entries:
        for style, (fnt, rid, _blob) in style_map.items():
            rel_xml += (
                f'<Relationship Id="{rid}" '
                f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" '
                f'Target="fonts/{fnt}"/>'
            )
    rels = rels.replace("</Relationships>", rel_xml + "</Relationships>")
    data[rels_key] = rels.encode("utf-8")

    # 5) presentation.xml – embedTrueTypeFonts + <p:embeddedFontLst>.
    pres_key = "ppt/presentation.xml"
    pres = data[pres_key].decode("utf-8")

    m = re.search(r"<p:presentation\b[^>]*>", pres)
    open_tag = m.group(0)
    new_tag = open_tag
    if "embedTrueTypeFonts" not in new_tag:
        new_tag = new_tag[:-1] + ' embedTrueTypeFonts="1">'
    if 'saveSubsetFonts="1"' in new_tag:
        new_tag = new_tag.replace('saveSubsetFonts="1"', 'saveSubsetFonts="0"')
    elif "saveSubsetFonts" not in new_tag:
        new_tag = new_tag[:-1] + ' saveSubsetFonts="0">'
    pres = pres.replace(open_tag, new_tag, 1)

    lst = "<p:embeddedFontLst>"
    for typeface, style_map in entries:
        lst += f'<p:embeddedFont><p:font typeface="{typeface}"/>'
        for style in ("regular", "bold", "italic", "boldItalic"):
            if style in style_map:
                _fnt, rid, _b = style_map[style]
                lst += f'<p:{style} r:id="{rid}"/>'
        lst += "</p:embeddedFont>"
    lst += "</p:embeddedFontLst>"

    # Infoga efter notesSz (schemakrav: efter sldSz/notesSz).
    pres = re.sub(r"(<p:notesSz\b[^>]*/>)", r"\1" + lst, pres, count=1)
    data[pres_key] = pres.encode("utf-8")

    # 6) Skriv nytt arkiv.
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for n, blob in data.items():
            zout.writestr(n, blob)
    shutil.move(tmp, pptx_path)
    return pptx_path
