import { useState, useCallback } from 'react';
import { Stars, OrbitControls } from '@react-three/drei';
import useGameStore from '../store/gameStore';
import { AsteroidType } from '../ecs/world';
import Platform from './Platform';
import Turret from './Turret';
import Asteroid from './Asteroid';
import AsteroidSpawner from './AsteroidSpawner';
import Explosion from './Explosion';
import { v4 as uuidv4 } from 'uuid';
import { SpawnData } from './AsteroidSpawner';

interface ExplosionData {
    id: string;
    pos: [number, number, number];
    type: AsteroidType;
}

export default function GameScene() {
    const [asteroids, setAsteroids] = useState<SpawnData[]>([]);
    const [explosions, setExplosions] = useState<ExplosionData[]>([]);

    const { incrementDestroyed, setActiveAsteroids } = useGameStore();

    const handleSpawn = useCallback((ast: SpawnData) => {
        setAsteroids(prev => {
            const newAsteroids = [...prev, ast];
            setActiveAsteroids(newAsteroids.length);
            return newAsteroids;
        });
    }, [setActiveAsteroids]);

    const handleDestroy = useCallback((id: string, pos: [number, number, number], isBaseHit = false, type: AsteroidType) => {
        if (!isBaseHit) {
            incrementDestroyed();
        }
        setAsteroids(prev => {
            let newAsteroids = prev.filter(ast => ast.id !== id);

            // Splitters spawn two swarmer fragments when destroyed by turrets
            if (type === 'splitter' && !isBaseHit) {
                const offset = 2.0;
                newAsteroids = [
                    ...newAsteroids,
                    { id: uuidv4(), pos: [pos[0] + offset, pos[1], pos[2]], type: 'swarmer' },
                    { id: uuidv4(), pos: [pos[0] - offset, pos[1], pos[2]], type: 'swarmer' },
                ];
            }

            setActiveAsteroids(newAsteroids.length);
            return newAsteroids;
        });

        // Spawn explosion and queue it for unmount after 1 second
        const expId = uuidv4();
        setExplosions(prev => [...prev, { id: expId, pos, type }]);
        setTimeout(() => {
            setExplosions(prev => prev.filter(exp => exp.id !== expId));
        }, 1000);
    }, [incrementDestroyed, setActiveAsteroids]);

    return (
        <>
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />

            <AsteroidSpawner onSpawn={handleSpawn} />

            <Platform />

            <Turret id="t1" position={[5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t2" position={[-5, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            <Turret id="t3" position={[5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <Turret id="t4" position={[-5, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />

            {asteroids.map(ast => (
                <Asteroid key={ast.id} id={ast.id} startPos={ast.pos} type={ast.type} onDestroy={handleDestroy} />
            ))}

            {explosions.map(exp => (
                <Explosion key={exp.id} position={exp.pos} type={exp.type} />
            ))}
        </>
    );
}
