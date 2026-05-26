# Rollback runbook

> MASTERPLAN_01 KC8.6 — så här rullar vi tillbaka senaste deploy.
> Mål: < 5 minuter från första alert till "stable green".

## Steg

### 1. Bekräfta att rollback faktiskt behövs

- Är det ett env-/secret-fel? → `Railway → Variables → revert + redeploy`
  räcker, ingen kod-rollback behövs.
- Är det en migration som lägger på sig själv (idempotent)? → rollback
  av appen ÄR safe även om schemat har den nya kolumnen.
- Är det en migration som **droppar/renames** kolumner? → rollback
  kräver också `pnpm --filter @roots/db migrate:down` (om sådan finns)
  eller manuell schema-fix. STANNA OCH PINGA andre dev.

### 2. Identifiera "good" SHA

```bash
git log --oneline -10 origin/main
# leta efter senaste commit som är BEVISLIGT grön i prod
# (synthetic + #deploy-tråd som säger "deploy OK")
```

### 3. Revert

```bash
# Backup-plan: skapa en revert-commit istället för att force-pusha,
# så historiken är intakt och vi kan rulla framåt igen.
git fetch origin
git checkout main
git pull --ff-only
git revert <bad-sha>..HEAD --no-edit
git push origin main
```

### 4. Trigga ny deploy

- Railway: nya commit:en triggar auto-deploy.
- Vercel: samma.
- Vänta tills `/readyz` → 200.

### 5. Verifiera

```bash
node scripts/synthetic.mjs   # mot prod-base
```

- Öppna `/portal/system`. Inga "Nere".
- Posta i `#deploy`: "Rolled back to <sha>, services green @ HH:MM".

### 6. Postmortem

- Skriv kort root-cause i `docs/incidents/YYYY-MM-DD-<short>.md`.
- Lägg till en regressionstest om sympomet kan fångas i CI.
- Diskutera i nästa standup hur deploy-check missade det.

---

## Express-rollback (om revert inte räcker)

Om appen är på fire och nästa deploy tar > 5 min:

1. Railway/Vercel UI → "Promote previous deployment".
   Snabbaste vägen — inget Git behövs, men nästa deploy från `main`
   kan blanda in den dåliga koden igen, så följ direkt upp med en
   riktig `git revert` enligt ovan.
2. Om databasen är i ett halv-migrerat state, koppla in jour-utvecklaren
   omedelbart — försök INTE manuellt köra `psql` mot prod utan en backup.
