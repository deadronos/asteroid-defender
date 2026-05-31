import { Suspense, lazy, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import GameScene from "./components/GameScene";
import HUD from "./components/HUD";
import useGameStore from "./store/gameStore";
import { markTelemetry } from "./telemetry/runtime";
import {
  clampVisualProfile,
  degradeVisualProfile,
  fallbackVisualProfile,
  getInitialVisualProfile,
  improveVisualProfile,
} from "./utils/visualQuality";
import "./index.css";

// Lazy-load the postprocessing pass so the heavy `postprocessing` +
// `@react-three/postprocessing` chunk is fetched after first render.
const PostEffects = lazy(() => import("./components/PostEffects"));
const DevTelemetryOverlay = import.meta.env.DEV
  ? lazy(() => import("./telemetry/DevTelemetryOverlay"))
  : null;

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const sessionId = useGameStore((state) => state.sessionId);
  const reducedMotion = useGameStore((state) => state.reducedMotion);
  const [visualProfile, setVisualProfile] = useState(() => getInitialVisualProfile(reducedMotion));
  const effectiveVisualProfile = clampVisualProfile(visualProfile, reducedMotion);

  return (
    <>
      <HUD />
      {DevTelemetryOverlay && (
        <Suspense fallback={null}>
          <DevTelemetryOverlay />
        </Suspense>
      )}
      <Canvas
        camera={{ position: [0, 15, 25], fov: 60 }}
        dpr={effectiveVisualProfile.dpr}
        gl={{ stencil: false }}
      >
        <PerformanceMonitor
          onIncline={() =>
            setVisualProfile((current) => {
              const nextProfile = improveVisualProfile(current, reducedMotion);
              markTelemetry("visual-profile:incline", {
                dpr: nextProfile.dpr,
                effects: nextProfile.effectsQuality,
              });
              return nextProfile;
            })
          }
          onDecline={() =>
            setVisualProfile((current) => {
              const nextProfile = degradeVisualProfile(current, reducedMotion);
              markTelemetry("visual-profile:decline", {
                dpr: nextProfile.dpr,
                effects: nextProfile.effectsQuality,
              });
              return nextProfile;
            })
          }
          flipflops={3}
          onFallback={() => {
            const nextProfile = fallbackVisualProfile();
            markTelemetry("visual-profile:fallback", {
              dpr: nextProfile.dpr,
              effects: nextProfile.effectsQuality,
            });
            setVisualProfile(nextProfile);
          }}
        >
          <color attach="background" args={["#050510"]} />
          <Suspense fallback={null}>
            <Physics paused={gameState !== "playing"}>
              <GameScene
                asteroidEffectsQuality={effectiveVisualProfile.effectsQuality}
                backgroundEffectsQuality={effectiveVisualProfile.effectsQuality}
                reducedMotion={reducedMotion}
                sessionId={sessionId}
              />
            </Physics>
          </Suspense>
          {effectiveVisualProfile.effectsQuality !== "off" && (
            <Suspense fallback={null}>
              <PostEffects quality={effectiveVisualProfile.effectsQuality} />
            </Suspense>
          )}
        </PerformanceMonitor>
      </Canvas>
    </>
  );
}

export default App;
