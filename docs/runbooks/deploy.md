# Deploy runbook

> MASTERPLAN_01 KC8.6 — checklist innan varje produktionsdeploy.
> Gör det till en regel att **en annan utvecklare signerar av** punkt 1–6 innan release.

## 1. Branch / commits

- [ ] `main` är grön i CI (typecheck, lint, tests).
- [ ] Inga `// TODO: revert` eller `// debug` kvar i diffen (`git diff origin/main`).
- [ ] Inga nya `console.log` — endast `childLogger("domain")`-pattern.
- [ ] Inga hemligheter i diffen (`gitleaks` om vi har det, annars `git diff -G "(SECRET|API_KEY|TOKEN)="`).

## 2. Schema / migrations

- [ ] Om en ny `packages/db/drizzle/*.sql` finns: kan migrationen rollback:as?
  Backward-compatible kolumner (nullable / `DEFAULT`) är OK att deploya
  ensamma. Drop column / NOT NULL on existing data → kräver två deploys:
  först "add column nullable + dual-write", sedan "make NOT NULL".
- [ ] `pnpm --filter @roots/db generate` är redan committad om schema ändrats.

## 3. Env-variabler

- [ ] **Kör förhandskontrollen mot produktionsvariablerna.** Boot-kontrollen
  avslutar processen på varje konflikt, så en felkonfiguration som inte fångas
  här visar sig som en omstartsloop i produktion i stället:

  ```bash
  railway variables --service api --kv > /tmp/prod.env   # eller kopiera från UI
  pnpm --filter @roots/api env:check /tmp/prod.env
  rm /tmp/prod.env
  ```

  Skriptet skriver bara variabelnamn och vad som är fel, aldrig värden. Det
  fångar bland annat för korta hemligheter (< 32 tecken), två hemligheter med
  samma värde, `CORS_ORIGIN` som inte innehåller `NEXT_PUBLIC_SITE_URL`, och
  `ROOTS_ENABLE_DEMO_ACCOUNTS=true` utan lösenord. De kontrollerna är nyare än
  miljön, så en uppsättning som fungerat länge kan falla på dem första gången.
- [ ] Nya env-vars (om någon) tillagda i Railway/Vercel **innan** koden mergs.
- [ ] `apps/api/src/lib/validate-env.ts` uppdaterad så boot failar tydligt
  om de saknas i prod (MASTERPLAN_01 KC8.1).
- [ ] Roterade hemligheter (`KLARNA_*`, `RESEND_*`, `SESSION_SECRET`):
  uppdatera vault, deploya, verifiera `/portal/system` ok, **sedan**
  revokera gamla nyckeln.

## 4. Tredjepartsberoenden

- [ ] Klarna staging-flow testat (skapa order → bekräfta → webhook landar).
- [ ] Fortnox-mock eller riktigt staging-konto har svarat (om `FORTNOX_ENABLED=true`).
- [ ] Resend domän-status fortfarande "verified".

## 5. Synthetic baseline

- [ ] Kör `node scripts/synthetic.mjs` mot **staging** — alla 9 checks PASS.
  Sätt `SYNTHETIC_SHOP_SLUG` till en riktig säljarslug, annars hoppar
  katalogkontrollen över prisvalideringen och godkänner ett 404.
- [ ] Snapshotta nuvarande versionsnummer (`git rev-parse HEAD`) — behövs vid rollback.

## 6. Sign-off

- [ ] En annan utvecklare har gått igenom punkt 1–5.
- [ ] Slack-tråd i `#deploy` med kort diff-summary + risk-bedömning.

---

## Under deploy

Adresserna i produktion (Railway-projektet `Roots`, miljö `production`):

| Vad | Tjänst | Adress |
| --- | --- | --- |
| Webben | `web` | `https://roots.nu` |
| API:t | `roots` | `https://roots-production-f6b3.up.railway.app` |

API:t har ingen egen domän. Webben proxar `/api/v1/*` vidare, men bara det —
`/healthz` och `/readyz` finns inte den vägen, så health-checkar och synthetic
måste gå mot Railway-adressen ovan. Runbooken pekade tidigare på
`api.roots.se`, som aldrig existerat; kontrollerna såg då ut att vara röda i
produktion när de i själva verket frågade fel värd.

1. Trigga deploy. Railway bygger automatiskt på push till `main` — en
   variabeländring räknas också som en deploy.
2. Vänta tills health-check är grön:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://roots-production-f6b3.up.railway.app/readyz
   ```
   Failar uppstarten (t.ex. på env-validering) behåller Railway den gamla
   versionen och deployen markeras FAILED. Produktionen ligger alltså inte
   nere — men webben kan hinna rulla ut mot ett äldre API, så kontrollera
   båda tjänsterna: `railway deployment list --service roots`.
3. Kör synthetic mot prod:
   ```bash
   API_BASE=https://roots-production-f6b3.up.railway.app \
     WEB_BASE=https://roots.nu node scripts/synthetic.mjs
   ```
   Katalogkontrollen hoppas över om inte `SYNTHETIC_SHOP_SLUG` sätts till en
   butik som ska finnas. Sätt den när shopen är live, annars kontrollerar vi
   ingenting där.
4. Öppna `/portal/system` och verifiera att inga services är "Nere".
5. Postera "deploy OK + sha=<short>" i `#deploy`.

---

## Om något går fel

Följ **`docs/runbooks/rollback.md`**. Mål: tillbaka på senast kända fungerande
state inom **5 minuter** från första error-larmet.
