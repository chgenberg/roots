/**
 * Verifierar att applikationen fungerar mot en ÅTERSTÄLLD databas.
 *
 * Poängen är inte att raderna finns — det visar en count(*). Poängen är att
 * appen kan logga in, läsa och räkna ur den återställda datan. En backup som
 * ger en databas applikationen inte kan använda är inte en backup, och det
 * går inte att se med en radräkning.
 *
 * Körs som sista steget i den kvartalsvisa återställningsövningen. Hela
 * rutinen står i docs/runbooks/backup-restore.md; starta ett API mot den
 * återställda databasen och peka RESTORE_API_URL hit.
 */
const API = process.env.RESTORE_API_URL ?? "http://localhost:3021";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function req(path, body) {
  const headers = {};
  const cookies = cookieHeader();
  if (cookies) headers.cookie = cookies;

  if (body) {
    const csrf = await fetch(`${API}/v1/csrf-token`, {
      headers: cookies ? { cookie: cookies } : {},
    });
    absorb(csrf);
    headers["x-csrf-token"] = (await csrf.json()).token;
    headers["content-type"] = "application/json";
    headers.cookie = cookieHeader();
  }

  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  absorb(res);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* tomt svar */
  }
  return { status: res.status, ok: res.ok, data };
}

const checks = [];
const check = (name, ok, note = "") => {
  checks.push({ name, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${note ? ` — ${note}` : ""}`);
};

const login = await req("/v1/auth/login", {
  email: process.env.RESTORE_TEST_EMAIL ?? "lag@demo-if.se",
  password: process.env.RESTORE_TEST_PASSWORD ?? "Demo1234!",
});
check(
  "lösenordshashen i den återställda databasen validerar",
  login.ok,
  `status ${login.status}`
);

const me = await req("/v1/auth/me");
check("sessionen bär", me.ok && !!me.data?.user?.email, me.data?.user?.email ?? `status ${me.status}`);

const myTeam = await req("/v1/dashboard/my-team");
const teamId = myTeam.data?.team?.id ?? myTeam.data?.teamId ?? myTeam.data?.id;
check("laget går att läsa", myTeam.ok && !!teamId, teamId ? `lag ${teamId.slice(0, 8)}` : JSON.stringify(myTeam.data).slice(0, 120));

if (teamId) {
  const team = await req(`/v1/dashboard/team/${teamId}`);
  const orders = team.data?.orders ?? [];
  check("ordrarna finns kvar", team.ok && orders.length > 0, `${orders.length} ordrar`);
  check(
    "pengarna räknas fram ur återställd data",
    (team.data?.stats?.totalSalesOre ?? 0) > 0,
    `${((team.data?.stats?.totalSalesOre ?? 0) / 100).toFixed(2)} kr i försäljning`
  );
  // Orderraderna ligger i detaljen, inte i listan. De är det som gör en order
  // meningsfull — en order utan rader vet inte vad som såldes.
  const detail = await req(`/v1/dashboard/seller/orders/${orders[0].id}`);
  const lines = detail.data?.lines ?? detail.data?.order?.lines ?? [];
  check(
    "orderraderna följde med",
    detail.ok && lines.length > 0,
    `${lines.length} rader på första ordern`
  );
  check(
    "avräkningen kan räknas om",
    typeof team.data?.stats?.unverifiedManualOre === "number"
  );
}

const shop = await req(
  `/v1/shop/by-slug/${process.env.RESTORE_TEST_SHOP_SLUG ?? "demo-noah"}`
);
check(
  "den publika butiken svarar med produkter",
  shop.ok && (shop.data?.products?.length ?? 0) > 0,
  `status ${shop.status}, ${shop.data?.products?.length ?? 0} produkter`
);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} kontroller gick igenom.`);
if (failed.length) process.exit(1);
