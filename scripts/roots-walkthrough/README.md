# Roots förenings-walkthrough (desktop, produktion)

Längre instruktionsfilm mot `https://roots.nu`. Sex kapitel, Tell→Show-
titelkort, jämn desktop-scroll. Preview-grind och föreningsinloggning
sker utanför kameran — dashboarden visas som om Anna Andersson redan är
inne. På film: Roots FBK. Befintliga 30-sekunders mobilfilmer i
`scripts/roots-demo/` lämnas orörda.

## Miljö (sätt lokalt — inte i git)

```bash
export BASE_URL=https://roots.nu
export SITE_PREVIEW_PASSWORD='…'          # samma som Railway
export FILM_INTERNAL_EMAIL='…'            # INTERNAL_ADMIN
export FILM_INTERNAL_PASSWORD='…'
export FILM_ASSOC_EMAIL='walk.forening@…' # valfritt, annars genereras
export FILM_PASSWORD='…'                  # minst 12 tecken
```

Klistra inte in värdena i chatt.

## Körordning

```bash
cd scripts/roots-walkthrough
node list-test-people.js
FILM_PASSWORD='…' node reset-test-people.js --apply
FILM_PASSWORD='…' node run-person-prod.js
FILM_PASSWORD='…' node fix-person-luckor.js --apply
FILM_PASSWORD='…' node run-person-luckor.js
node seed-film-data.js
node titles.js

node record.js 1
node record.js 2
node record.js 3
node record.js 4
node record.js 5
node record.js 6

node compose.js
node concat.js
```

Utdata: `out/sv/walkthrough-forening.mp4` plus `out/sv/kapitel-0N/kapitel-0N.mp4`.

Återanvänd Roots FBK i `out/sv/state.json` — registrera inte en ny förening.
`node seed-film-data.js` fyller PAID-ordrar så grafer och KPI:er syns.
Inga Stripe-köp körs. `out/` ligger i `.gitignore`.
