"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "roots-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Systemets prefers-color-scheme läses avsiktligt inte: med "Auto" på
    // macOS och iOS slår den om vid solnedgången, så besökare som aldrig bett
    // om mörkt läge fick sajten mörk på kvällen. Ljust är startläget, mörkt
    // kräver ett klick här.
    const stored = localStorage.getItem(STORAGE_KEY) === "dark";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
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
      aria-label={dark ? "Byt till ljust läge" : "Byt till mörkt läge"}
    >
      {dark ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
