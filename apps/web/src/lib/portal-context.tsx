"use client";

import { createContext, useContext } from "react";

export interface PortalUser {
  email: string;
  role: string;
  name: string;
  orgName: string;
  /**
   * Rollen kräver tvåfaktor men ingen app är registrerad. API:et svarar 403
   * på allt utom /me och registreringsflödet, så utan den här flaggan hade
   * portalen sett trasig ut istället för att visa vägen framåt.
   */
  mfaEnrollmentRequired?: boolean;
}

const PortalUserContext = createContext<PortalUser | null>(null);

export function PortalUserProvider({
  user,
  children,
}: {
  user: PortalUser;
  children: React.ReactNode;
}) {
  return (
    <PortalUserContext.Provider value={user}>
      {children}
    </PortalUserContext.Provider>
  );
}

export function usePortalUser(): PortalUser {
  const ctx = useContext(PortalUserContext);
  if (!ctx) {
    throw new Error("usePortalUser must be used inside PortalUserProvider");
  }
  return ctx;
}
