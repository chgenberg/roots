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
import { StepScene } from "../components/StepScene";
import { OutroScene } from "../components/OutroScene";
import { BRAND, COLORS } from "../components/BrandColors";
import { FONT_FAMILY } from "../components/useFont";

const ProgressScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntry = spring({ frame, fps, config: { damping: 200 } });

  const barProgress = interpolate(frame, [15, 2.5 * fps], [0, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const statsEntry = spring({
    frame,
    fps,
    delay: 20,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        fontFamily: FONT_FAMILY,
        padding: 120,
      }}
    >
      <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.foreground, opacity: titleEntry }}>
        Se vad laget tjänat
      </div>

      <div style={{ width: 700 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            color: BRAND[500],
            marginBottom: 12,
            opacity: statsEntry,
          }}
        >
          <span>Lagets mål</span>
          <span>{Math.round(barProgress * 100)}%</span>
        </div>
        <div
          style={{
            width: "100%",
            height: 24,
            borderRadius: 12,
            backgroundColor: BRAND[100],
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barProgress * 100}%`,
              height: "100%",
              borderRadius: 12,
              backgroundColor: BRAND[700],
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 60,
          opacity: statsEntry,
        }}
      >
        {[
          { label: "Ordrar", value: "18" },
          { label: "Tjänat", value: "4 320 kr" },
          { label: "Toppsäljare", value: "Emma S." },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.foreground }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 16, color: BRAND[400], marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const SaljareVideo: React.FC = () => {
  const SCENE = 90;
  const TRANSITION = 15;

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <IntroScene tagline="Din personliga shop — sälj för laget" />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="01"
          title="Få din unika länk"
          description="Du får en personlig shop-URL att dela med familj och vänner."
          icon={<span>🔗</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="02"
          title="Dela med familj och vänner"
          description="Skicka länken via SMS, sociala medier eller e-post."
          icon={<span>📲</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="03"
          title="Följ dina ordrar"
          description="Se i realtid vem som beställt och vad du tjänat."
          icon={<span>📊</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE + 30}>
        <ProgressScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <OutroScene cta="Börja sälj idag" url="roots.se" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
