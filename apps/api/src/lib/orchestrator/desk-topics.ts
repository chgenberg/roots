export const REPLY_SHAPE =
  "Svara i 2–4 korta stycken med en tom rad mellan. En sak per stycke. Inte en enda klump. Frågorna läggs i questions, inte som en numrerad vägg i reply.";

export type DeskTopic =
  | "pengar"
  | "mejl"
  | "order"
  | "forening"
  | "drift"
  | "open";

export function topicFor(
  text: string,
  desk?: { key?: string; name?: string }
): DeskTopic {
  const lower = `${text} ${desk?.key ?? ""} ${desk?.name ?? ""}`.toLowerCase();
  if (/fortnox|bokför|utbetal|avräkn|pengar/.test(lower)) return "pengar";
  if (/mejl|mail|inbjud|kvitto/.test(lower) && !/order/.test(lower)) return "mejl";
  if (/order|kassa|stripe|beställ/.test(lower)) return "order";
  if (/förening|lag|säljare|kampanj|lead/.test(lower)) return "forening";
  if (/grind|heartbeat|jobb|drift|preview/.test(lower)) return "drift";
  if (desk?.key === "pengar") return "pengar";
  if (desk?.key === "mejl") return "mejl";
  if (desk?.key === "orderliv") return "order";
  if (desk?.key === "forening") return "forening";
  if (desk?.key === "drift") return "drift";
  return "open";
}

export function topicQuestions(topic: DeskTopic): string[] {
  switch (topic) {
    case "pengar":
      return [
        "Vilken händelse — avräkning redo eller utbetalning väntar?",
        "Ska jag bara öppna ett kort, eller lägga ett Fortnox-utkast?",
        "Vem trycker PAID och skriver bankreferensen?",
      ];
    case "mejl":
      return [
        "Vilken mall — inbjudan, kvitto eller påminnelse?",
        "Till vem, och hur ofta ska jag kika?",
        "Vem godkänner innan något lämnar huset? Mejlpausen lyfter jag inte.",
      ];
    case "order":
      return [
        "Vilken händelse — ny order, betald eller misslyckad?",
        "Kort eller mejlutkast?",
        "Vem godkänner om det rör pengar?",
      ];
    case "forening":
      return [
        "Gäller det granskning, inbjudan, kalkyl-lead eller kampanj?",
        "Vad ska första leveransen vara?",
        "Vem godkänner föreningen innan shoppen öppnar?",
      ];
    case "drift":
      return [
        "Vad ska jag vakta — grind, tysta jobb eller mejlpaus?",
        "Öppna kort räcker oftast. Deploy kör jag aldrig.",
      ];
    default:
      return [
        "Vad ska göras, konkret — första leveransen?",
        "När och hur ofta?",
        "Vem godkänner innan något går ut?",
      ];
  }
}

export function formatIntake(
  name: string,
  text: string,
  desk?: { key?: string; name?: string }
): string {
  const qs = topicQuestions(topicFor(text, desk));
  return `Jag är ${name}. Jag hör “${text.trim().slice(0, 80)}”.\n\n${qs.join("\n\n")}`;
}
