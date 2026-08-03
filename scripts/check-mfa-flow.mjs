/**
 * Verifierar tvåfaktorsflödet hela vägen mot en riktig databas.
 *
 * Skriptet skapar ett eget INTERNAL_ADMIN-konto (inte demokontot, som är
 * undantaget från kravet) och går igenom:
 *
 *   1. Utan registrerad app är portalen låst — API:et svarar 403 med
 *      mfaEnrollmentRequired, men /me och registreringsflödet släpps igenom
 *      så att användaren har en väg ut.
 *   2. Registrering: lösenord → hemlighet → kod → reservkoder.
 *   3. Inloggning kräver koden, och sessionen skapas inte av lösenordet
 *      ensamt.
 *   4. En reservkod fungerar, och bara en gång.
 *   5. Efter registreringen är portalen öppen igen.
 *
 * Kör med servrarna uppe:
 *   source /tmp/roots-ui.env
 *   node scripts/check-mfa-flow.mjs
 */

import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";
const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL saknas — source /tmp/roots-ui.env först.");
  process.exit(1);
}

/**
 * Databasfrågor går via psql och TOTP räknas ut med node:crypto, så
 * skriptet inte behöver några paket. `otpauth` och `postgres` finns bara i
 * apps/api/node_modules, och pnpm löser importer från filens katalog uppåt
 * — ett skript i scripts/ hittar dem alltså inte.
 */
function query(sqlText) {
  return execFileSync("psql", [DB, "-tAF", "|", "-c", sqlText], {
    encoding: "utf8",
  }).trim();
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const EMAIL = `mfa-test-${randomUUID().slice(0, 8)}@roots-test.local`;
const PASSWORD = "MfaTest-lösenord-1234";

/** Egen liten klient som håller reda på cookies och CSRF, som en browser. */
function makeClient() {
  let cookie = "";
  let csrf = null;

  async function ensureCsrf() {
    if (csrf) return csrf;
    const res = await fetch(`${API}/v1/csrf-token`);
    csrf = (await res.json()).token;
    return csrf;
  }

  return {
    get cookie() {
      return cookie;
    },
    async request(path, { method = "GET", body } = {}) {
      const headers = { "content-type": "application/json" };
      if (cookie) headers.cookie = cookie;
      if (method !== "GET") headers["x-csrf-token"] = await ensureCsrf();

      const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const match = setCookie.match(/rootsSessionId=([^;]+)/);
        if (match) cookie = `rootsSessionId=${match[1]}`;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        /* tom body */
      }
      return { status: res.status, ok: res.ok, data };
    },
  };
}

