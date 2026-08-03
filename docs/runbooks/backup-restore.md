# Backup och återställning

> Databasen innehåller kampanjer, ordrar, utbetalningsunderlag och
> personuppgifter om minderåriga säljare. En förlorad databas är inte ett
> driftavbrott, det är en avslutad verksamhet.
>
> **En backup som aldrig återställts är inte en backup.** Den enda punkt i
> det här dokumentet som får hoppas över är ingen.

## Nuläge

| Fråga | Svar |
| --- | --- |
| Var ligger databasen? | Railway Postgres (managed) |
| Automatiska snapshots? | Railway tar dagliga snapshots på betalda planer — **verifiera i Railway → Postgres → Backups att de är påslagna** |
| Point-in-time recovery? | Ingår inte i Railways standardplan. Vår RPO är därför "senaste snapshot", i värsta fall ett dygn |
| Egen backup utanför Railway? | Ja, se nedan. Vi förlitar oss inte på att leverantören också är vår enda kopia |

Att ha en kopia hos samma leverantör som driver databasen skyddar mot
diskfel, men inte mot ett borttaget projekt, en felaktig faktura eller ett
komprometterat konto. Därför tar vi också en egen dump.

## Så här tar du en backup

```bash
# Kräver att pg_dump finns lokalt (brew install libpq eller postgresql).
# DATABASE_URL hämtas från Railway → Postgres → Connect → Postgres Connection URL.
export DATABASE_URL='postgresql://...'
./scripts/db-backup.sh
```

Skriptet skriver `backups/roots-<miljö>-<tidsstämpel>.dump` i custom-format
(`pg_dump -Fc`), vilket är komprimerat och kan återställas selektivt per
tabell. Det vägrar skriva en dump som är misstänkt liten — en tom fil som
heter backup är farligare än ingen fil alls, för den ser ut som skydd.

Filerna hamnar i `backups/` som är git-ignorerad. **Lägg dem inte i repot.**
Flytta dem till lösenordsskyddad lagring utanför Railway (kryptera först,
de innehåller personuppgifter).

## Så här återställer du

### Till en ny databas (det normala)

Återställ aldrig direkt över en produktionsdatabas som fortfarande tar
trafik. Skapa en ny, verifiera, och peka om `DATABASE_URL`.

```bash
# 1. Skapa en ny Postgres i Railway. Kopiera dess URL.
export TARGET_URL='postgresql://...ny-databas...'

# 2. Återställ.
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$TARGET_URL" backups/roots-prod-<tidsstämpel>.dump

# 3. Verifiera INNAN du pekar om appen (se checklistan nedan).

# 4. Byt DATABASE_URL i Railway → API-servicen → Variables. Redeploy.

# 5. Kontrollera /readyz och kör synthetic.
curl -fsS https://api.roots.se/readyz
node scripts/synthetic.mjs
```

### Verifieringschecklista efter restore

Kör mot den återställda databasen, inte mot produktion.

**Steg 1 — finns raderna?**

```bash
psql "$TARGET_URL" -c "select count(*) from users;"
psql "$TARGET_URL" -c "select count(*) from customer_orders;"
psql "$TARGET_URL" -c "select max(created_at) from customer_orders;"
psql "$TARGET_URL" -c "select count(*) from campaigns where status = 'ACTIVE';"
```

- Stämmer antalen mot vad du förväntar dig från dashboarden före incidenten?
- Är `max(created_at)` rimlig, det vill säga hur mycket data förlorade vi?
  **Skriv ner det talet.** Det är vad vi måste berätta för föreningarna.

**Steg 2 — stämmer schemat?**

```bash
psql "$TARGET_URL" -tAc "select count(*) from information_schema.tables where table_schema='public';"
psql "$TARGET_URL" -tAc "select count(*) from pg_indexes where schemaname='public';"
psql "$TARGET_URL" -tAc "select count(*) from drizzle.__drizzle_migrations;"
```

Jämför mot produktion. Skiljer sig migrationsräknaren kommer dumpen från en
annan schemaversion än koden som ska köras mot den.

**Steg 3 — fungerar applikationen?**

Det här steget är det som faktiskt bevisar något. En databas där raderna finns
men appen inte kan logga in är inte en återställning, och det syns inte i en
radräkning.

```bash
# Starta ett API mot den återställda databasen, på en egen port.
cd apps/api && DATABASE_URL="$TARGET_URL" PORT=3021 pnpm dev

# I ett annat fönster:
node scripts/verify-restore.mjs
```

