import { ChevronRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            {isLast || !item.href ? (
              <span className="text-muted-foreground">{item.label}</span>
            ) : (
              <LocaleLink
                href={item.href}
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {item.label}
              </LocaleLink>
            )}
          </span>
        );
      })}
    </nav>
  );
}
