import OverlayBackdrop from "./OverlayBackdrop";
import { overlayText, overlayTitle, primaryButton } from "./hudStyles";

interface MenuOverlayProps {
  startGame: () => void;
}

/** Full-screen menu shown before the first run. */
export default function MenuOverlay({ startGame }: MenuOverlayProps) {
  return (
    <OverlayBackdrop backgroundColor="rgba(2, 4, 12, 0.84)" zIndex={125}>
      <h1 style={{ ...overlayTitle, textShadow: "0 0 20px rgba(126,200,255,0.35)" }}>
        Asteroid Defender
      </h1>
      <p style={{ ...overlayText, maxWidth: 620 }}>
        Command online. Start the defense cycle when ready, pause at any time with{" "}
        <strong>Esc</strong>, and hold the platform.
      </p>
      <button
        onClick={startGame}
        style={{
          ...primaryButton,
          padding: "clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)",
          fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
          borderRadius: "10px",
          letterSpacing: "1px",
          boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
        }}
      >
        Start Defense
      </button>
    </OverlayBackdrop>
  );
}
