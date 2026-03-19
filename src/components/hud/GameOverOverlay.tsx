import { dangerButton } from './hudStyles';

interface GameOverOverlayProps {
    asteroidsDestroyed: number;
    runDurationLabel: string;
    restartGame: () => void;
}

/** Full-screen overlay shown when the base is destroyed. */
export default function GameOverOverlay({ asteroidsDestroyed, runDurationLabel, restartGame }: GameOverOverlayProps) {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 100, pointerEvents: 'auto',
            backdropFilter: 'blur(8px)',
        }}>
            <h1 style={{ color: '#ef4444', fontSize: 'clamp(2rem, 6vw, 4rem)', margin: '0 0 1rem 0', textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>BASE DESTROYED</h1>
            <p style={{ color: '#fff', fontSize: 'clamp(1rem, 3vw, 1.5rem)', marginBottom: '2rem' }}>You destroyed {asteroidsDestroyed} asteroids before falling.</p>
            <p style={{ color: '#bfdbfe', fontSize: 'clamp(0.95rem, 2.6vw, 1.25rem)', margin: '0 0 2rem 0' }}>Time survived: {runDurationLabel}</p>
            <button
                onClick={restartGame}
                style={{
                    ...dangerButton,
                    padding: 'clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)',
                    fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                    transition: 'all 0.2s ease-in-out',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                Restart Protocol (R)
            </button>
        </div>
    );
}
