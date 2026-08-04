# Presentationer

Tre presentationer byggs ur kollegans Master Source-dokument. Underlaget är inte
bakgrundsmaterial att sammanfatta — varje MS-ID **är** en färdig
slide-specifikation med titel, undertitel, slide-innehåll, talarmanus, övergång
och layoutanvisning. Modulinstruktionen är uttrycklig:

> "Den svenska texten ska användas exakt enligt respektive Slide Specification
> och får inte översättas eller omformuleras av designagenten."

Därför skrivs ingen text av här. `decks.py` hämtar varje sträng ur källan, och
`verify_verbatim.py` är kvittot på att det stämmer.

| Fil | Innehåll ur Master Source | Publik |
|---|---|---|
| `Roots_Saljpresentation.pptx` | MS-001–015: vision, affären, plattformen | Föreningsstyrelser |
| `Roots_Roadmap_Ar_1-5.pptx` | MS-114 (år 1) och MS-115 (år 1–5) | Internt, styrelse, partners |
| `Roots_Oversiktspresentation.pptx` | Vision, erbjudande, plattform samt arbetssättet i MS-017–020 | Bred, internt och externt |

Underlaget innehåller nitton färdigspecificerade slides (MS-001–015 och
MS-017–020) plus de två roadmap-dokumenten. Övriga MS-poster i den stora
Master Source-filen är arbetsanteckningar utan slide-specifikation och används
inte.

## Bygga

```bash
python3 docs/presentations/build_decks.py       # alla tre
python3 docs/presentations/build_decks.py d1    # bara säljpresentationen
python3 docs/presentations/verify_verbatim.py   # kontrollera ordagrannheten
```

Kräver `python-pptx` och `Pillow`.

## Kedjan

1. `docs/knowledge-os/extract_sources.py` — kollegans `.docx`-underlag i
   `~/Desktop/ROOTS Knowledge Operating System` blir markdown i `_extract/`.
2. `docs/knowledge-os/ms_source.py` — läser varje MS-specifikation med alla
   fält. Två dokumentformat hanteras: modulfilernas `### Titel`-fält och
   35-punktsmallen i MS-114/MS-115. Kör filen direkt för att se vad som hittades.
3. `decks.py` — **det enda som bestäms här är struktur:** vilka MS-ID som ingår
   i vilken presentation, i vilken ordning, och vilken renderare som motsvarar
   respektive Layout/Grafik-anvisning. All text hämtas ur källan.
4. `roots_deck.py` renderar layouterna, `build_decks.py` skriver `.pptx`.
5. `verify_verbatim.py` kontrollerar att varje synlig sträng finns ordagrant i
   källdokumenten. Undantagen är listade i `STRUCTURAL` och är strukturell
   navigation — kickers, spaltrubriker och några rubriker där källans egen
   inledning är ett helt stycke.

Talarmanuset i anteckningsfältet innehåller källans Syfte, Huvudbudskap,
Stödjande budskap, Take-away, Speaker Notes, Presentatörens uppgift, Övergång,
Designnoteringar, Editorial Notes och Faktastatus — samt vilket MS-ID sliden
kommer ur.

## Granska visuellt

```bash
cd docs/presentations && mkdir -p _preview
soffice --headless --convert-to pdf --outdir _preview *.pptx
for f in _preview/*.pdf; do pdftoppm -r 84 -png "$f" "_preview/$(basename "$f" .pdf)"; done
```

## Keynote

Filerna öppnas i både PowerPoint och Keynote. Att de gör det i Keynote beror på
`register_notes_master()` i `build_decks.py`: så fort en slide får talarmanus
skapar python-pptx en anteckningsmall och en relation till den, men skriver aldrig
`<p:notesMasterIdLst>` i `presentation.xml`. PowerPoint och LibreOffice struntar i
det, Keynote avvisar hela filen med "Filformatet är ogiltigt". Ta inte bort det
anropet.

Kontrollera efter ett bygge:

```bash
unzip -p docs/presentations/Roots_Saljpresentation.pptx ppt/presentation.xml \
  | grep -c notesMasterIdLst    # ska vara 1
```

## Att veta innan revideringen

- Ska en formulering ändras görs det i Master Source-dokumentet, inte här.
  Kör `extract_sources.py` igen och bygg om.
- Renderaren uppskattar radbrytning ur teckenantal för att välja fontstorlek.
  Uppskattningen tar hänsyn till versalandel men är inte exakt — lägger du till
  märkbart längre rubriker, titta på slidesen efteråt.
- Ett par slides sätter samman flera stycken ur källan till en rad (kvartalens
  prioriteringar, rollernas ansvarslistor). Ordagrannhetskontrollen godtar det
  genom att söka varje del för sig.
- Bilder anges relativt `apps/web/public/`.
- Faktastatus i källan är inte grön överallt. MS-002, MS-003, MS-004, MS-005 och
  MS-015 har verifieringspunkter som ska stängas före extern användning; de står
  i respektive slides anteckningsfält.
