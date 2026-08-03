"use client";

import { useEffect, useRef } from "react";

/**
 * Escape, fokuslås och scroll-lås för paneler som täcker sidan.
 *
 * Vi har fem sådana paneler som byggts för hand istället för med Radix
 * Dialog: mobilmenyn i marketing-headern, portalens sidebar, fundraising-
 * navigationen, aviseringsklockan och chattwidgeten. Var och en hade sin
 * egen delmängd av rätt beteende — en hanterade Escape men inte fokus, en
 * annan låste scroll men inte Escape, en tredje gjorde ingenting.
 *
 * För någon som navigerar med tangentbord är skillnaden konkret: när menyn
 * öppnas ligger fokus kvar i bakgrunden, så Tab vandrar genom länkar som
 * ligger under en mörkläggning och inte går att se. Det finns ingen väg
 * tillbaka utan mus.
 *
 * Hooken samlar de tre sakerna på ett ställe:
 *
 *   1. Escape stänger.
 *   2. Fokus flyttas in i panelen när den öppnas, cyklar inom den med Tab,
 *      och återlämnas till knappen som öppnade den när den stängs.
 *   3. Bakgrunden slutar scrolla.
 *
 * Använd Radix Dialog för nya paneler — den gör allt det här. Hooken finns
 * för de fem som redan är byggda och som fungerar bra i övrigt.
 */
export function useFocusTrap(
  open: boolean,
  onClose: () => void,
  options: { lockScroll?: boolean } = {}
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const { lockScroll = true } = options;

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    // Elementet som hade fokus innan panelen öppnades. Att lämna tillbaka
    // fokus dit är skillnaden mellan att kunna stänga en meny och fortsätta
    // där man var, och att kastas till sidans början.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusableIn(el: HTMLElement): HTMLElement[] {
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        // offsetParent === null fångar element som är dolda med display:none
        // eller ligger i en kollapsad del av panelen.
      ).filter((node) => node.offsetParent !== null);
    }

    if (container) {
      const first = focusableIn(container)[0];
      // Panelen kan vara tom vid första renderingen; då tar vi behållaren
      // själv så att fokus i alla fall inte ligger kvar i bakgrunden.
      (first ?? container).focus?.();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const focusable = focusableIn(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Cykla i stället för att låta fokus lämna panelen. Utan det här
      // hamnar Tab i innehållet bakom mörkläggningen.
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = lockScroll ? document.body.style.overflow : null;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow ?? "";
      // Bara om fokus fortfarande ligger i panelen. Har användaren klickat
      // en länk och navigerat vidare ska vi inte rycka fokus tillbaka.
      if (
        previouslyFocused?.isConnected &&
        (!container || container.contains(document.activeElement))
      ) {
        previouslyFocused.focus?.();
      }
    };
  }, [open, onClose, lockScroll]);

  return containerRef;
}
