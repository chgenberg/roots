"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/locale-link";
import type { ClubLogo } from "@/content/clubs";
import { morphToClub } from "@/lib/view-transition";
import { cn } from "@/lib/utils";

const SPEED_PX_PER_S = 28;
const RESUME_AFTER_MS = 2500;
// Tre identiska uppsättningar: vi står i den mittersta och hoppar en hel
// uppsättning när vi närmar oss en kant, så loopen syns aldrig.
const COPIES = 3;

type Props = {
  clubs: ClubLogo[];
  listLabel: string;
  nextTitle: string;
  nextCta: string;
  prevLabel: string;
  nextLabel: string;
  readMore: string;
};

export function ClubCarousel({
  clubs,
  listLabel,
  nextTitle,
  nextCta,
  prevLabel,
  nextLabel,
  readMore,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const pos = useRef(0);
  const hovering = useRef(false);
  const dragging = useRef(false);
  const resumeAt = useRef(0);
  const dragStart = useRef({ x: 0, left: 0, moved: false });
  const router = useRouter();

  const setWidth = useCallback(() => {
    const set = setRef.current;
    if (!set) return 0;
    const gap = parseFloat(getComputedStyle(set.parentElement!).columnGap || "0");
    return set.offsetWidth + gap;
  }, []);

  const wrap = useCallback(() => {
    const el = trackRef.current;
    const w = setWidth();
    if (!el || !w) return;
    // pos is a float accumulator; browsers round scrollLeft, so never copy
    // scrollLeft back into it here or the sub-pixel auto-scroll stalls.
    if (el.scrollLeft < w * 0.5) {
      el.scrollLeft += w;
      pos.current += w;
    } else if (el.scrollLeft > w * 1.5) {
      el.scrollLeft -= w;
      pos.current -= w;
    }
  }, [setWidth]);

  const holdFor = (ms = RESUME_AFTER_MS) => {
    resumeAt.current = performance.now() + ms;
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = setWidth();
    pos.current = el.scrollLeft;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const paused =
        reduced || hovering.current || dragging.current || now < resumeAt.current || document.hidden;
      if (!paused) {
        if (Math.abs(el.scrollLeft - pos.current) > 2) pos.current = el.scrollLeft;
        pos.current += SPEED_PX_PER_S * dt;
        el.scrollLeft = pos.current;
        wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => wrap();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [setWidth, wrap]);

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    const card = setRef.current?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    holdFor(RESUME_AFTER_MS + 600);
    wrap();
    const gap = parseFloat(getComputedStyle(setRef.current!).columnGap || "0");
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current.moved = false;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - dragStart.current.x;
    if (Math.abs(dx) > 4 && !dragStart.current.moved) {
      dragStart.current.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (dragStart.current.moved) {
      el.scrollLeft = dragStart.current.left - dx;
      wrap();
      dragStart.current.left = el.scrollLeft + dx;
    }
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    holdFor();
  };

  const renderSet = (copy: number) => (
    <ul
      key={copy}
      ref={copy === 0 ? setRef : undefined}
      aria-label={copy === 0 ? listLabel : undefined}
      aria-hidden={copy === 0 ? undefined : true}
      className="flex shrink-0 gap-5"
    >
      {clubs.map((club) => (
        <li key={club.slug} className="shrink-0">
          <LocaleLink
            href={`/klubbar/${club.slug}`}
            tabIndex={copy === 0 ? undefined : -1}
            draggable={false}
            onClick={(e) => {
              if (dragStart.current.moved) {
                e.preventDefault();
                return;
              }
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              if (morphToClub(e.currentTarget, club.slug, (href) => router.push(href))) e.preventDefault();
            }}
            className="group/card flex h-48 w-60 select-none flex-col items-center justify-center rounded-3xl bg-white px-6 shadow-[0_1px_2px_rgba(94,83,65,0.06),0_8px_24px_-12px_rgba(94,83,65,0.18)] ring-1 ring-[#E6DED2] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(94,83,65,0.08),0_18px_40px_-16px_rgba(94,83,65,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
          >
            <div className="relative flex h-24 w-full items-center justify-center">
              <Image
                src={club.logo}
                alt=""
                width={club.width}
                height={club.height}
                draggable={false}
                data-morph-logo
                sizes="176px"
                className="h-auto max-h-24 w-auto max-w-[176px] object-contain transition-transform duration-500 ease-out group-hover/card:scale-105"
              />
            </div>
            <p className="mt-4 text-center text-sm font-semibold leading-tight text-[#5E5341]">{club.name}</p>
            <p className="relative mt-1 text-xs text-[#7F715B]">
              <span className="transition-opacity duration-200 group-hover/card:opacity-0">{club.town}</span>
              <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap font-medium text-[#6D614D] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
                {readMore}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </p>
          </LocaleLink>
        </li>
      ))}
      <li className="flex h-48 w-60 shrink-0 select-none flex-col items-center justify-center rounded-3xl border border-dashed border-[#B9AC97] px-6 text-center sm:w-64">
        <p className="text-base font-semibold text-[#5E5341]">{nextTitle}</p>
        <LocaleLink
          href="/intresseanmalan"
          tabIndex={copy === 0 ? undefined : -1}
          draggable={false}
          onClick={(e) => {
            if (dragStart.current.moved) e.preventDefault();
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {nextCta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LocaleLink>
      </li>
    </ul>
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => {
        hovering.current = false;
        endDrag();
      }}
      onFocusCapture={() => holdFor(60_000)}
      onBlurCapture={() => holdFor()}
    >
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={() => holdFor(60_000)}
        onTouchEnd={() => holdFor()}
        onWheel={() => holdFor()}
        onScroll={() => {
          if (!dragging.current) wrap();
        }}
        className={cn(
          "flex gap-5 overflow-x-auto py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "cursor-grab active:cursor-grabbing",
          "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        )}
      >
        {Array.from({ length: COPIES }, (_, i) => renderSet(i))}
      </div>

      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={prevLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8CDBE] bg-white/70 text-[#5E5341] transition-colors hover:border-[#6D614D] hover:bg-[#6D614D] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={nextLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8CDBE] bg-white/70 text-[#5E5341] transition-colors hover:border-[#6D614D] hover:bg-[#6D614D] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
