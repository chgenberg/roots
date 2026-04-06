import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export function FoundersSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-10 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
            <Image
              src="/images/p4.jpg"
              alt="Roots produkter — First Growth, Pure Root och Soft Rinse på stenpiedestaler"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="absolute -bottom-4 -right-4 rounded-xl border border-border bg-card px-5 py-4 text-card-foreground shadow-[var(--shadow-card)]">
            <p className="text-2xl font-bold">3</p>
            <p className="text-xs text-muted-foreground">Grundare över 1,95 m</p>
          </div>
        </div>

        <div className="max-w-lg">
          <Badge variant="secondary" className="mb-4">Vår historia</Badge>
          <h2 className="text-3xl font-bold tracking-tight">
            Tre män med ett mål
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Vi är tre grannar — alla över 1,95 m, med helt olika bakgrunder.
              En ingenjör, en idrottstränare, en företagare. Men vi delar samma
              dröm: att föreningslivet i Sverige ska blomstra.
            </p>
            <p>
              Roots är vår syn på hur enkel, naturlig hudvård kan bli en kraft som
              binder samman människor. Från duschen till planen — vi gör det
              enkelt.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
