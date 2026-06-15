"use client";

import { useEffect, useState } from "react";
import { getBrowserApiBase } from "@/lib/api-base";
import { StatsDashboard } from "@/components/charts/stats-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = getBrowserApiBase();

export default function LagStatistikPage() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/v1/dashboard/my-team`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.teamId) setTeamId(data.teamId);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (resolving) {
    return (
      <div className="page-enter space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistik</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="page-enter space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistik</h1>
        </div>
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Du behöver vara kopplad till ett lag för att se statistik.
        </p>
      </div>
    );
  }

  return (
    <StatsDashboard
      path={`/v1/dashboard/team/${teamId}/stats`}
      title="Lagets statistik"
      subtitle="Följ lagets försäljning, säljartopplista och trender."
      breakdownTitle="Topplista — säljare"
      breakdownUnit="orders"
    />
  );
}
