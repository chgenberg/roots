import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function FoundersSection() {
  const locale = await getRequestLocale();
  const { founders } = getHome(locale);

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          <div className="group relative aspect-[4/5] overflow-hidden rounded-xl shadow-[var(--shadow-card)] sm:aspect-[4/3]">
            <Image
              src="/personal/gruppbild.jpg"
              alt={founders.alt}
              fill
              className="object-cover object-[center_30%] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>

        <div className="max-w-lg">
          <Badge variant="secondary" className="mb-4">
            {founders.badge}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">{founders.title}</h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            {founders.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <div className="mt-8">
            <Button variant="outline" asChild>
              <LocaleLink href="/om-oss#teamet">
                {founders.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
