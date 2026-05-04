import { toolbarButtonBase } from "./hudStyles";
import Tooltip from "../ui/Tooltip";
import "./HUDControls.css";

interface HUDControlsProps {
  gameState: string;
  cameraMode: string;
  reducedMotion: boolean;
  showCinematicIndicator: boolean;
  togglePause: () => void;
  toggleCameraMode: () => void;
  toggleReducedMotion: () => void;
  toggleCinematicIndicator: () => void;
  openOnboarding: () => void;
}

// Sub-components
const PauseButton = ({
  gameState,
  togglePause,
}: {
  gameState: string;
  togglePause: () => void;
}) => {
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
};

const CameraModeButton = ({
  cameraMode,
  toggleCameraMode,
}: {
  cameraMode: string;
  toggleCameraMode: () => void;
}) => {
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
};

const ReducedMotionButton = ({
  reducedMotion,
  toggleReducedMotion,
}: {
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
}) => {
  return (
    <Tooltip content={<span>Reduced Motion {reducedMotion ? "ON" : "OFF"} (click to toggle)</span>}>
      <button
        onClick={toggleReducedMotion}
        aria-label={reducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
        aria-pressed={reducedMotion}
        style={toolbarButtonBase}
        className="hud-button-reduced-motion"
      >
        ♿
      </button>
    </Tooltip>
  );
};

const CinematicIndicatorButton = ({
  showCinematicIndicator,
  toggleCinematicIndicator,
}: {
  showCinematicIndicator: boolean;
  toggleCinematicIndicator: () => void;
}) => {
  return (
    <Tooltip
      content={<span>Sweep label {showCinematicIndicator ? "ON" : "OFF"} (click to toggle)</span>}
    >
      <button
        onClick={toggleCinematicIndicator}
        aria-label={
          showCinematicIndicator ? "Hide cinematic sweep label" : "Show cinematic sweep label"
        }
        aria-pressed={showCinematicIndicator}
        style={toolbarButtonBase}
        className="hud-button-cinematic"
      >
        🎥
      </button>
    </Tooltip>
  );
};

const HelpButton = ({ openOnboarding }: { openOnboarding: () => void }) => {
  return (
    <Tooltip
      content={
        <span>
          Help (<kbd>?</kbd> / <kbd>H</kbd>)
        </span>
      }
    >
      <button
        onClick={openOnboarding}
        aria-label="Open help"
        style={toolbarButtonBase}
        className="hud-button-help"
      >
        Help
      </button>
    </Tooltip>
  );
};

/** Top-right toolbar: pause, camera mode, reduced motion, cinematic indicator, help. */
export default function HUDControls({
  gameState,
  cameraMode,
  reducedMotion,
  showCinematicIndicator,
  togglePause,
  toggleCameraMode,
  toggleReducedMotion,
  toggleCinematicIndicator,
  openOnboarding,
}: HUDControlsProps) {
  return (
    <div className="hud-controls-container">
      <PauseButton gameState={gameState} togglePause={togglePause} />
      <CameraModeButton cameraMode={cameraMode} toggleCameraMode={toggleCameraMode} />
      <ReducedMotionButton
        reducedMotion={reducedMotion}
        toggleReducedMotion={toggleReducedMotion}
      />

      {cameraMode === "cinematic" && (
        <CinematicIndicatorButton
          showCinematicIndicator={showCinematicIndicator}
          toggleCinematicIndicator={toggleCinematicIndicator}
        />
      )}

      <HelpButton openOnboarding={openOnboarding} />
    </div>
  );
}
