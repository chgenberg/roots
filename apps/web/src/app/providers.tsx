"use client";

import { ToastProvider } from "@/components/ui/toast";
import { installGlobalErrorReporting } from "@/lib/report-error";
import { useEffect, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Error boundaries fångar bara fel under render. Ett kastat fel i en
  // händelsehanterare eller ett obehandlat promise — den vanligaste sorten
  // i praktiken — når aldrig en boundary. Lyssnarna här är det som gör att
  // vi ser dem.
  useEffect(() => installGlobalErrorReporting(), []);

  return <ToastProvider>{children}</ToastProvider>;
}
