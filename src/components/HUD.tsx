import { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';

const ONBOARDING_STORAGE_KEY = 'asteroid-defender:onboarding-seen-v1';

export default function HUD() {
    const asteroidsDestroyed = useGameStore((state) => state.asteroidsDestroyed);
    const activeAsteroids = useGameStore((state) => state.activeAsteroids);
    const health = useGameStore((state) => state.health);
    const maxHealth = useGameStore((state) => state.maxHealth);
    const gameState = useGameStore((state) => state.gameState);
    const startGame = useGameStore((state) => state.startGame);
    const togglePause = useGameStore((state) => state.togglePause);
    const resumeGame = useGameStore((state) => state.resumeGame);
    const restartGame = useGameStore((state) => state.restartGame);
    const cameraMode = useGameStore((state) => state.cameraMode);
    const reducedMotion = useGameStore((state) => state.reducedMotion);
    const showCinematicIndicator = useGameStore((state) => state.showCinematicIndicator);
    const inCinematicTransition = useGameStore((state) => state.inCinematicTransition);
    const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);
    const toggleReducedMotion = useGameStore((state) => state.toggleReducedMotion);
    const toggleCinematicIndicator = useGameStore((state) => state.toggleCinematicIndicator);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    // trigger a brief visual pulse when the game state changes
    const [badgePulse, setBadgePulse] = useState(false);

    const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;

    const stateBadge = {
        menu: { label: 'MENU', bg: 'rgba(59,130,246,0.24)', border: 'rgba(96,165,250,0.65)', color: '#bfdbfe' },
        playing: { label: 'PLAYING', bg: 'rgba(34,197,94,0.2)', border: 'rgba(74,222,128,0.6)', color: '#dcfce7' },
        paused: { label: 'PAUSED', bg: 'rgba(245,158,11,0.2)', border: 'rgba(251,191,36,0.65)', color: '#fef3c7' },
        gameover: { label: 'GAME OVER', bg: 'rgba(239,68,68,0.2)', border: 'rgba(248,113,113,0.6)', color: '#fee2e2' },
    }[gameState];
    // animate badge on state transitions
    useEffect(() => {
        // pulse the badge then clear after animation duration
        setBadgePulse(true);
        const t = setTimeout(() => setBadgePulse(false), 200);
        return () => clearTimeout(t);
    }, [gameState]);

    useEffect(() => {
        try {
            const hasSeenOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
            if (!hasSeenOnboarding) {
                setIsOnboardingOpen(true);
            }
        } catch {
            // If storage is unavailable, default to showing onboarding for accessibility.
            setIsOnboardingOpen(true);
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.repeat) return;

            const state = useGameStore.getState();
            if (state.gameState === 'playing' || state.gameState === 'paused') {
                event.preventDefault();
                state.togglePause();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const dismissOnboarding = () => {
        setIsOnboardingOpen(false);
        try {
            window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        } catch {
            // Ignore storage failures; overlay can still be closed for the current session.
        }
    };

    const openOnboarding = () => {
        setIsOnboardingOpen(true);
    };

    return (
        <>
            <div style={{
                position: 'absolute',
                top: 'max(16px, env(safe-area-inset-top, 16px))',
                left: 'max(16px, env(safe-area-inset-left, 16px))',
                zIndex: 10,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(6px, 1vw, 12px)',
                textShadow: '0 2px 6px rgba(0,0,0,0.9)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3.5vw, 2rem)', color: '#fff' }}>Asteroid Defender</h1>
                    <span
                        aria-label={`Game state: ${stateBadge.label}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'clamp(3px, 0.6vw, 5px) clamp(7px, 1.2vw, 12px)',
                            borderRadius: '999px',
                            fontSize: 'clamp(0.6rem, 1.2vw, 0.72rem)',
                            letterSpacing: '0.08em',
                            fontWeight: 800,
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            color: stateBadge.color,
                            background: stateBadge.bg,
                            border: `1px solid ${stateBadge.border}`,
                            boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                            transition: 'transform 0.2s ease-out',
                            transform: badgePulse ? 'scale(1.2)' : 'scale(1)',
                        }}
                    >
                        {stateBadge.label}
                    </span>
                </div>

                <div style={{
                    background: 'rgba(0, 0, 0, 0.75)',
                    padding: 'clamp(10px, 1.5vw, 14px) clamp(12px, 2vw, 18px)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    backdropFilter: 'blur(6px)'
                }}>
                    <div style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.1rem)', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#d1d5db' }}>Base Integrity</span>
                            <span style={{ color: health > 30 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>{health}%</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${healthPercent}%`, height: '100%', background: health > 30 ? '#4ade80' : '#ef4444', transition: 'width 0.3s' }} />
                        </div>
                    </div>

                    <div style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.1rem)', marginBottom: '4px' }}>
                        <span style={{ color: '#d1d5db' }}>Destroyed: </span>
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{asteroidsDestroyed}</span>
                    </div>
                    <div style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.1rem)' }}>
                        <span style={{ color: '#d1d5db' }}>Warning | Active Swarm: </span>
                        <span style={{ color: activeAsteroids > 5 ? '#ef4444' : '#facc15', fontWeight: 'bold' }}>
                            {activeAsteroids}
                        </span>
                    </div>
                </div>
            </div>

            <div
                style={{
                    position: 'fixed',
                    top: 'max(16px, env(safe-area-inset-top, 16px))',
                    right: 'max(16px, env(safe-area-inset-right, 16px))',
                    zIndex: 120,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                }}
            >
                {(gameState === 'playing' || gameState === 'paused') && (
                    <button
                        onClick={togglePause}
                        aria-label={gameState === 'playing' ? 'Pause game' : 'Resume game'}
                        style={{
                            minWidth: 108,
                            height: 44,
                            borderRadius: '10px',
                            border: '1px solid rgba(126, 200, 255, 0.45)',
                            background: 'rgba(8, 12, 24, 0.86)',
                            color: '#dbeafe',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backdropFilter: 'blur(6px)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.35)'
                        }}
                    >
                        {gameState === 'playing' ? 'Pause (Esc)' : 'Resume (Esc)'}
                    </button>
                )}

                <button
                    onClick={toggleCameraMode}
                    aria-label={cameraMode === 'cinematic' ? 'Switch to static camera' : 'Switch to cinematic camera'}
                    title={cameraMode === 'cinematic' ? 'Cinematic (click for Static)' : 'Static (click for Cinematic)'}
                    style={{
                        height: 44,
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: `1px solid ${cameraMode === 'cinematic' ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.25)'}`,
                        background: cameraMode === 'cinematic' ? 'rgba(109,40,217,0.28)' : 'rgba(8, 12, 24, 0.86)',
                        color: cameraMode === 'cinematic' ? '#ddd6fe' : '#9ca3af',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backdropFilter: 'blur(6px)',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {cameraMode === 'cinematic' ? '🎬 Cinematic' : '📷 Static'}
                </button>

                <button
                    onClick={toggleReducedMotion}
                    aria-label={reducedMotion ? 'Disable reduced motion' : 'Enable reduced motion'}
                    title={reducedMotion ? 'Reduced Motion ON (click to disable)' : 'Reduced Motion OFF (click to enable)'}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: '10px',
                        border: `1px solid ${reducedMotion ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.25)'}`,
                        background: reducedMotion ? 'rgba(6,78,59,0.4)' : 'rgba(8, 12, 24, 0.86)',
                        color: reducedMotion ? '#6ee7b7' : '#9ca3af',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        backdropFilter: 'blur(6px)',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
                    }}
                >
                    ♿
                </button>

                {cameraMode === 'cinematic' && (
                    <button
                        onClick={toggleCinematicIndicator}
                        aria-label={showCinematicIndicator ? 'Hide cinematic sweep label' : 'Show cinematic sweep label'}
                        title={showCinematicIndicator ? 'Sweep label ON (click to hide)' : 'Sweep label OFF (click to show)'}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '10px',
                            border: `1px solid ${showCinematicIndicator ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.25)'}`,
                            background: showCinematicIndicator ? 'rgba(109,40,217,0.28)' : 'rgba(8, 12, 24, 0.86)',
                            color: showCinematicIndicator ? '#ddd6fe' : '#9ca3af',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            backdropFilter: 'blur(6px)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
                        }}
                    >
                        🎥
                    </button>
                )}

                <button
                    onClick={openOnboarding}
                    aria-label="Open help"
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.35)',
                        background: 'rgba(8, 12, 24, 0.8)',
                        color: '#fff',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backdropFilter: 'blur(6px)',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.35)'
                    }}
                >
                    ?
                </button>
            </div>

            {gameState === 'menu' && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(2, 4, 12, 0.84)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 125,
                    pointerEvents: 'auto',
                    backdropFilter: 'blur(8px)',
                    textAlign: 'center',
                    padding: '24px'
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
                            padding: 'clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)',
                            fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                            cursor: 'pointer',
                            backgroundColor: '#2563eb',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#fff',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            boxShadow: '0 10px 25px rgba(37,99,235,0.35)',
                        }}
                    >
                        Start Defense
                    </button>
                </div>
            )}

            {gameState === 'paused' && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.72)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 110,
                    pointerEvents: 'auto',
                    backdropFilter: 'blur(6px)'
                }}>
                    <h1 style={{ color: '#e2e8f0', fontSize: 'clamp(1.8rem, 5vw, 3rem)', margin: '0 0 0.8rem 0' }}>Simulation Paused</h1>
                    <p style={{ color: '#bfdbfe', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', margin: '0 0 1.8rem 0' }}>Press Esc or resume when ready.</p>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={resumeGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                backgroundColor: '#2563eb',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 700,
                            }}
                        >
                            Resume
                        </button>
                        <button
                            onClick={restartGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                backgroundColor: '#ef4444',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 700,
                            }}
                        >
                            Restart
                        </button>
                    </div>
                </div>
            )}

            {isOnboardingOpen && (
                <div
                    onClick={dismissOnboarding}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 130,
                        background: 'rgba(2, 4, 12, 0.82)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="How to play"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(560px, 100%)',
                            background: 'linear-gradient(145deg, rgba(13,17,33,0.96), rgba(8,12,24,0.96))',
                            border: '1px solid rgba(126, 200, 255, 0.35)',
                            borderRadius: '14px',
                            boxShadow: '0 16px 34px rgba(0,0,0,0.5)',
                            padding: '20px 20px 18px',
                            color: '#dbeafe',
                            lineHeight: 1.45,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Mission Brief</h2>
                            <button
                                onClick={dismissOnboarding}
                                aria-label="Close help"
                                style={{
                                    border: 'none',
                                    borderRadius: '8px',
                                    width: 36,
                                    height: 36,
                                    background: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ margin: '10px 0 12px', color: '#bfdbfe' }}>
                            Defend the base from incoming asteroids. Turrets auto-target and fire; if asteroids hit the platform, Base Integrity drops.
                        </p>

                        <ul style={{ margin: '0 0 14px 18px', padding: 0, display: 'grid', gap: '6px' }}>
                            <li><strong>Base Integrity</strong>: your remaining health.</li>
                            <li><strong>Destroyed</strong>: asteroids eliminated by your defenses.</li>
                            <li><strong>Active Swarm</strong>: current asteroid pressure.</li>
                            <li><strong>🎬 Cinematic / 📷 Static</strong>: toggle the camera style at any time.</li>
                            <li><strong>♿ Reduced Motion</strong>: slower cuts and less camera movement.</li>
                        </ul>

                        <button
                            onClick={dismissOnboarding}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                borderRadius: '10px',
                                background: '#3b82f6',
                                color: '#fff',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Got it — Defend the Base
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'gameover' && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 100, pointerEvents: 'auto',
                    backdropFilter: 'blur(8px)'
                }}>
                    <h1 style={{ color: '#ef4444', fontSize: 'clamp(2rem, 6vw, 4rem)', margin: '0 0 1rem 0', textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>BASE DESTROYED</h1>
                    <p style={{ color: '#fff', fontSize: 'clamp(1rem, 3vw, 1.5rem)', marginBottom: '2rem' }}>You destroyed {asteroidsDestroyed} asteroids before falling.</p>
                    <button
                        onClick={restartGame}
                        style={{
                            padding: 'clamp(12px, 2vw, 16px) clamp(24px, 4vw, 32px)', fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                            cursor: 'pointer', backgroundColor: '#ef4444',
                            border: 'none', borderRadius: '8px', color: '#fff',
                            fontWeight: 'bold', textTransform: 'uppercase',
                            letterSpacing: '2px',
                            boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                            transition: 'all 0.2s ease-in-out'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Restart Protocol
                    </button>
                </div>
            )}

            {cameraMode === 'cinematic' && inCinematicTransition && showCinematicIndicator && (
                <div
                    aria-live="polite"
                    aria-label="Cinematic sweep in progress"
                    style={{
                        position: 'fixed',
                        bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        pointerEvents: 'none',
                        background: 'rgba(0,0,0,0.55)',
                        border: '1px solid rgba(167,139,250,0.4)',
                        borderRadius: '999px',
                        padding: '4px 14px',
                        fontSize: 'clamp(0.65rem, 1.2vw, 0.8rem)',
                        color: 'rgba(221,214,254,0.85)',
                        letterSpacing: '0.06em',
                        backdropFilter: 'blur(4px)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    🎬 Cinematic sweep
                </div>
            )}
        </>
    );
}
