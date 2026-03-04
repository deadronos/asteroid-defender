import { useState, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import CinematicCamera from './CinematicCamera';
import SpaceBackground from './SpaceBackground';
import useGameStore from '../store/gameStore';
import { AsteroidType } from '../ecs/world';
import Platform from './Platform';
import Turret from './Turret';
import Asteroid from './Asteroid';
import AsteroidSpawner from './AsteroidSpawner';
import Explosion from './Explosion';
import { v4 as uuidv4 } from 'uuid';
import { drainAsteroidSpawns } from '../ecs/asteroidSpawnQueue';

interface PooledAsteroid {
    id: string;
    active: boolean;
    pos: [number, number, number];
    type: AsteroidType;
}

interface PooledExplosion {
    id: string;
    active: boolean;
    pos: [number, number, number];
    type: AsteroidType;
    timer?: ReturnType<typeof setTimeout>;
}

interface ShieldImpactData {
    id: string;
    pos: [number, number, number];
}

const POOL_SIZE = 60;

export default function GameScene() {
    const [asteroids, setAsteroids] = useState<PooledAsteroid[]>(() =>
        Array.from({ length: POOL_SIZE }).map(() => ({
            id: uuidv4(),
            active: false,
            pos: [0, -1000, 0],
            type: 'swarmer'
        }))
    );

    const [explosions, setExplosions] = useState<PooledExplosion[]>(() =>
        Array.from({ length: POOL_SIZE }).map(() => ({
            id: uuidv4(),
            active: false,
            pos: [0, -1000, 0],
            type: 'swarmer'
        }))
    );

    const [shieldImpacts, setShieldImpacts] = useState<ShieldImpactData[]>([]);

    const { incrementDestroyed, setActiveAsteroids } = useGameStore();

    const triggerExplosion = useCallback((pos: [number, number, number], type: AsteroidType) => {
        setExplosions(prev => {
            const nextIdx = prev.findIndex(e => !e.active);
            if (nextIdx === -1) return prev;

            const newExplosions = [...prev];
            const e = newExplosions[nextIdx];

            if (e.timer) clearTimeout(e.timer);

            newExplosions[nextIdx] = {
                ...e,
                active: true,
                pos,
                type,
                timer: setTimeout(() => {
                    setExplosions(curr => curr.map((x, i) => i === nextIdx ? { ...x, active: false } : x));
                }, 1000)
            };
            return newExplosions;
        });
    }, []);

    useFrame(() => {
        const spawns = drainAsteroidSpawns();
        if (spawns.length > 0) {
            setAsteroids(prev => {
                const newAsteroids = [...prev];
                let modified = false;
                for (const ast of spawns) {
                    const nextIdx = newAsteroids.findIndex(a => !a.active);
                    if (nextIdx !== -1) {
                        newAsteroids[nextIdx] = { ...newAsteroids[nextIdx], active: true, pos: ast.pos, type: ast.type };
                        modified = true;
                    }
                }
                return modified ? newAsteroids : prev;
            });
        }
    });

    const handleDestroy = useCallback((id: string, pos: [number, number, number], isBaseHit = false, type: AsteroidType) => {
        if (!isBaseHit) {
            incrementDestroyed();
        } else {
            const impactId = uuidv4();
            setShieldImpacts(prev => [...prev, { id: impactId, pos }]);
            setTimeout(() => {
                setShieldImpacts(prev => prev.filter(impact => impact.id !== impactId));
            }, 900);
        }

        setAsteroids(prev => {
            let nextPrev = prev;

            const idx = prev.findIndex(ast => ast.id === id);
            if (idx !== -1) {
                const newAsteroids = [...prev];
                newAsteroids[idx] = { ...newAsteroids[idx], active: false };
                nextPrev = newAsteroids;
            }

            // Splitters spawn two swarmer fragments when destroyed by turrets
            if (type === 'splitter' && !isBaseHit) {
                const offset = 2.0;
                let splitsLeft = 2;
                for (let i = 0; i < nextPrev.length && splitsLeft > 0; i++) {
                    if (!nextPrev[i].active) {
                        const newSpawn = [...nextPrev];
                        newSpawn[i] = {
                            ...newSpawn[i],
                            active: true,
                            type: 'swarmer',
                            pos: [pos[0] + (splitsLeft === 2 ? offset : -offset), pos[1], pos[2]]
                        };
                        nextPrev = newSpawn;
                        splitsLeft--;
                    }
                }
            }

            return nextPrev;
        });

        triggerExplosion(pos, type);
    }, [incrementDestroyed, triggerExplosion]);

    // Sync asteroid count with global store to avoid updating during another component's render
    useEffect(() => {
        const activeCount = asteroids.filter(a => a.active).length;
        setActiveAsteroids(activeCount);
    }, [asteroids, setActiveAsteroids]);

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <SpaceBackground />
            <CinematicCamera />

            <AsteroidSpawner />

            <Platform shieldImpacts={shieldImpacts} />

            <Turret id="t1" position={[5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t2" position={[-5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t3" position={[5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <Turret id="t4" position={[-5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />

            {asteroids.map(ast => (
                <Asteroid key={ast.id} id={ast.id} startPos={ast.pos} type={ast.type} active={ast.active} onDestroy={handleDestroy} />
            ))}

            {explosions.map(exp => (
                <Explosion key={exp.id} position={exp.pos} type={exp.type} active={exp.active} />
            ))}
        </>
    );
}
