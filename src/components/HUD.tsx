import useGameStore from '../store/gameStore';

export default function HUD() {
    const asteroidsDestroyed = useGameStore((state) => state.asteroidsDestroyed);
    const activeAsteroids = useGameStore((state) => state.activeAsteroids);
    const health = useGameStore((state) => state.health);
    const maxHealth = useGameStore((state) => state.maxHealth);
    const gameState = useGameStore((state) => state.gameState);

    const healthPercent = (health / maxHealth) * 100;

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
