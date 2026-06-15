"use client";

import { StatsDashboard } from "@/components/charts/stats-dashboard";

export default function ForeningStatistikPage() {
  return (
    <StatsDashboard
      path="/v1/dashboard/association/stats"
      title="Statistik"
      subtitle="Följ föreningens försäljning, mål och trender i realtid."
      breakdownTitle="Topplista — lag"
      breakdownUnit="orders"
    />
  );
}
