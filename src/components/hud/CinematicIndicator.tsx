/** Pill shown at the bottom center during a cinematic camera sweep. */
export default function CinematicIndicator() {
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
