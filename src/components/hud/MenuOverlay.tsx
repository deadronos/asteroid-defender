import { fullscreenOverlay, primaryButton } from './hudStyles';

interface MenuOverlayProps {
    startGame: () => void;
}

/** Full-screen menu shown before the first run. */
export default function MenuOverlay({ startGame }: MenuOverlayProps) {
    return (
        <div style={{
            ...fullscreenOverlay,
            backgroundColor: 'rgba(2, 4, 12, 0.84)',
            zIndex: 125,
        }}>
            <h1 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 5vw, 3.2rem)', margin: '0 0 0.8rem 0', textShadow: '0 0 20px rgba(126,200,255,0.35)' }}>
                Asteroid Defender
            </h1>
            <p style={{ color: '#bfdbfe', fontSize: 'clamp(0.9rem, 2vw, 1.15rem)', maxWidth: 620, margin: '0 0 1.8rem 0' }}>
                Command online. Start the defense cycle when ready, pause at any time with <strong>Esc</strong>, and hold the platform.
            </p>
            <button
                onClick={startGame}
                style={{
                    ...primaryButton,
                    padding: 'clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)',
                    fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                    borderRadius: '10px',
                    letterSpacing: '1px',
                    boxShadow: '0 10px 25px rgba(37,99,235,0.35)',
                }}
            >
                Start Defense
            </button>
        </div>
    );
}
