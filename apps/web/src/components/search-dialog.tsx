"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  { label: "Om oss", href: "/om-oss", category: "pages" },
  { label: "Kontakt", href: "/kontakt", category: "pages" },
  { label: "Håranalys", href: "/haranalys", category: "pages" },
  { label: "Integritetspolicy", href: "/integritet", category: "pages" },
  { label: "Köpvillkor", href: "/villkor", category: "pages" },
  { label: "First Growth", href: "/produkter/shampoo", category: "products" },
  { label: "Pure Root", href: "/produkter/conditioner", category: "products" },
  { label: "Soft Rinse", href: "/produkter/body-wash", category: "products" },
  { label: "Logga in", href: "/login", category: "quick" },
  { label: "Starta håranalys", href: "/haranalys", category: "quick" },
];

const CATEGORY_META: Record<SearchItem["category"], { label: string; icon: typeof FileText }> = {
  pages: { label: "Sidor", icon: FileText },
  products: { label: "Produkter", icon: Package },
  quick: { label: "Snabblänkar", icon: ArrowRight },
};

export function SearchDialog() {
  const [open, setOpen] = useState(false);
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

  const flatList = useMemo(() => filtered, [filtered]);

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
