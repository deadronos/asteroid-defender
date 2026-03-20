import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFrame } from '@react-three/fiber';
import CinematicCamera from './CinematicCamera';
import useGameStore from '../store/gameStore';
import { AsteroidType, updateSpatialIndex } from '../ecs/world';
import Platform from './Platform';
import Turret from './Turret';
import Asteroid from './Asteroid';
import AsteroidSpawner from './AsteroidSpawner';
import Explosion from './Explosion';
import { clearAsteroidSpawns, drainAsteroidSpawns } from '../ecs/asteroidSpawnQueue';
import { nextId } from '../utils/id';
import type { EffectsQuality } from '../utils/visualQuality';

// Lazy-load the cosmetic background so core gameplay geometry renders first.
const SpaceBackground = lazy(() => import('./SpaceBackground'));

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

// Pool of pre-mounted Asteroid components. Inactive entries are parked off-screen
// so Rapier does not simulate them. Increase this value if waves grow beyond 60
// simultaneous asteroids; see Asteroid.tsx for a full explanation of the chosen
// per-component rendering strategy.
const POOL_SIZE = 60;

interface GameSceneProps {
    asteroidEffectsQuality: EffectsQuality;
}

export default function GameScene({ asteroidEffectsQuality }: GameSceneProps) {
    const [asteroids, setAsteroids] = useState<PooledAsteroid[]>(() =>
        Array.from({ length: POOL_SIZE }).map(() => ({
            id: nextId(),
            active: false,
            pos: [0, -1000, 0],
            type: 'swarmer'
        }))
    );

    const [explosions, setExplosions] = useState<PooledExplosion[]>(() =>
        Array.from({ length: POOL_SIZE }).map(() => ({
            id: nextId(),
            active: false,
            pos: [0, -1000, 0],
            type: 'swarmer'
        }))
    );

    const [shieldImpacts, setShieldImpacts] = useState<ShieldImpactData[]>([]);

    const explosionsRef = useRef<PooledExplosion[]>([]);

    const { incrementDestroyed, setActiveAsteroids } = useGameStore(
        useShallow((state) => ({
            incrementDestroyed: state.incrementDestroyed,
            setActiveAsteroids: state.setActiveAsteroids,
        }))
    );

    useEffect(() => {
        explosionsRef.current = explosions;
    }, [explosions]);

    const clearExplosionTimers = useCallback((pool: PooledExplosion[]) => {
        for (const explosion of pool) {
            if (explosion.timer) {
                clearTimeout(explosion.timer);
            }
        }
    }, []);

    useEffect(() => {
        clearAsteroidSpawns();

        return () => {
            clearAsteroidSpawns();
            clearExplosionTimers(explosionsRef.current);
        };
    }, [clearExplosionTimers]);

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
        updateSpatialIndex();
        if (useGameStore.getState().gameState !== 'playing') return;

        const spawns = drainAsteroidSpawns();
        if (spawns.length > 0) {
            setAsteroids(prev => {
                const newAsteroids = [...prev];
                let modified = false;
                let nextAvailableIdx = 0;
                for (const ast of spawns) {
                    while (nextAvailableIdx < newAsteroids.length && newAsteroids[nextAvailableIdx].active) {
                        nextAvailableIdx++;
                    }
                    if (nextAvailableIdx < newAsteroids.length) {
                        newAsteroids[nextAvailableIdx] = {
                            ...newAsteroids[nextAvailableIdx],
                            active: true,
                            pos: ast.pos,
                            type: ast.type
                        };
                        modified = true;
                        nextAvailableIdx++;
                    } else {
                        break;
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
            const impactId = nextId();
            setShieldImpacts(prev => [...prev, { id: impactId, pos }]);
            setTimeout(() => {
                setShieldImpacts(prev => prev.filter(impact => impact.id !== impactId));
            }, 900);
        }

        setAsteroids(prev => {
            const nextAsteroids = [...prev];

            const idx = nextAsteroids.findIndex(ast => ast.id === id);
            if (idx !== -1) {
                nextAsteroids[idx] = { ...nextAsteroids[idx], active: false };
            }

            // Splitters spawn two swarmer fragments when destroyed by turrets
            if (type === 'splitter' && !isBaseHit) {
                const offset = 2.0;
                let splitsLeft = 2;
                for (let i = 0; i < nextAsteroids.length && splitsLeft > 0; i++) {
                    if (!nextAsteroids[i].active) {
                        nextAsteroids[i] = {
                            ...nextAsteroids[i],
                            active: true,
                            type: 'swarmer',
                            pos: [pos[0] + (splitsLeft === 2 ? offset : -offset), pos[1], pos[2]]
                        };
                        splitsLeft--;
                    }
                }
            }

            return nextAsteroids;
        });

        triggerExplosion(pos, type);
    }, [incrementDestroyed, triggerExplosion]);

    // Sync asteroid count with global store to avoid updating during another component's render
    useEffect(() => {
        let activeCount = 0;
        for (let i = 0; i < asteroids.length; i++) {
            if (asteroids[i].active) activeCount++;
        }
        setActiveAsteroids(activeCount);
    }, [asteroids, setActiveAsteroids]);

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <Suspense fallback={null}>
                <SpaceBackground />
            </Suspense>
            <CinematicCamera />

            <AsteroidSpawner />

            <Platform shieldImpacts={shieldImpacts} />

            <Turret id="t1" position={[5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t2" position={[-5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t3" position={[5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <Turret id="t4" position={[-5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />

            {asteroids.map(ast => (
                <Asteroid
                    key={ast.id}
                    id={ast.id}
                    startPos={ast.pos}
                    type={ast.type}
                    active={ast.active}
                    effectsQuality={asteroidEffectsQuality}
                    onDestroy={handleDestroy}
                />
            ))}

            {explosions.map(exp => (
                <Explosion key={exp.id} position={exp.pos} type={exp.type} active={exp.active} />
            ))}
        </>
    );
}
