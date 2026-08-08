"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { HAIR_ANALYSIS_ENABLED } from "@/lib/feature-flags";
import {
  Search,
  FileText,
  Package,
  ArrowRight,
  Command,
} from "lucide-react";

interface SearchItem {
  label: string;
  href: string;
  category: "pages" | "products" | "quick";
}

const ITEMS: SearchItem[] = [
  { label: "Hem", href: "/", category: "pages" },
  { label: "Produkter", href: "/produkter", category: "pages" },
  { label: "Föreningsliv", href: "/foreningsliv", category: "pages" },
  { label: "Guider", href: "/guider", category: "pages" },
  { label: "Så fungerar det", href: "/sa-fungerar-det", category: "pages" },
  { label: "Hjälp", href: "/hjalp", category: "pages" },
  { label: "Om oss", href: "/om-oss", category: "pages" },
  { label: "Kontakt", href: "/kontakt", category: "pages" },
  ...(HAIR_ANALYSIS_ENABLED
    ? ([{ label: "Håranalys", href: "/haranalys", category: "pages" }] as SearchItem[])
    : []),
  { label: "Integritetspolicy", href: "/integritet", category: "pages" },
  { label: "Köpvillkor", href: "/villkor", category: "pages" },
  { label: "Vad är föreningsförsäljning", href: "/guider/foreningsforsaljning", category: "pages" },
  { label: "Så fungerar Roots", href: "/guider/sa-fungerar-roots", category: "pages" },
  { label: "Hur mycket tjänar föreningen", href: "/guider/hur-mycket-tjanar-foreningen", category: "pages" },
  { label: "Personlig shop och QR", href: "/guider/personlig-shop", category: "pages" },
  { label: "Tips till säljare", href: "/guider/tips-till-saljare", category: "pages" },
  { label: "Godisförsäljning vs Roots", href: "/guider/jamfor-godisforsaljning", category: "pages" },
  { label: "Roots för fotbollslag", href: "/guider/for-fotbollslag", category: "pages" },
  { label: "Roots för ishockeylag", href: "/guider/for-ishockeylag", category: "pages" },
  { label: "SyriCalm", href: "/guider/syricalm", category: "pages" },
  { label: "MultiMoist", href: "/guider/multimoist", category: "pages" },
  { label: "Hårbotten i balans", href: "/guider/harbotten", category: "pages" },
  { label: "Naturlig hårvård i Norden", href: "/guider/naturlig-harvard-norden", category: "pages" },
  { label: "Sulfatsnålt schampo", href: "/guider/sulfatsnalt-schampo", category: "pages" },
  { label: "Rutin efter träning", href: "/guider/rutin-efter-traning", category: "pages" },
  { label: "Roots Schampoo", href: "/produkter/shampoo", category: "products" },
  { label: "Roots Conditioner", href: "/produkter/conditioner", category: "products" },
  { label: "Roots Body Wash", href: "/produkter/body-wash", category: "products" },
  { label: "Roots Komplett paket", href: "/produkter/paket", category: "products" },
  { label: "Logga in", href: "/login", category: "quick" },
  ...(HAIR_ANALYSIS_ENABLED
    ? ([{ label: "Starta håranalys", href: "/haranalys", category: "quick" }] as SearchItem[])
    : []),
];

const CATEGORY_META: Record<SearchItem["category"], { label: string; icon: typeof FileText }> = {
  pages: { label: "Sidor", icon: FileText },
  products: { label: "Produkter", icon: Package },
  quick: { label: "Snabblänkar", icon: ArrowRight },
};

export function useSearchOpen() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("roots:open-search"))}
      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Sök"
    >
      <Search className="h-[18px] w-[18px]" />
    </button>
  );
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpenSearch() { setOpen(true); }
    window.addEventListener("roots:open-search", onOpenSearch);
    return () => window.removeEventListener("roots:open-search", onOpenSearch);
  }, []);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return ITEMS;
    const q = query.toLowerCase();
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<SearchItem["category"], SearchItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

  const flatList = filtered;

  const navigate = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
    } else if (e.key === "Enter" && flatList[activeIndex]) {
      e.preventDefault();
      navigate(flatList[activeIndex]);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        {/* P3.64 (audit 2026-05-26): Radix kräver DialogTitle för
            skärmläsare. Vi visar inte titeln visuellt (har sökfält
            med aria-label) men lägger den i VisuallyHidden. */}
        <VisuallyHiddenPrimitive.Root>
          <DialogTitle>Sök på Roots</DialogTitle>
          <DialogDescription>
            Sök bland sidor, produkter och hjälpartiklar.
          </DialogDescription>
        </VisuallyHiddenPrimitive.Root>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sök sidor, produkter..."
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Sök"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
          {flatList.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Inga resultat för &ldquo;{query}&rdquo;
            </p>
          )}

          {(["pages", "products", "quick"] as const).map((cat) => {
            const items = grouped.get(cat);
            if (!items?.length) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="mb-1">
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {meta.label}
                </p>
                {items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.href + item.label}
                      data-index={idx}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-brand-50 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      <meta.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isActive && (
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
