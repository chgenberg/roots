"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyTextButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Utan clipboard-behörighet går texten fortfarande att markera och kopiera.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-300 bg-white/80 px-4 text-sm font-medium transition-colors hover:border-brand-700"
      aria-live="polite"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? copiedLabel : label}
    </button>
  );
}
