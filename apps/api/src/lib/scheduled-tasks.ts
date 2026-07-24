import { registerScheduledTask } from "./scheduler";
import { purgeDueDeletions } from "./deletion-purge";
import { auditLog } from "./audit";

/**
 * Alla periodiska jobb samlade på ett ställe.
 *
 * Registreringen är separerad från `scheduler.ts` så att schemaläggaren kan
 * testas utan att dra in databasen, och så att det finns en enda fil att läsa
 * för att svara på "vad kör vi automatiskt?".
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
}
