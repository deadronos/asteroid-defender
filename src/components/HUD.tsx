import { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';

const ONBOARDING_STORAGE_KEY = 'asteroid-defender:onboarding-seen-v1';

export default function HUD() {
    const asteroidsDestroyed = useGameStore((state) => state.asteroidsDestroyed);
    const activeAsteroids = useGameStore((state) => state.activeAsteroids);
    const health = useGameStore((state) => state.health);
    const maxHealth = useGameStore((state) => state.maxHealth);
    const gameState = useGameStore((state) => state.gameState);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    const healthPercent = (health / maxHealth) * 100;

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
                top: 20,
                left: 20,
                zIndex: 10,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
            }}>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>Asteroid Defender</h1>

                <div style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#aaa' }}>Base Integrity</span>
                            <span style={{ color: health > 30 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>{health}%</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${healthPercent}%`, height: '100%', background: health > 30 ? '#4ade80' : '#ef4444', transition: 'width 0.3s' }} />
                        </div>
                    </div>

                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                        <span style={{ color: '#aaa' }}>Destroyed: </span>
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{asteroidsDestroyed}</span>
                    </div>
                    <div style={{ fontSize: '1.1rem' }}>
                        <span style={{ color: '#aaa' }}>Warning | Active Swarm: </span>
                        <span style={{ color: activeAsteroids > 5 ? '#ef4444' : '#facc15', fontWeight: 'bold' }}>
                            {activeAsteroids}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={openOnboarding}
                aria-label="Open help"
                style={{
                    position: 'fixed',
                    top: 20,
                    right: 20,
                    zIndex: 120,
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
                            <li><strong>Camera</strong>: cinematic perspectives shift roughly every 17 seconds.</li>
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
                    <h1 style={{ color: '#ef4444', fontSize: '4rem', margin: '0 0 1rem 0', textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>BASE DESTROYED</h1>
                    <p style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '2rem' }}>You destroyed {asteroidsDestroyed} asteroids before falling.</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '16px 32px', fontSize: '1.5rem',
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
        </>
    );
}
