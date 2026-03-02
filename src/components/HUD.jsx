import React from 'react';
import useGameStore from '../store/gameStore';

export default function HUD() {
    const asteroidsDestroyed = useGameStore((state) => state.asteroidsDestroyed);
    const activeAsteroids = useGameStore((state) => state.activeAsteroids);

    return (
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
    );
}
