# Workboard

Kanonisk fil (Cursor och adminvy läser samma JSON-historik):

`apps/api/src/lib/orchestrator/workboard.json`

I prod vinner databasen (`orchestrator_cards`) på samma id.

Statusmaskin: `inbox → ready → doing → done`. `blocked` när en grind
väntar. Skriv inte en parallell JSON här.
