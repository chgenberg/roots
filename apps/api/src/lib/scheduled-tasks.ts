import { registerScheduledTask } from "./scheduler";
import { purgeDueDeletions } from "./deletion-purge";
import { purgeExpiredHairAnalysisLeads } from "./lead-retention";
import { recordJobRun } from "./monitoring/heartbeat";
import { runMonitoringCheck } from "./monitoring/alerts";
import { auditLog } from "./audit";
import { runHeartbeat } from "./orchestrator/heartbeat";

/**
 * Alla periodiska jobb samlade på ett ställe.
 *
 * Registreringen är separerad från `scheduler.ts` så att schemaläggaren kan
 * testas utan att dra in databasen, och så att det finns en enda fil att läsa
 * för att svara på "vad kör vi automatiskt?".
 *
 * Varje jobb registrerar också ett hjärtslag efter en lyckad körning. Det är
 * så vi upptäcker att ett jobb tystnat — se `monitoring/heartbeat.ts`.
 */
export function registerScheduledTasks(): void {
  // GDPR art. 17. Användare som begärt radering får en ångerfrist; när
  // `scheduledDeletionAt` passerats ska deras personuppgifter anonymiseras.
  // Var 6:e timme ger god marginal — funktionen tar 100 rader per körning.
  registerScheduledTask({
    name: "deletion-purge",
    intervalMs: 6 * 60 * 60 * 1000,
    run: async () => {
      const result = await purgeDueDeletions();
      await recordJobRun("deletion-purge", {
        trigger: "scheduler",
        purged: result.purged,
      });
      // Samma audit-rad som den manuella cron-endpointen skriver, så att
      // "när kördes purge senast?" går att besvara ur audit_logs oavsett
      // vilken väg körningen kom. Till skillnad från request-vägarna väntar vi
      // in skrivningen: här finns ingen svarstid att skydda, och raden är
      // beviset för att raderingen faktiskt skedde.
      await auditLog({
        userId: null,
        action: "cron.deletion_purge",
        meta: { trigger: "scheduler", ...result },
      });
      return result;
    },
  });

  // Lagringstid för håranalys-leads. Endpointen har funnits, men var inte
  // schemalagd någonstans — alltså kördes den aldrig, och leads låg kvar långt
  // efter den lagringstid vi lovat. Exakt samma fel som en gång gjorde att
  // GDPR-raderingen inte blev av, vilket är anledningen till att den här
  // schemaläggaren finns och inte kräver någon konfiguration.
  registerScheduledTask({
    name: "lead-retention",
    intervalMs: 24 * 60 * 60 * 1000,
    run: async () => {
      const result = await purgeExpiredHairAnalysisLeads();
      await recordJobRun("lead-retention", {
        trigger: "scheduler",
        deleted: result.deleted,
      });
      await auditLog({
        userId: null,
        action: "cron.lead_retention",
        meta: { trigger: "scheduler", ...result },
      });
      return result;
    },
  });

  // Driftkontrollen körs i processen så att larmen fungerar utan att någon
  // först måste sätta upp extern cron. Två saker den här vägen inte kan
  // upptäcka, och som därför kräver en extern uppetidsvakt mot /readyz:
  //
  //   1. Att API-processen inte kör. En process kan inte larma om sig själv.
  //   2. Att Redis ligger nere — schemaläggaren tar sin slot via Redis, så
  //      utan Redis körs kontrollen inte alls. Schemaläggaren larmar dock
  //      själv till Sentry efter tio tickar utan svar.
  //
  // Se docs/runbooks/monitoring.md.
  registerScheduledTask({
    name: "monitoring-check",
    intervalMs: 5 * 60 * 1000,
    run: () => runMonitoringCheck(),
  });

  // Agentens puls. Öppnar larmkort, löser villkor som försvunnit, kör
  // bara Hands med grind none. Aldrig deploy, utbetalning eller mejlpaus.
  registerScheduledTask({
    name: "orchestrator-heartbeat",
    intervalMs: 15 * 60 * 1000,
    run: async () => {
      const result = await runHeartbeat();
      if (result.ok) {
        await recordJobRun("orchestrator-heartbeat", {
          trigger: "scheduler",
          findings: result.findings,
          summary: result.summary,
        });
      }
      return result;
    },
  });
}
