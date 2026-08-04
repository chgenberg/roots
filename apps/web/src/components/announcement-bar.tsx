import { cn } from "@/lib/utils";

// Bandet är det första besökaren läser och står på varje sida, så varje
// löfte måste gälla utan förbehåll. Källan till respektive rad:
//
//   35 %      LOCKED_MARGIN_PERCENT i packages/contracts/src/calculator.ts
//   sulfater  hero.tsx och social-proof.tsx
//   Norden    "utvecklat i Norden" i layout.tsx och om-oss. Sajten säger
//             ingenting om var produkterna tillverkas — skriv inte det här.
//   avgifter  /hjalp: "Roots tar inga uppstartsavgifter"
//   intäkter  /om-oss: affärsmodellen kanaliserar intäkter tillbaka
//
// Fri frakt hör inte hit: gränsen sätts per kampanj via
// campaign.shippingThresholdOre, så någon global 500-kronorsregel finns
// inte. Den utfästelsen står kvar på /foreningsliv och i villkoren, där
// den redan är flaggad för granskning.
const MESSAGES = [
  "Föreningen behåller 35 % av försäljningen",
  "Utan sulfater, silikoner och parabener",
  "Utvecklat i Norden",
  "Inga uppstartsavgifter för föreningen",
  "Intäkterna går tillbaka till föreningslivet",
];

function MessageRun({ hidden }: { hidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center"
      // Kopia två finns bara för att loopen ska se sömlös ut. Utan
      // aria-hidden läser skärmläsaren varje löfte två gånger.
      aria-hidden={hidden || undefined}
    >
      {MESSAGES.map((message) => (
        <li key={message} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap px-6 text-[11px] uppercase tracking-[0.14em] text-brand-900/70 dark:text-foreground/70">
            {message}
          </span>
          <span aria-hidden className="text-[7px] text-brand-900/30 dark:text-foreground/30">
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        // Ingen kant nedåt: bandet är exakt 36 px och headerns spacer
        // räknar med det, så en extra pixel skulle knuffa allt innehåll.
        // Bakgrunden räcker för att bandet ska läsas som en egen remsa.
        "overflow-hidden bg-brand-100/80 backdrop-blur-xl dark:bg-background/80",
        // Vid reducerad rörelse står bandet still, och då är listan
        // bredare än skärmen på mobil. Låt den swipas istället för att
        // klippa bort de sista löftena.
        "motion-reduce:overflow-x-auto",
        className
      )}
    >
      <div
        role="region"
        aria-label="Aktuellt från Roots"
        className="flex h-9 w-max animate-marquee items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
      >
        <MessageRun />
        <MessageRun hidden />
      </div>
    </div>
  );
}
