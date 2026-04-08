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
import { CounterAnimation } from "../components/CounterAnimation";
import { BRAND, COLORS } from "../components/BrandColors";
import { FONT_FAMILY } from "../components/useFont";

const RevenueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntry = spring({ frame, fps, config: { damping: 200 } });
  const counterDelay = 15;
  const counterEntry = spring({
    frame,
    fps,
    delay: counterDelay,
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
        gap: 24,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: BRAND[400],
          opacity: titleEntry,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Intäkter till föreningen
      </div>
      <div style={{ opacity: counterEntry }}>
        <Sequence from={counterDelay} layout="none" premountFor={15}>
          <CounterAnimation to={24500} suffix=" kr" fontSize={96} />
        </Sequence>
      </div>
      <div
        style={{
          fontSize: 22,
          color: BRAND[500],
          opacity: interpolate(
            spring({ frame, fps, delay: 40, config: { damping: 200 } }),
            [0, 1],
            [0, 1]
          ),
          maxWidth: 500,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Direkt till er föreningskassa — utan krångel
      </div>
    </AbsoluteFill>
  );
};

export const ForeningVideo: React.FC = () => {
  const SCENE = 90; // 3s per scene
  const TRANSITION = 15;

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <IntroScene tagline="Sälj naturlig hårvård. Stärk er förening." />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="01"
          title="Registrera er förening"
          description="Skapa ett konto på ett par minuter — helt utan startavgift."
          icon={<span>📋</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="02"
          title="Välj produkter och antal"
          description="Schampo, balsam och body wash — tre produkter, inget mer."
          icon={<span>🧴</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <StepScene
          stepNumber="03"
          title="Vi levererar — ni säljer"
          description="Leverans direkt till klubben. Medlemmarna säljer vidare."
          icon={<span>📦</span>}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE + 30}>
        <RevenueScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE}>
        <OutroScene cta="Kom igång på" url="roots.se" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
