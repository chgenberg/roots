import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Heart,
  Home,
  Link2,
  Package,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Store,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { HowItWorksFlow } from "@/i18n/dictionaries/how-it-works";
import { howItWorks } from "@/i18n/dictionaries/how-it-works";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Labels = (typeof howItWorks)["sv"]["flowLabels"];

const PANEL =
  "relative overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#F7F3EA_0%,#EFE8DD_55%,#DDD2C6_100%)] p-6 sm:p-8";

const NODE =
  "flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-white/85 px-3.5 py-2.5 text-sm font-medium shadow-[0_1px_2px_rgb(94_83_65/0.06)]";

function IconDot({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        filled ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-700"
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

function Down() {
  return <span className="mx-auto block h-6 w-px bg-brand-600/60" aria-hidden />;
}

/** Linjer som delar sig från en punkt överst till `count` punkter nederst. */
function Branch({ count, className }: { count: number; className?: string }) {
  const xs = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * 100);
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className={cn("h-10 w-full text-brand-600/70", className)}
      aria-hidden
    >
      {xs.map((x) => (
        <path
          key={x}
          d={`M50 0 C50 22, ${x} 18, ${x} 40`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function PlanFlow({ l }: { l: Labels }) {
  return (
    <div className="mx-auto max-w-sm">
      <div className={cn(NODE, "flex-col items-start")}>
        <span className="flex items-center gap-2.5">
          <IconDot filled>
            <Target className="h-4 w-4" />
          </IconDot>
          {l.goal}
        </span>
        <span className="flex flex-wrap gap-1.5 pl-10">
          {l.goalExamples.map((g) => (
            <span key={g} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs">
              {g}
            </span>
          ))}
        </span>
      </div>
      <Branch count={2} />
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(NODE, "flex-col items-start")}>
          <span className="flex items-center gap-2">
            <IconDot>
              <CalendarDays className="h-4 w-4" />
            </IconDot>
            {l.period}
          </span>
          <span className="relative mt-1 block h-1.5 w-full rounded-full bg-brand-100" aria-hidden>
            <span className="absolute inset-y-0 left-[12%] right-[22%] rounded-full bg-brand-700/70" />
          </span>
        </div>
        <div className={cn(NODE, "flex-col items-start")}>
          <span className="flex items-center gap-2">
            <IconDot>
              <UserRound className="h-4 w-4" />
            </IconDot>
            {l.contact}
          </span>
          <span className="mt-1 flex -space-x-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-4 w-4 rounded-full border border-white bg-brand-300" />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function ShopsFlow({ l }: { l: Labels }) {
  return (
    <div className="mx-auto max-w-md">
      <div className={cn(NODE, "mx-auto w-fit")}>
        <IconDot filled>
          <Users className="h-4 w-4" />
        </IconDot>
        {l.club}
      </div>
      <Branch count={3} />
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className={cn(NODE, "flex-col gap-2 px-2.5 text-center sm:px-3")}>
            <IconDot>
              <Store className="h-4 w-4" />
            </IconDot>
            <span className="text-xs sm:text-sm">
              {l.seller} {n}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px]">
              <Link2 className="h-3 w-3 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{l.link}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareFlow({ l }: { l: Labels }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="mx-auto flex w-fit flex-col items-center rounded-[1.6rem] border-[5px] border-brand-800/80 bg-white px-4 pb-4 pt-3 shadow-sm">
        <span className="mb-3 h-1 w-8 rounded-full bg-brand-200" aria-hidden />
        <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-brand-700 px-3 py-2 text-xs font-medium text-white">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          roots.nu/s/…
        </span>
      </div>
      <Branch count={4} />
      <div className="grid grid-cols-4 gap-2">
        {l.audiences.map((a) => (
          <span key={a} className="rounded-full border border-brand-200 bg-white/85 px-1 py-1.5 text-center text-[11px] font-medium sm:text-xs">
            {a}
          </span>
        ))}
      </div>
      <Down />
      <div className={cn(NODE, "mx-auto w-fit")}>
        <IconDot filled>
          <CreditCard className="h-4 w-4" />
        </IconDot>
        {l.pays}
      </div>
    </div>
  );
}

function DeliveryFlow({ l }: { l: Labels }) {
  return (
    <div className="mx-auto max-w-md">
      <div className={cn(NODE, "mx-auto w-fit")}>
        <IconDot filled>
          <ShoppingBag className="h-4 w-4" />
        </IconDot>
        {l.order}
      </div>
      <Branch count={2} />
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(NODE, "flex-col items-start")}>
          <span className="flex items-center gap-2">
            <IconDot>
              <Package className="h-4 w-4" />
            </IconDot>
            {l.collected}
          </span>
          <span className="flex gap-1.5" aria-hidden>
            {[l.teamA, l.teamB, l.teamC].map((t) => (
              <span key={t} className="rounded-md border border-brand-300 bg-brand-50 px-1.5 py-1 text-[10px] font-semibold">
                {t}
              </span>
            ))}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{l.collectedSub}</span>
        </div>
        <div className={cn(NODE, "flex-col items-start")}>
          <span className="flex items-center gap-2">
            <IconDot>
              <Home className="h-4 w-4" />
            </IconDot>
            {l.home}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{l.homeSub}</span>
        </div>
      </div>
    </div>
  );
}

function ResultFlow({ l }: { l: Labels }) {
  const rows = [
    { team: l.teamA, w: "82%" },
    { team: l.teamB, w: "58%" },
    { team: l.teamC, w: "70%" },
  ];
  return (
    <div className="mx-auto max-w-sm">
      <div className={cn(NODE, "flex-col items-stretch gap-3")}>
        <span className="flex items-center gap-2">
          <IconDot>
            <Users className="h-4 w-4" />
          </IconDot>
          {l.report}
        </span>
        {rows.map((r) => (
          <span key={r.team} className="flex items-center gap-2 text-xs" aria-hidden>
            <span className="w-8 font-semibold">{r.team}</span>
            <span className="h-2 flex-1 rounded-full bg-brand-100">
              <span className="block h-full rounded-full bg-brand-700/75" style={{ width: r.w }} />
            </span>
          </span>
        ))}
      </div>
      <Down />
      <div className={cn(NODE, "mx-auto w-fit")}>
        <IconDot filled>
          <Wallet className="h-4 w-4" />
        </IconDot>
        {l.payout} · 35 %
      </div>
    </div>
  );
}

function RepeatFlow({ l }: { l: Labels }) {
  const nodes = [
    { label: l.daily, icon: <Repeat className="h-4 w-4" /> },
    { label: l.refill, icon: <ShoppingBag className="h-4 w-4" /> },
    { label: l.support, icon: <Heart className="h-4 w-4" /> },
  ];
  return (
    <div className="mx-auto max-w-md">
      <ol className="grid grid-cols-3 items-start gap-2 sm:gap-3">
        {nodes.map((n, i) => (
          <li key={n.label} className="relative">
            <div className={cn(NODE, "flex-col gap-2 px-2 text-center text-xs sm:text-sm")}>
              <IconDot filled={i === 2}>{n.icon}</IconDot>
              {n.label}
            </div>
            {i < nodes.length - 1 && (
              <ArrowRight
                className="absolute -right-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-600 sm:-right-3"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
      <svg viewBox="0 0 300 48" preserveAspectRatio="none" className="mt-1 h-12 w-full text-brand-600/70" aria-hidden>
        <path
          d="M250 2 C250 40, 50 40, 50 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M44 14 L50 4 L56 14" fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-brand-700">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        {l.between}
      </p>
    </div>
  );
}

const FLOWS: Record<HowItWorksFlow, (props: { l: Labels }) => ReactNode> = {
  plan: PlanFlow,
  shops: ShopsFlow,
  share: ShareFlow,
  delivery: DeliveryFlow,
  result: ResultFlow,
  repeat: RepeatFlow,
};

export function HowItWorksFlowImage({ flow, locale }: { flow: HowItWorksFlow; locale: Locale }) {
  const Flow = FLOWS[flow];
  return (
    <div className={PANEL} role="img" aria-label={howItWorks[locale].stripShort[flow]}>
      <Flow l={howItWorks[locale].flowLabels} />
    </div>
  );
}

/** Alla sex steg på en rad (lodrätt på mobil), med länk till respektive steg. */
export function HowItWorksStrip({ locale }: { locale: Locale }) {
  const t = howItWorks[locale];
  return (
    <nav aria-label={t.stripLabel}>
      <ol className="relative grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
        <span className="absolute left-[8.33%] right-[8.33%] top-5 hidden h-px bg-brand-300 lg:block" aria-hidden />
        {t.steps.map((step, i) => (
          <li key={step.flow} className="relative">
            <a
              href={`#steg-${i + 1}`}
              className="group flex items-center gap-3 rounded-2xl p-1 lg:flex-col lg:gap-2 lg:text-center"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-background text-sm font-semibold transition-colors group-hover:border-brand-700 group-hover:bg-brand-700 group-hover:text-white">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{t.stripShort[step.flow]}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
