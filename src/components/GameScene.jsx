import React, { useState, useCallback, useEffect } from 'react';
import { Stars, OrbitControls } from '@react-three/drei';
import useGameStore from '../store/gameStore';
import Platform from './Platform';
import Turret from './Turret';
import Asteroid from './Asteroid';
import AsteroidSpawner from './AsteroidSpawner';

export default function GameScene() {
    const [asteroids, setAsteroids] = useState([]);

    const { incrementDestroyed, setActiveAsteroids } = useGameStore();

    const handleSpawn = useCallback((ast) => {
        setAsteroids(prev => {
            const newAsteroids = [...prev, ast];
            setActiveAsteroids(newAsteroids.length);
            return newAsteroids;
        });
    }, [setActiveAsteroids]);

    const handleDestroy = useCallback((id) => {
        incrementDestroyed();
        setAsteroids(prev => {
            const newAsteroids = prev.filter(ast => ast.id !== id);
            setActiveAsteroids(newAsteroids.length);
            return newAsteroids;
        });
    }, [incrementDestroyed, setActiveAsteroids]);

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <OrbitControls makeDefault />

            <AsteroidSpawner onSpawn={handleSpawn} />

            <Platform />

            <Turret id="t1" position={[5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t2" position={[-5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t3" position={[5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <Turret id="t4" position={[-5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />

            {asteroids.map(ast => (
                <Asteroid key={ast.id} id={ast.id} startPos={ast.pos} onDestroy={handleDestroy} />
            ))}
        </>
    );
}