Skriptet loggar in, läser laget, hämtar en orderdetalj med rader, räknar om
försäljningen och slår mot en publik butik. Det verifierar alltså att
lösenordshashar, främmande nycklar, orderrader och prisuppslag alla följde med.

Sätt `RESTORE_TEST_EMAIL`, `RESTORE_TEST_PASSWORD` och
`RESTORE_TEST_SHOP_SLUG` när du kör mot annat än demo-data.

### Om bara enstaka tabeller behöver tillbaka

```bash
pg_restore --data-only --table=customer_orders \
  --dbname "$TARGET_URL" backups/roots-prod-<tidsstämpel>.dump
```

Var försiktig: `--data-only` respekterar inte främmande nycklar i
godtycklig ordning. Vid tveksamhet, återställ allt till en ny databas och
kopiera över raderna med en `insert ... select` via `postgres_fdw` eller en
manuell export.

## Kvartalsvis återställningsövning

Sätt en påminnelse. Övningen tar tjugo minuter och är det enda som skiljer
en backup från en förhoppning.

1. Ta en färsk dump enligt ovan.
2. Återställ till en tillfällig Railway-databas eller lokal Postgres.
3. Kör verifieringschecklistans tre steg — inklusive steg 3, som är det enda
   som bevisar att applikationen kan använda databasen.
4. Kör `pnpm --filter @roots/db db:migrate` mot den återställda databasen och
   bekräfta att den är i samma schemaversion som produktion. Den ska svara att
   migrationerna redan är applicerade, inte köra några nya.
5. Radera testdatabasen och dumpen.
6. Anteckna datum och utfall längst ner i det här dokumentet.

## Vad vi INTE har än

Ärligt redovisat så att ingen tror att skyddet är starkare än det är:

- **Ingen point-in-time recovery.** Förlorar vi databasen klockan 16 och
  senaste snapshot är från natten, är dagens ordrar borta. Åtgärd om vi vill
  ha bättre RPO: uppgradera Railway-planen eller sätt upp kontinuerlig
  WAL-arkivering till S3.
- **Ingen automatiserad off-site-dump.** `scripts/db-backup.sh` körs
  manuellt. Ett schemalagt jobb som lägger krypterade dumpar i S3 är nästa
  steg.
- **Inget larm om att backupen slutat fungera.** Ett tyst misslyckande i
  snapshot-jobbet upptäcks först när vi behöver det. Övervakningen larmar på
  jobb som tystnat (se [monitoring.md](./monitoring.md)), men off-site-dumpen
  är inte ett schemalagt jobb än, så den täcks inte.
- **Övningen är inte gjord mot Railway.** Den är gjord mot lokal Postgres med
  demo-data, vilket verifierar rutinen och skripten men inte
  Railway-specifika steg: att skapa en ny Postgres, byta `DATABASE_URL` och
  göra en redeploy. Det återstår och bör göras före lansering.

## Genomförda övningar

### 2026-08-03 — första övningen, lokal Postgres

Hela rutinen körd från dump till verifierad applikation. Utfall: **godkänt.**

| Steg | Resultat |
| --- | --- |
| Dump med `scripts/db-backup.sh` | 114 kB, 30 tabeller med data, läsbar med `pg_restore --list` |
| Återställning till ny tom databas | `pg_restore --clean --if-exists --no-owner --no-privileges`, exit 0, inga fel |
| Radantal källa mot återställd | Identiska: 32 användare, 13 ordrar, 10 orderrader, 7 organisationer, 5 kampanjer, 10 produkter |
| Schemaobjekt | Identiska: 29 tabeller, 109 index, 52 främmande nycklar |
| Migrationsversion | 19 migrationer i båda; `db:migrate` mot den återställda körde inga nya |
| Applikationen mot återställd databas | API startade, `/readyz` 200 |
| `scripts/verify-restore.mjs` | 8/8 — inloggning, session, lag, 7 ordrar, 3 307 kr försäljning omräknad, orderrader, avräkningsunderlag, publik butik med 10 produkter |

Tidsåtgång: cirka tio minuter, varav merparten var att starta API:t.

Två saker som kom fram och åtgärdades under övningen:

- Verifieringen saknade ett steg som faktiskt startade applikationen. Radantal
  visar att data finns, inte att appen kan använda den. Steg 3 och
  `scripts/verify-restore.mjs` tillkom därför.
- Schemajämförelsen fanns inte alls. En dump från en annan schemaversion än
  koden går att återställa men ger en app som inte startar, så steg 2 tillkom.

Kvar att öva: samma rutin mot Railway, inklusive att peka om `DATABASE_URL`
och göra en redeploy.
