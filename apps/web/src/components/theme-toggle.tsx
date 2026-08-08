"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";

const STORAGE_KEY = "roots-theme";

export function ThemeToggle() {
  const { locale } = useLocale();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Klassen är redan satt av skriptet i app/layout.tsx, så här läser vi
    // bara av den. Att sätta den igen skulle göra växeln till enda platsen
    // temat gäller, vilket var buggen: portalen har ingen marketing-header.
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  if (!mounted) return <div className="h-10 w-10" aria-hidden="true" />;

  return (
    <button
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-brand-50 hover:text-foreground"
      aria-label={
        dark
          ? locale === "en"
            ? "Switch to light mode"
            : "Byt till ljust läge"
          : locale === "en"
            ? "Switch to dark mode"
            : "Byt till mörkt läge"
      }
    >
      {dark ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
