import { fullscreenOverlay, primaryButton, dangerButton } from './hudStyles';

interface PauseOverlayProps {
    resumeGame: () => void;
    restartGame: () => void;
}

/** Full-screen overlay shown while the game is paused. */
export default function PauseOverlay({ resumeGame, restartGame }: PauseOverlayProps) {
    return (
        <div style={{
            ...fullscreenOverlay,
            backgroundColor: 'rgba(0,0,0,0.72)',
            zIndex: 110,
        }}>
            <h1 style={{ color: '#e2e8f0', fontSize: 'clamp(1.8rem, 5vw, 3rem)', margin: '0 0 0.8rem 0' }}>Simulation Paused</h1>
            <p style={{ color: '#bfdbfe', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', margin: '0 0 1.8rem 0' }}>Press Esc or resume when ready.</p>
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
        </div>
    );
}
