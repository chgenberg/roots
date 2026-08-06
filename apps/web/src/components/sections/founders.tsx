import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FoundersSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          <div className="group relative aspect-[4/5] overflow-hidden rounded-xl shadow-[var(--shadow-card)] sm:aspect-[4/3]">
            <Image
              src="/personal/gruppbild.jpg"
              alt="Roots teamet"
              fill
              className="object-cover object-[center_30%] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>

        <div className="max-w-lg">
          <Badge variant="secondary" className="mb-4">
            Teamet
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Byggt av grannar med samma mål
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Roots byggs av människor med bakgrund i föreningsliv, teknik och
              produkt. Vi delar samma dröm: att föreningslivet i Sverige ska
              blomstra.
            </p>
            <p>
              Naturlig hudvård kan bli en kraft som binder samman människor —
              från duschen till planen. Enkelt. Naturligt. Gemensamt.
            </p>
          </div>
          <div className="mt-8">
            <Button variant="outline" asChild>
              <Link href="/om-oss#teamet">
                Möt teamet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
