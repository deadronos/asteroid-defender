import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import useGameStore from "../../store/gameStore";
import OverlayBackdrop from "./OverlayBackdrop";
import { dangerButton, overlayTitle } from "./hudStyles";
import { formatDuration } from "./formatDuration";

/** Full-screen overlay shown when the base is destroyed. */
function GameOverOverlay() {
  const { asteroidsDestroyed, runStartedAt, runEndedAt, restartGame } = useGameStore(
    useShallow((state) => ({
      asteroidsDestroyed: state.asteroidsDestroyed,
      runStartedAt: state.runStartedAt,
      runEndedAt: state.runEndedAt,
      restartGame: state.restartGame,
    })),
  );

  const runDuration = runStartedAt > 0 && runEndedAt !== null ? runEndedAt - runStartedAt : 0;
  const runDurationLabel = formatDuration(runDuration);

  return (
    <OverlayBackdrop backgroundColor="rgba(0,0,0,0.85)" zIndex={100}>
      <h1
        style={{
          ...overlayTitle,
          color: "#ef4444",
          fontSize: "clamp(2rem, 6vw, 4rem)",
          margin: "0 0 1rem 0",
          textShadow: "0 0 20px rgba(239,68,68,0.5)",
        }}
      >
        BASE DESTROYED
      </h1>
      <p style={{ color: "#fff", fontSize: "clamp(1rem, 3vw, 1.5rem)", marginBottom: "2rem" }}>
        You destroyed {asteroidsDestroyed} asteroids before falling.
      </p>
      <p
        style={{
          color: "#bfdbfe",
          fontSize: "clamp(0.95rem, 2.6vw, 1.25rem)",
          margin: "0 0 2rem 0",
        }}
      >
        Time survived: {runDurationLabel}
      </p>
      <button
        onClick={restartGame}
        style={{
          ...dangerButton,
          padding: "clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)",
          fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
          borderRadius: "8px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          boxShadow: "0 4px 15px rgba(239,68,68,0.4)",
          transition: "all 0.2s ease-in-out",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        Restart Protocol (R)
      </button>
    </OverlayBackdrop>
  );
}

export default memo(GameOverOverlay);
