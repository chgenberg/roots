"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Mail, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  text: string;
  subject: string;
  label: string;
  labels: { whatsapp: string; email: string; copyLink: string; copied: string };
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  /** Öppna menyn uppåt när knappen ligger i en ruta som klipper innehållet. */
  placement?: "bottom" | "top";
};

/**
 * En knapp som öppnar telefonens delningsmeny (Web Share API) och annars
 * visar WhatsApp, e-post och kopiera länk. Inget skickas av Roots själv.
 */
export function ShareActions({
  url,
  text,
  subject,
  label,
  labels,
  disabled,
  className,
  buttonClassName,
  placement = "bottom",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onShare() {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: subject, text, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  const message = `${text} ${url}`;
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[#5E5341] transition-colors hover:bg-[#F3EEE6] focus-visible:bg-[#F3EEE6] focus-visible:outline-none";

  return (
    <div ref={wrapRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={onShare}
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-[#6D614D] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5E5341] disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName
        )}
      >
        <Send className="h-4 w-4" aria-hidden />
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 z-30 w-60 rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(94,83,65,0.45)] ring-1 ring-[#E6DED2]",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {labels.whatsapp}
          </a>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <Mail className="h-4 w-4" aria-hidden />
            {labels.email}
          </a>
          <button type="button" role="menuitem" onClick={onCopy} className={itemClass}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {copied ? labels.copied : labels.copyLink}
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? labels.copied : ""}
      </span>
    </div>
  );
}
