import { runHeartbeat } from "../lib/orchestrator/heartbeat";

async function main() {
  const r = await runHeartbeat();
  process.stdout.write(
    [
      `ok=${r.ok}`,
      `summary=${r.summary}`,
      `findings=${r.findings}`,
      `opened=${r.opened.join(",")}`,
      `resolved=${r.resolved.join(",")}`,
    ].join(" ") + "\n"
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : "heartbeat failed");
    process.exit(1);
  });
