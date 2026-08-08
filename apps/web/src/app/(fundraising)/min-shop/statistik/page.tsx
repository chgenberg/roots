"use client";

import { StatsDashboard } from "@/components/charts/stats-dashboard";
import { useLocale } from "@/i18n/locale-context";
import { fundraisingPages } from "@/i18n/dictionaries/fundraising-pages";

export default function SellerStatistikPage() {
  const { locale } = useLocale();
  const t = fundraisingPages.stats[locale];
  const c = fundraisingPages.common[locale];

  return (
    <StatsDashboard
      path="/v1/dashboard/seller/stats"
      title={c.statistics}
      subtitle={t.sellerSubtitle}
      breakdownTitle={t.sellerBreakdown}
      breakdownUnit="units"
    />
  );
}
