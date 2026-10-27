/* eslint-disable @next/next/no-img-element -- loggan kommer från API:t eller som data-URL, inte via next/image */
import { cn } from "@/lib/utils";
import { clubLogoSrc, type OrgBrand } from "@/lib/club-brand/theme";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[\p{L}\d]/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Föreningens logga, eller initialer i föreningens färg när loggan saknas. */
export function ClubMark({
  brand,
  name,
  src,
  onDark,
  className,
}: {
  brand?: OrgBrand | null;
  name: string;
  /** Förhandsvisning: data-URL i stället för sparad logga. */
  src?: string | null;
  onDark?: boolean;
  className?: string;
}) {
  const logo = src ?? clubLogoSrc(brand);
  const dark = onDark ?? brand?.logoOnDark ?? false;
  if (logo) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl p-1",
          dark ? "bg-[#1D1D1B]" : "bg-white ring-1 ring-black/5",
          className
        )}
      >
        <img src={logo} alt={name} className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "club-solid inline-flex shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
