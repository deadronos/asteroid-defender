import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import useGameStore from "../../store/gameStore";

/** Pill shown at the bottom center during a cinematic camera sweep. */
function CinematicIndicator() {
  const { cameraMode, inCinematicTransition, showCinematicIndicator } = useGameStore(
    useShallow((state) => ({
      cameraMode: state.cameraMode,
      inCinematicTransition: state.inCinematicTransition,
      showCinematicIndicator: state.showCinematicIndicator,
    })),
  );

  if (cameraMode !== "cinematic" || !inCinematicTransition || !showCinematicIndicator) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-label="Cinematic sweep in progress"
      style={{
        position: "fixed",
        bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(167,139,250,0.4)",
        borderRadius: "999px",
        padding: "4px 14px",
        fontSize: "clamp(0.65rem, 1.2vw, 0.8rem)",
        color: "rgba(221,214,254,0.85)",
        letterSpacing: "0.06em",
        backdropFilter: "blur(4px)",
        whiteSpace: "nowrap",
      }}
    >
      🎬 Cinematic sweep
    </div>
  );
}

export default memo(CinematicIndicator);
