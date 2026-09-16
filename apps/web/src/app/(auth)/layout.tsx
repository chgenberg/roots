import type { ReactNode } from "react";
import { GateRoom } from "@/components/gate-room";
import { LocaleProvider } from "@/i18n/locale-context";
import { getRequestLocale } from "@/i18n/request-locale";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <LocaleProvider key={locale} locale={locale}>
      <GateRoom frameClassName="max-w-lg">
        <main id="main-content" className="animate-fade-in">
          {children}
        </main>
      </GateRoom>
    </LocaleProvider>
  );
}
