import OverlayBackdrop from './OverlayBackdrop';
import { overlayText, overlayTitle, primaryButton, dangerButton } from './hudStyles';

interface PauseOverlayProps {
    resumeGame: () => void;
    restartGame: () => void;
}

/** Full-screen overlay shown while the game is paused. */
export default function PauseOverlay({ resumeGame, restartGame }: PauseOverlayProps) {
    return (
        <OverlayBackdrop backgroundColor="rgba(0,0,0,0.72)" zIndex={110}>
            <h1 style={{ ...overlayTitle, color: '#e2e8f0', fontSize: 'clamp(1.8rem, 5vw, 3rem)' }}>Simulation Paused</h1>
            <p style={{ ...overlayText, fontSize: 'clamp(0.9rem, 2vw, 1.05rem)' }}>Press Esc or resume when ready.</p>
            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    onClick={resumeGame}
                    style={{
                        ...primaryButton,
                        padding: '12px 24px',
                        fontSize: '1rem',
                    }}
                >
                    Resume
                </button>
                <button
                    onClick={restartGame}
                    style={{
                        ...dangerButton,
                        padding: '12px 24px',
                        fontSize: '1rem',
                    }}
                >
                    Restart (R)
                </button>
            </div>
        </OverlayBackdrop>
    );
}
