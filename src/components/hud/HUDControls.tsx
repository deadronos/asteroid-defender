import { toolbarButtonBase } from "./hudStyles";

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
    <>
      <style>{`
        .hud-controls-container {
          position: fixed;
          top: max(16px, env(safe-area-inset-top, 16px));
          right: max(16px, env(safe-area-inset-right, 16px));
          z-index: 120;
          display: flex;
          gap: 10px;
          align-items: center;
          max-width: calc(100vw - 32px);
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .hud-controls-container {
            max-width: calc(100vw - 240px);
          }
        }
      `}</style>
      <div className="hud-controls-container">
        {(gameState === "playing" || gameState === "paused") && (
          <button
            onClick={togglePause}
            aria-label={gameState === "playing" ? "Pause game" : "Resume game"}
            style={{
              ...toolbarButtonBase,
              minWidth: 108,
              fontSize: "0.95rem",
            }}
          >
            {gameState === "playing" ? "Pause (Esc)" : "Resume (Esc)"}
          </button>
        )}

        <button
          onClick={toggleCameraMode}
          aria-label={
            cameraMode === "cinematic" ? "Switch to static camera" : "Switch to cinematic camera"
          }
          title={
            cameraMode === "cinematic"
              ? "Cinematic (click for Static)"
              : "Static (click for Cinematic)"
          }
          style={{
            ...toolbarButtonBase,
            padding: "0 14px",
            border: `1px solid ${cameraMode === "cinematic" ? "rgba(167,139,250,0.55)" : "rgba(255,255,255,0.25)"}`,
            background:
              cameraMode === "cinematic" ? "rgba(109,40,217,0.28)" : "rgba(8, 12, 24, 0.86)",
            color: cameraMode === "cinematic" ? "#ddd6fe" : "#9ca3af",
            fontSize: "0.88rem",
            whiteSpace: "nowrap",
          }}
        >
          {cameraMode === "cinematic" ? "🎬 Cinematic" : "📷 Static"}
        </button>

        <button
          onClick={toggleReducedMotion}
          aria-label={reducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
          title={
            reducedMotion
              ? "Reduced Motion ON (click to disable)"
              : "Reduced Motion OFF (click to enable)"
          }
          style={{
            ...toolbarButtonBase,
            width: 44,
            border: `1px solid ${reducedMotion ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.25)"}`,
            background: reducedMotion ? "rgba(6,78,59,0.4)" : "rgba(8, 12, 24, 0.86)",
            color: reducedMotion ? "#6ee7b7" : "#9ca3af",
            fontSize: "1.1rem",
          }}
        >
          ♿
        </button>

        {cameraMode === "cinematic" && (
          <button
            onClick={toggleCinematicIndicator}
            aria-label={
              showCinematicIndicator ? "Hide cinematic sweep label" : "Show cinematic sweep label"
            }
            title={
              showCinematicIndicator
                ? "Sweep label ON (click to hide)"
                : "Sweep label OFF (click to show)"
            }
            style={{
              ...toolbarButtonBase,
              width: 44,
              border: `1px solid ${showCinematicIndicator ? "rgba(167,139,250,0.55)" : "rgba(255,255,255,0.25)"}`,
              background: showCinematicIndicator
                ? "rgba(109,40,217,0.28)"
                : "rgba(8, 12, 24, 0.86)",
              color: showCinematicIndicator ? "#ddd6fe" : "#9ca3af",
              fontSize: "1.1rem",
            }}
          >
            🎥
          </button>
        )}

        <button
          onClick={openOnboarding}
          aria-label="Open help"
          title="Help (? / H)"
          style={{
            ...toolbarButtonBase,
            padding: "0 16px",
            minWidth: 74,
            height: 48,
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(8, 12, 24, 0.8)",
            color: "#fff",
            fontSize: "0.95rem",
          }}
        >
          Help
        </button>
      </div>
    </>
  );
}
