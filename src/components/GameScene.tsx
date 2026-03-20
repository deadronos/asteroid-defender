import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
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
import type { EffectsQuality } from '../utils/visualQuality';
import {
    activateQueuedAsteroids,
    countActiveItems,
    createAsteroidPool,
    deactivateAsteroid,
    type PooledAsteroid,
    spawnSplitterFragments,
} from './gameScene/pools';
import { useExplosionPool } from './gameScene/useExplosionPool';
import { useShieldImpacts } from './gameScene/useShieldImpacts';

// Lazy-load the cosmetic background so core gameplay geometry renders first.
const SpaceBackground = lazy(() => import('./SpaceBackground'));

// Pool of pre-mounted Asteroid components. Inactive entries are parked off-screen
// so Rapier does not simulate them. Increase this value if waves grow beyond 60
// simultaneous asteroids; see Asteroid.tsx for a full explanation of the chosen
// per-component rendering strategy.
const POOL_SIZE = 60;

interface GameSceneProps {
    asteroidEffectsQuality: EffectsQuality;
    backgroundEffectsQuality: EffectsQuality;
    reducedMotion: boolean;
}

export default function GameScene({ asteroidEffectsQuality, backgroundEffectsQuality, reducedMotion }: GameSceneProps) {
    const [asteroids, setAsteroids] = useState<PooledAsteroid[]>(() => createAsteroidPool(POOL_SIZE));
    const { explosions, triggerExplosion } = useExplosionPool(POOL_SIZE);
    const { shieldImpacts, addShieldImpact } = useShieldImpacts();

    const { incrementDestroyed, setActiveAsteroids } = useGameStore(
        useShallow((state) => ({
            incrementDestroyed: state.incrementDestroyed,
            setActiveAsteroids: state.setActiveAsteroids,
        }))
    );

    useEffect(() => {
        clearAsteroidSpawns();

        return () => {
            clearAsteroidSpawns();
        };
    }, []);

    useFrame(() => {
        updateSpatialIndex();
        if (useGameStore.getState().gameState !== 'playing') return;

        const spawns = drainAsteroidSpawns();
        if (spawns.length > 0) {
            setAsteroids((prev) => activateQueuedAsteroids(prev, spawns));
        }
    });

    const handleDestroy = useCallback((id: string, pos: [number, number, number], isBaseHit = false, type: AsteroidType) => {
        if (!isBaseHit) {
            incrementDestroyed();
        } else {
            addShieldImpact(pos);
        }

        setAsteroids((prev) => {
            const withoutDestroyed = deactivateAsteroid(prev, id);
            if (type === 'splitter' && !isBaseHit) {
                return spawnSplitterFragments(withoutDestroyed, pos);
            }

            return withoutDestroyed;
        });

        triggerExplosion(pos, type);
    }, [addShieldImpact, incrementDestroyed, triggerExplosion]);

    // Sync asteroid count with global store to avoid updating during another component's render
    useEffect(() => {
        setActiveAsteroids(countActiveItems(asteroids));
    }, [asteroids, setActiveAsteroids]);

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <Suspense fallback={null}>
                <SpaceBackground quality={backgroundEffectsQuality} reducedMotion={reducedMotion} />
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
