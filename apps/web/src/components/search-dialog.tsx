"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
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
import { useLocale } from "@/i18n/locale-context";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";
import { errors } from "@/i18n/dictionaries/errors";
import { getGuides } from "@/lib/guides";
import { withLocale } from "@/i18n/paths";

interface SearchItem {
  label: string;
  href: string;
  category: "pages" | "products" | "quick";
  neutral?: boolean;
}

const CATEGORY_ICONS = {
  pages: FileText,
  products: Package,
  quick: ArrowRight,
} as const;

export function useSearchOpen() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

export function SearchTrigger() {
  const { locale } = useLocale();
  const aria = marketingUi[locale].search.aria;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("roots:open-search"))}
      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-brand-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={aria}
    >
      <Search className="h-[18px] w-[18px]" />
    </button>
  );
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const copy = marketingUi[locale].search;

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

  const items = useMemo<SearchItem[]>(() => {
    const base = copy.items
      .filter((item) => !("hair" in item && item.hair) || HAIR_ANALYSIS_ENABLED)
      .map((item) => ({
        label: item.label,
        href: item.href,
        category: item.category as SearchItem["category"],
        neutral: "neutral" in item ? !!item.neutral : false,
      }));
    const guides = getGuides(locale).map((g) => ({
      label: g.title,
      href: `/guider/${g.slug}`,
      category: "pages" as const,
    }));
    return [...base, ...guides];
  }, [copy.items, locale]);

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
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [query, items]);

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
      const href = item.neutral ? item.href : withLocale(item.href, locale);
      router.push(href);
    },
    [router, locale]
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
      <DialogContent hideClose className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:top-[20%]">
        {/* P3.64 (audit 2026-05-26): Radix kräver DialogTitle för
            skärmläsare. Vi visar inte titeln visuellt (har sökfält
            med aria-label) men lägger den i VisuallyHidden. */}
        <VisuallyHiddenPrimitive.Root>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.placeholder}</DialogDescription>
        </VisuallyHiddenPrimitive.Root>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={copy.placeholder}
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label={copy.aria}
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
          <DialogClose className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-brand-50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">{errors[locale].close}</span>
          </DialogClose>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
          {flatList.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {copy.empty} &ldquo;{query}&rdquo;
            </p>
          )}

          {(["pages", "products", "quick"] as const).map((cat) => {
            const catItems = grouped.get(cat);
            if (!catItems?.length) return null;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <div key={cat} className="mb-1">
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {copy.categories[cat]}
                </p>
                {catItems.map((item) => {
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
                      <Icon className="h-4 w-4 shrink-0" />
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
