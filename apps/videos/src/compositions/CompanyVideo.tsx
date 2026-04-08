import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "../components/IntroScene";
import { ProductCard } from "../components/ProductCard";
import { OutroScene } from "../components/OutroScene";
import { CounterAnimation } from "../components/CounterAnimation";
import { BRAND, COLORS } from "../components/BrandColors";
import { FONT_FAMILY } from "../components/useFont";

const ProductsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntry = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: COLORS.foreground,
          opacity: titleEntry,
        }}
      >
        Tre produkter. Inget mer.
      </div>
      <div style={{ display: "flex", gap: 32 }}>
        <ProductCard name="First Growth" type="Schampo" price="149 kr" delay={8} />
        <ProductCard name="Pure Root" type="Balsam" price="149 kr" delay={14} />
        <ProductCard name="Soft Rinse" type="Body Wash" price="129 kr" delay={20} />
      </div>
    </AbsoluteFill>
  );
};

const ModelScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const steps = [
    { label: "Förening registrerar", delay: 0 },
    { label: "Medlemmar säljer", delay: 10 },
    { label: "Kunder beställer", delay: 20 },
    { label: "Intäkt till föreningen", delay: 30 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND[50],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: COLORS.foreground,
          opacity: spring({ frame, fps, config: { damping: 200 } }),
        }}
      >
        Föreningsmodellen
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {steps.map((step, i) => {
          const entry = spring({
            frame,
            fps,
            delay: step.delay,
            config: { damping: 200 },
          });
          const arrowEntry = spring({
            frame,
            fps,
            delay: step.delay + 5,
            config: { damping: 200 },
          });

          return (
            <React.Fragment key={step.label}>
              <div
                style={{
                  width: 220,
                  padding: "28px 20px",
                  borderRadius: 16,
                  backgroundColor: COLORS.white,
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.foreground,
                  opacity: entry,
                  transform: `scale(${entry})`,
                  boxShadow: "0 2px 12px rgba(28,20,16,0.06)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: BRAND[900],
                    color: COLORS.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                {step.label}
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    fontSize: 28,
                    color: BRAND[300],
                    opacity: arrowEntry,
                  }}
                >
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stats = [
    { label: "Föreningar anslutna", value: 45, suffix: "+" },
    { label: "Analyser gjorda", value: 500, suffix: "+" },
    { label: "Produkter levererade", value: 3200, suffix: "" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: COLORS.foreground,
          opacity: spring({ frame, fps, config: { damping: 200 } }),
        }}
      >
        Roots i siffror
      </div>
      <div style={{ display: "flex", gap: 100 }}>
        {stats.map((stat, i) => {
          const delay = i * 10;
          const entry = spring({
            frame,
            fps,
            delay,
            config: { damping: 200 },
          });
          return (
            <div key={stat.label} style={{ textAlign: "center", opacity: entry }}>
              <Sequence from={delay} layout="none" premountFor={15}>
                <CounterAnimation to={stat.value} suffix={stat.suffix} fontSize={64} />
              </Sequence>
              <div style={{ fontSize: 18, color: BRAND[500], marginTop: 8 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const AIScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntry = spring({ frame, fps, config: { damping: 200 } });
  const cardEntry = spring({ frame, fps, delay: 10, config: { damping: 200 } });
  const cardY = interpolate(cardEntry, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND[50],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.foreground, opacity: titleEntry }}>
        AI-driven håranalys
      </div>
      <div
        style={{
          width: 600,
          padding: 48,
          borderRadius: 24,
          backgroundColor: COLORS.white,
          boxShadow: "0 4px 32px rgba(28,20,16,0.08)",
          opacity: cardEntry,
          transform: `translateY(${cardY}px)`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: COLORS.foreground }}>
          Gratis håranalys online
        </div>
        <div style={{ fontSize: 18, color: BRAND[500], marginTop: 12, lineHeight: 1.5 }}>
          Ladda upp bilder, svara på frågor — få personliga rekommendationer baserade på nordiska ingredienser.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FoundersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntry = spring({ frame, fps, config: { damping: 200 } });

  const founders = [
    { initial: "C", role: "Företagare" },
    { initial: "J", role: "Ingenjör" },
    { initial: "M", role: "Idrottstränare" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.foreground, opacity: titleEntry }}>
        Tre män. Ett mål.
      </div>
      <div style={{ display: "flex", gap: 60 }}>
        {founders.map((f, i) => {
          const entry = spring({
            frame,
            fps,
            delay: 10 + i * 8,
            config: { damping: 15, stiffness: 80 },
          });
          return (
            <div key={f.initial} style={{ textAlign: "center", opacity: entry, transform: `scale(${entry})` }}>
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: BRAND[900],
                  color: COLORS.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  fontWeight: 700,
                  margin: "0 auto",
                }}
              >
                {f.initial}
              </div>
              <div style={{ fontSize: 18, color: BRAND[500], marginTop: 16 }}>
                {f.role}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 22,
          color: BRAND[400],
          maxWidth: 600,
          textAlign: "center",
          lineHeight: 1.5,
          opacity: spring({ frame, fps, delay: 35, config: { damping: 200 } }),
        }}
      >
        Olika bakgrunder, gemensamt mål: att stärka svenskt föreningsliv.
      </div>
    </AbsoluteFill>
  );
};

export const CompanyVideo: React.FC = () => {
  const SCENE = 100;
  const TRANSITION = 15;

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <IntroScene tagline="Naturlig hårvård. Ren känsla." />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE + 20}>
        <ProductsScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE + 20}>
        <ModelScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StatsScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <AIScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <FoundersScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <OutroScene cta="Stärk ert föreningsliv" url="roots.se" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