/** base32 (RFC 4648) till bytes — så vi kan räkna ut koden själva. */
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** TOTP enligt RFC 6238 — samma parametrar som apps/api/src/lib/mfa.ts. */
function codeFor(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

async function main() {
  // Kontot skapas via registreringsflödet så lösenordshashen blir rätt, och
  // uppgraderas sedan till INTERNAL_ADMIN — rollen som kräver tvåfaktor.
  const bootstrap = makeClient();
  const reg = await bootstrap.request("/v1/auth/register/association", {
    method: "POST",
    body: {
      orgName: `MFA-test ${randomUUID().slice(0, 6)}`,
      email: EMAIL,
      password: PASSWORD,
      contactName: "MFA Testare",
    },
  });
  if (!reg.ok) {
    console.error("kunde inte skapa testkonto:", reg.status, reg.data);
    process.exit(1);
  }

  query(`UPDATE users SET role = 'INTERNAL_ADMIN' WHERE email = '${EMAIL}'`);
  // Sessionssyncen cachar rollen i 30 sekunder per process, så en ny
  // inloggning behövs för att den nya rollen ska gälla.

  console.log("\n1. Utan registrerad app:");
  // Sessionen härifrån sparas: den skapades med bara lösenordet, under
  // fönstret innan tvåfaktorn aktiverades. Den ska vara död efteråt, se steg 2.
  let preEnrollClient = null;
  {
    const c = makeClient();
    preEnrollClient = c;
    const login = await c.request("/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    check(
      "inloggning lyckas men flaggar att registrering krävs",
      login.ok && login.data?.mfaEnrollmentRequired === true,
      `mfaEnrollmentRequired: ${login.data?.mfaEnrollmentRequired}`
    );

    // Cachen i sessionssyncen kan hålla gamla värden i upp till 30 s.
    await new Promise((r) => setTimeout(r, 31_000));

    const me = await c.request("/v1/auth/me");
    check(
      "/me går igenom och berättar om kravet",
      me.ok && me.data?.user?.mfaEnrollmentRequired === true
    );

    const blocked = await c.request("/v1/admin/audit-log");
    check(
      "en känslig yta är stängd",
      blocked.status === 403 && blocked.data?.mfaEnrollmentRequired === true,
      `status ${blocked.status}`
    );
  }

  console.log("\n2. Registrering:");
  let secret = null;
  let backupCodes = [];
  {
    const c = makeClient();
    await c.request("/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });

    const badPassword = await c.request("/v1/auth/mfa/setup", {
      method: "POST",
      body: { password: "fel-lösenord" },
    });
    check(
      "fel lösenord ger ingen hemlighet",
      badPassword.status === 401,
      `status ${badPassword.status}`
    );

    const setup = await c.request("/v1/auth/mfa/setup", {
      method: "POST",
      body: { password: PASSWORD },
    });
    secret = setup.data?.secret ?? null;
    check("hemlighet och otpauth-URI returneras", !!secret && !!setup.data?.uri);

    const wrongCode = await c.request("/v1/auth/mfa/enable", {
      method: "POST",
      body: { code: "000000" },
    });
    check(
      "fel kod aktiverar inte",
      wrongCode.status === 401,
      `status ${wrongCode.status}`
    );

    const enable = await c.request("/v1/auth/mfa/enable", {
      method: "POST",
      body: { code: codeFor(secret) },
    });
    backupCodes = enable.data?.backupCodes ?? [];
    check("aktivering med rätt kod ger reservkoder", enable.ok && backupCodes.length === 8);

    // En kapad session plus lösenordet ska inte kunna byta ut hemligheten mot
    // angriparens egen app. Den vägen gjorde en tillfällig sessionsstöld till
    // varaktig kontroll: offrets authenticator slutade fungera medan
    // angriparen kunde svara på inloggningsutmaningen.
    const noCode = await c.request("/v1/auth/mfa/setup", {
      method: "POST",
      body: { password: PASSWORD },
    });
    check(
      "lösenordet räcker inte för att byta ut en aktiv app",
      noCode.status === 401 && !noCode.data?.secret,
      `status ${noCode.status}`
    );
    const wrongRebind = await c.request("/v1/auth/mfa/setup", {
      method: "POST",
      body: { password: PASSWORD, code: "000000" },
    });
    check(
      "fel kod räcker inte heller",
      wrongRebind.status === 401 && !wrongRebind.data?.secret,
      `status ${wrongRebind.status}`
    );
    const secretUnchanged =
      query(`SELECT mfa_secret FROM users WHERE email = '${EMAIL}'`) === secret;
    check("hemligheten i databasen är oförändrad", secretUnchanged);

    // Sessioner som fanns före aktiveringen ska inte ärva full åtkomst i
    // samma sekund som den riktiga användaren blir klar.
    //
    // `/me` svarar 200 med `user: null` för den som inte är inloggad — webben
    // använder den för att avgöra inloggningsläge — så det är kroppen som
    // avgör, inte statuskoden. Den känsliga ytan kontrolleras också, eftersom
    // det är den åtkomsten som var problemet.
    const stale = await preEnrollClient.request("/v1/auth/me");
    const staleAdmin = await preEnrollClient.request("/v1/admin/audit-log");
    check(
      "sessionen från tiden före aktiveringen är återkallad",
      stale.data?.user === null && staleAdmin.status === 401,
      `/me user: ${JSON.stringify(stale.data?.user)}, admin: ${staleAdmin.status}`
    );

    const row = query(
      `SELECT mfa_enabled_at, mfa_backup_codes FROM users WHERE email = '${EMAIL}'`
    );
    const [enabledAt, storedCodes] = row.split("|");
    check("aktiveringen är sparad", !!enabledAt);
    check(
      "reservkoderna lagras inte i klartext",
      !!storedCodes && !backupCodes.some((code) => storedCodes.includes(code))
    );
  }

  console.log("\n3. Inloggning kräver koden:");
  // Sessionen härifrån återanvänds i steg 5. Att logga in en gång till där
  // skulle vara det sjätte inlogget på samma konto och slå i loginRateLimit
  // (5 per 15 min), vilket ser ut som ett fel i koden men är rate-limiten
  // som gör sitt jobb.
  let verifiedClient = null;
  {
    const c = makeClient();
    const login = await c.request("/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    check(
      "lösenordet ger en utmaning, inte en session",
      login.data?.mfaRequired === true && !!login.data?.challenge
    );
    check("ingen sessionscookie sattes", c.cookie === "");

    const challenge = login.data.challenge;

    const wrong = await c.request("/v1/auth/login/mfa", {
      method: "POST",
      body: { challenge, code: "000000" },
    });
    check("fel kod nekas", wrong.status === 401, `status ${wrong.status}`);

    const right = await c.request("/v1/auth/login/mfa", {
      method: "POST",
      body: { challenge, code: codeFor(secret) },
    });
    check("rätt kod ger en session", right.ok && !!c.cookie);
    if (right.ok) verifiedClient = c;
  }

  console.log("\n4. Reservkoder:");
  {
    const c = makeClient();
    const login = await c.request("/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    const used = backupCodes[0];
    const first = await c.request("/v1/auth/login/mfa", {
      method: "POST",
      body: { challenge: login.data.challenge, code: used },
    });
    check("en reservkod fungerar", first.ok);

    const c2 = makeClient();
    const login2 = await c2.request("/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    check(
      "antalet kvarvarande koder minskade",
      login2.data?.backupCodesRemaining === 7,
      `kvar: ${login2.data?.backupCodesRemaining}`
    );

    const replay = await c2.request("/v1/auth/login/mfa", {
      method: "POST",
      body: { challenge: login2.data.challenge, code: used },
    });
    check(
      "samma reservkod fungerar inte igen",
      replay.status === 401,
      `status ${replay.status}`
    );
  }

  console.log("\n5. Efter registrering är portalen öppen:");
  if (!verifiedClient) {
    check("den känsliga ytan svarar igen", false, "ingen verifierad session");
  } else {
    // Vänta ut sessionssyncens cache (30 s) så mfaPending räknas om mot
    // det nya mfa_enabled_at.
    await new Promise((r) => setTimeout(r, 31_000));
    const audit = await verifiedClient.request("/v1/admin/audit-log");
    check("den känsliga ytan svarar igen", audit.ok, `status ${audit.status}`);
  }

  console.log("\n6. Byta till en ny app:");
  // Den sessionen som redan är verifierad används, så vi inte slår i
  // inloggnings-rate-limiten (5 per 15 min och e-post).
  if (!verifiedClient) {
    check("bytet går att genomföra", false, "ingen verifierad session");
  } else {
    const rebind = await verifiedClient.request("/v1/auth/mfa/setup", {
      method: "POST",
      body: { password: PASSWORD, code: codeFor(secret) },
    });
    const newSecret = rebind.data?.secret ?? null;
    check(
      "lösenord plus giltig kod ger en ny hemlighet",
      rebind.ok && !!newSecret && newSecret !== secret,
      `status ${rebind.status}`
    );

    const [enabledAt, storedCodes] = query(
      `SELECT mfa_enabled_at, mfa_backup_codes FROM users WHERE email = '${EMAIL}'`
    ).split("|");
    check(
      "aktiveringen är nollställd tills den nya appen bekräftats",
      !enabledAt,
      `mfa_enabled_at: ${enabledAt}`
    );
    check(
      "reservkoderna för den gamla appen är borta",
      !storedCodes,
      `kvar: ${storedCodes}`
    );

    const oldCode = await verifiedClient.request("/v1/auth/mfa/enable", {
      method: "POST",
      body: { code: codeFor(secret) },
    });
    check(
      "den gamla appens kod aktiverar inte den nya hemligheten",
      oldCode.status === 401,
      `status ${oldCode.status}`
    );

    const done = await verifiedClient.request("/v1/auth/mfa/enable", {
      method: "POST",
      body: { code: codeFor(newSecret) },
    });
    check(
      "den nya appen aktiveras och ger nya reservkoder",
      done.ok && done.data?.backupCodes?.length === 8
    );
  }

  // Städa upp efter oss.
  const orgId = query(`SELECT org_id FROM users WHERE email = '${EMAIL}'`);
  query(`DELETE FROM users WHERE email = '${EMAIL}'`);
  if (orgId) query(`DELETE FROM organizations WHERE id = '${orgId}'`);

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} kontroller gick igenom.`
  );
  if (failed.length) {
    console.log("\nMisslyckade:");
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
