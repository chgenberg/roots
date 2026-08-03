# Övervakning och larm

## Vad som övervakas, och av vem

Det finns två sorters problem, och de kräver olika saker.

**Problem som plattformen kan upptäcka själv.** Databasen slutar svara, Redis
går ner, ett schemalagt jobb tystnar. En cron-endpoint kontrollerar detta var
femte minut och mejlar när något inte stämmer.

**Problem som plattformen inte kan upptäcka själv.** Hela API:et ligger nere,
eller Railway-instansen är borta. En process kan inte larma om att den själv
inte kör. Det kräver en extern uppetidsvakt, och den måste sättas upp separat
— se nedan. **Utan den steget är övervakningen ofullständig.**

## Kom igång

### 1. Sätt mottagare för larm

```bash
ALERT_EMAIL=drift@rootsnordic.se
```

Saknas den loggas larmen som fel och går till Sentry, men ingen blir väckt.

> **Läget i produktion just nu (kontrollerat 2026-08-03): larmen når ingen.**
> `ALERT_EMAIL` är osatt, `SENTRY_DSN` är osatt, och `FEATURE_EMAIL_DISABLED=true`
> byter in mock-avsändaren — så alla mail returnerar `success=true` och
> försvinner. Övervakningen nedan fungerar och loggar rätt, den kommer bara
> inte fram till en människa. Ofarligt bakom lanseringsspärren, men det första
> som måste lösas innan spärren tas ner. Medvetet uppskjutet, inte förbisett.
>
> Att sätta `ALERT_EMAIL` räcker inte så länge `FEATURE_EMAIL_DISABLED=true`
> ligger kvar: avsändaren är mock oavsett mottagare. Vill man ha larm utan att
> slå på all övrig mail är `SENTRY_DSN` den snabbare vägen.

### 2. Schemalägg kontrollen

Var femte minut, med `INTERNAL_CRON_TOKEN` som bearer-token:

```
POST /v1/internal/cron/monitoring-check
Authorization: Bearer $INTERNAL_CRON_TOKEN
```

På Railway läggs den som ett cron-schema (`*/5 * * * *`). Kontrollen är billig:
en `select 1`, en Redis-ping och två nyckelläsningar.

### 3. Sätt upp en extern uppetidsvakt

Det här är steget som fångar "sajten är nere". Peka en extern tjänst
(Better Stack, Healthchecks.io, UptimeRobot — vilken som helst som kan larma
via SMS eller telefon) på:

```
GET /readyz
```

`/readyz` är publik och svarar 503 när databasen eller Redis inte svarar. Den
är avsiktligt magrare än den interna statusen: den läcker inga jobbnamn eller
tidsstämplar.

Rekommenderad inställning: kontroll varje minut från minst två regioner,
larm efter två misslyckade kontroller i rad. Ett enstaka misslyckande är
oftast nätverket mellan vakten och Railway, inte oss.

## Sökvägar

| Sökväg | Åtkomst | Vad den svarar på |
| --- | --- | --- |
| `GET /healthz` | Publik | Svarar processen alls? Rör inte databasen, så en instabil databas inte startar om containern i onödan. |
| `GET /readyz` | Publik | Ska den här instansen ta trafik? Pingar databas och Redis. 503 när något är nere. **Peka uppetidsvakten hit.** |
| `GET /v1/internal/cron/status` | Bearer-token | Allt ovan plus varje jobbs senaste körning. För felsökning. |
| `POST /v1/internal/cron/monitoring-check` | Bearer-token | Kontrollerar och larmar. Schemaläggs var femte minut. |

## Jobb som övervakas

Jobben ligger i `MONITORED_JOBS` i `apps/api/src/lib/monitoring/heartbeat.ts`.
Varje jobb registrerar sin senaste **lyckade** körning; larmet går när
tystnaden passerat intervall plus tolerans.

| Jobb | Intervall | Tolerans | Vad som går sönder om det tystnar |
| --- | --- | --- | --- |
| `deletion-purge` | 24 h | 12 h | Vi behåller personuppgifter som någon bett oss radera. |
| `lead-retention` | 24 h | 12 h | Vi sparar håranalys-leads längre än vi sagt att vi gör. |

Ett jobb som aldrig rapporterat räknas som tystnat. Det är oftast en cron som
inte konfigurerats efter en miljöflytt, vilket är precis vad vi vill se.

### Lägga till ett jobb

Två steg, och båda behövs:

1. Lägg till en post i `MONITORED_JOBS` med intervall, tolerans och en
   beskrivning av konsekvensen. Beskrivningen hamnar i larmet, så skriv den för
   någon som blir väckt 03:00 och inte vet vad jobbet gör.
2. Anropa `recordJobRun("<namn>")` **efter** att arbetet är gjort. Anropar du
   före mäter du att cron triggade, inte att något blev utfört.

## Larm

Larmen går till både e-post och Sentry. E-post för att någon ska agera, Sentry
för att larmet ska hamna i samma tidslinje som felen — annars går det inte att
se i efterhand att databasen låg nere strax före de tvåhundra 500-svaren.

**Samma larm skickas inte igen inom fyra timmar.** En femminuterscron skulle
annars skicka 288 mejl per dygn för ett pågående avbrott, och då slutar
mottagaren läsa dem — vilket gör att nästa riktiga larm också missas.

Spärren rensas när problemet försvinner, så ett avbrott som återkommer larmar
direkt istället för att tystas av en gammal spärr.

## När ett larm kommer

**"Databasen svarar inte"** — kontrollera Railways statussida och databasens
mätvärden. Inga ordrar kan tas emot och ingen kan logga in medan detta pågår.
Vid dataförlust, se [backup-restore.md](./backup-restore.md).

**"Redis svarar inte"** — sessioner, rate-limits och köer ligger där. Ingen kan
logga in. Betalningsflödet fungerar inte heller, eftersom avräkningens lås
kräver Redis och felar stängt.

**"Jobbet ... har tystnat"** — kontrollera först att cron-schemat finns och att
`INTERNAL_CRON_TOKEN` stämmer i båda ändar. Trigga sedan jobbet manuellt och se
svaret:

```bash
curl -X POST -H "Authorization: Bearer $INTERNAL_CRON_TOKEN" \
  https://api.rootsnordic.se/v1/internal/cron/lead-retention
```

Svarar det `{"ok":true,...}` var problemet schemaläggningen. Svarar det 403 är
endpointen inte undantagen från CSRF-kontrollen i `app.ts` — det gäller varje ny
cron-endpoint och undantagen är exakta, inte prefixbaserade.

## Vad som ännu inte övervakas

Ärlig lista, så ingen tror att täckningen är bredare än den är:

- **Betalflödets hälsa.** Vi larmar inte på att ordrar fastnar i `PENDING`, för
  Klarna-integrationen inte är i drift än. När den är det bör en kontroll larma
  på ordrar som legat kvar i `PENDING` mer än en timme.
- **Kösvans och jobbfel.** Vi ser att ett jobb tystnat, inte att det kör men
  felar varje gång. Fel hamnar i Sentry, men utan ett tak som larmar.
- **Svarstider och felkvot.** Sentry visar fel, inte att svarstiden tredubblats.
- **Certifikat och domän.** Railway sköter förnyelsen, men vi kontrollerar den
  inte själva.
