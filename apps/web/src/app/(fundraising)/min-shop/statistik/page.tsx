"use client";

import { StatsDashboard } from "@/components/charts/stats-dashboard";

export default function SellerStatistikPage() {
  return (
    <StatsDashboard
      path="/v1/dashboard/seller/stats"
      title="Min statistik"
      subtitle="Se hur din försäljning utvecklas och vilka produkter som går bäst."
      breakdownTitle="Dina produkter"
      breakdownUnit="units"
    />
  );
}
