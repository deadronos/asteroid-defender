import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import useGameStore from "../../store/gameStore";
import { toolbarButtonBase } from "./hudStyles";
import Tooltip from "../ui/Tooltip";
import "./HUDControls.css";

interface HUDControlsProps {
  openOnboarding: () => void;
}

// Sub-components
const PauseButton = memo(function PauseButton({
  gameState,
  togglePause,
}: {
  gameState: string;
  togglePause: () => void;
}) {
  if (gameState !== "playing" && gameState !== "paused") return null;

  return (
    <button
      onClick={togglePause}
      aria-label={gameState === "playing" ? "Pause game" : "Resume game"}
      style={toolbarButtonBase}
      className="hud-button-pause"
    >
      {gameState === "playing" ? "Pause (Esc)" : "Resume (Esc)"}
    </button>
  );
});

const CameraModeButton = memo(function CameraModeButton({
  cameraMode,
  toggleCameraMode,
}: {
  cameraMode: string;
  toggleCameraMode: () => void;
}) {
  const isCinematic = cameraMode === "cinematic";
  return (
    <Tooltip content={<span>{isCinematic ? "Cinematic" : "Static"} (click to toggle)</span>}>
      <button
        onClick={toggleCameraMode}
        aria-label={isCinematic ? "Switch to static camera" : "Switch to cinematic camera"}
        aria-pressed={isCinematic}
        style={toolbarButtonBase}
        className="hud-button-camera"
      >
        {isCinematic ? "🎬 Cinematic" : "📷 Static"}
      </button>
    </Tooltip>
  );
});

const MotionButton = memo(function MotionButton({
  reducedMotion,
  toggleReducedMotion,
}: {
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
}) {
  return (
    <Tooltip
      content={
        <span>Reduced Motion: {reducedMotion ? "On" : "Off"} (click to toggle accessibility)</span>
      }
    >
      <button
        onClick={toggleReducedMotion}
        aria-label={reducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
        aria-pressed={reducedMotion}
        style={{
          ...toolbarButtonBase,
          color: reducedMotion ? "#86efac" : "rgba(255,255,255,0.7)",
          borderColor: reducedMotion ? "rgba(134,239,172,0.4)" : "rgba(255,255,255,0.15)",
        }}
        className="hud-button-motion"
      >
        {reducedMotion ? "♿ Motion: Calm" : "⚡ Motion: Full"}
      </button>
    </Tooltip>
  );
});

const IndicatorButton = memo(function IndicatorButton({
  cameraMode,
  showCinematicIndicator,
  toggleCinematicIndicator,
}: {
  cameraMode: string;
  showCinematicIndicator: boolean;
  toggleCinematicIndicator: () => void;
}) {
  if (cameraMode !== "cinematic") return null;

  return (
    <Tooltip
      content={
        <span>
          Sweep Indicator: {showCinematicIndicator ? "Shown" : "Hidden"} (click to toggle)
        </span>
      }
    >
      <button
        onClick={toggleCinematicIndicator}
        aria-label={
          showCinematicIndicator
            ? "Hide cinematic sweep indicator"
            : "Show cinematic sweep indicator"
        }
        aria-pressed={showCinematicIndicator}
        style={{
          ...toolbarButtonBase,
          color: showCinematicIndicator ? "rgba(221,214,254,0.9)" : "rgba(255,255,255,0.4)",
          borderColor: showCinematicIndicator ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.15)",
        }}
        className="hud-button-indicator"
      >
        {showCinematicIndicator ? "👁 Indicator" : "🚫 Indicator"}
      </button>
    </Tooltip>
  );
});

const HelpButton = memo(function HelpButton({ openOnboarding }: { openOnboarding: () => void }) {
  return (
    <Tooltip content={<span>Controls, stats & lore (?)</span>}>
      <button
        onClick={openOnboarding}
        aria-label="Open instructions and help"
        style={toolbarButtonBase}
        className="hud-button-help"
      >
        ❓ Help (?)
      </button>
    </Tooltip>
  );
});

/** Top-right toolbar: pause/resume, camera toggle, reduced motion, help dialog. */
function HUDControls({ openOnboarding }: HUDControlsProps) {
  const {
    gameState,
    cameraMode,
    reducedMotion,
    showCinematicIndicator,
    togglePause,
    toggleCameraMode,
    toggleReducedMotion,
    toggleCinematicIndicator,
  } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      cameraMode: state.cameraMode,
      reducedMotion: state.reducedMotion,
      showCinematicIndicator: state.showCinematicIndicator,
      togglePause: state.togglePause,
      toggleCameraMode: state.toggleCameraMode,
      toggleReducedMotion: state.toggleReducedMotion,
      toggleCinematicIndicator: state.toggleCinematicIndicator,
    })),
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "max(16px, env(safe-area-inset-top, 16px))",
        right: "max(16px, env(safe-area-inset-right, 16px))",
        zIndex: 10,
        display: "flex",
        gap: "clamp(6px, 1vw, 10px)",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <PauseButton gameState={gameState} togglePause={togglePause} />
      <CameraModeButton cameraMode={cameraMode} toggleCameraMode={toggleCameraMode} />
      <MotionButton reducedMotion={reducedMotion} toggleReducedMotion={toggleReducedMotion} />
      <IndicatorButton
        cameraMode={cameraMode}
        showCinematicIndicator={showCinematicIndicator}
        toggleCinematicIndicator={toggleCinematicIndicator}
      />
      <HelpButton openOnboarding={openOnboarding} />
    </div>
  );
}

export default memo(HUDControls);
