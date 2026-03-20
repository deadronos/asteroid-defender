import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AsteroidType, countAsteroidsInRange } from '../ecs/world';
import { enqueueAsteroidSpawn } from '../ecs/asteroidSpawnQueue';
import useGameStore from '../store/gameStore';
import { nextId } from '../utils/id';

function pickAsteroidType(): AsteroidType {
    const roll = Math.random();
    if (roll < 0.5) return 'swarmer';
    if (roll < 0.75) return 'tank';
    return 'splitter';
}

export default function AsteroidSpawner() {
    const origin = new THREE.Vector3(0, 0, 0);
    const spawnTimer = useRef(0);
    // Base spawn interval in seconds
    const currentInterval = useRef(2.0);
    const sessionId = useGameStore((state) => state.sessionId);

    useEffect(() => {
        spawnTimer.current = 0;
        currentInterval.current = 2.0;
    }, [sessionId]);

    useFrame((_, delta) => {
        if (useGameStore.getState().gameState !== 'playing') return;
        spawnTimer.current += delta;

        if (spawnTimer.current >= currentInterval.current) {
            spawnTimer.current = 0; // Reset timer

            // 1. Calculate how many asteroids are "in close proximity"
            const closeCount = countAsteroidsInRange(origin, 25);

            // 2. Adjust the spawnrate for the *next* spawn cycle
            // If < 3 asteroids are close, speed up spawning (lower interval bound to 0.5s)
            // If >= 3 asteroids are close, slow down spawning (higher interval up to 5s)
            if (closeCount < 3) {
                currentInterval.current = Math.max(0.5, currentInterval.current - 0.2);
            } else {
                currentInterval.current = Math.min(5.0, currentInterval.current + 1.0);
            }

            // 3. Actually spawn the next asteroid
            const radius = 40;
            const phi = Math.acos(-1 + (2 * Math.random()));
            const theta = Math.sqrt(radius * Math.PI) * phi;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = (radius * Math.sin(theta) * Math.sin(phi)) * 0.5;
            const z = radius * Math.cos(phi);

            enqueueAsteroidSpawn({ id: nextId(), pos: [x, y, z], type: pickAsteroidType() });
        }
    });

    return null;
}
