import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { Edges, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { ECS, GameEntity, AsteroidType } from '../ecs/world';
import useGameStore from '../store/gameStore';

interface AsteroidConfig {
    radius: number;
    speed: number;
    health: number;
    color: string;
    damage: number;
}

const ASTEROID_CONFIGS: Record<AsteroidType, AsteroidConfig> = {
    swarmer:  { radius: 0.8,  speed: 13, health: 40,  color: '#d4a843', damage: 5  },
    tank:     { radius: 3.0,  speed: 3,  health: 350, color: '#555555', damage: 30 },
    splitter: { radius: 1.5,  speed: 7,  health: 100, color: '#a855f7', damage: 10 },
};

interface AsteroidProps {
    id: string;
    startPos: [number, number, number];
    type: AsteroidType;
    onDestroy: (id: string, pos: [number, number, number], isHit: boolean, type: AsteroidType) => void;
}

export default function Asteroid({ id, startPos, type, onDestroy }: AsteroidProps) {
    const rbRef = useRef<RapierRigidBody>(null);
    const entityRef = useRef<GameEntity | null>(null);
    const destroyedRef = useRef(false);
    const tumbleRef = useRef({
        x: (Math.random() - 0.5) * 0.9,
        y: (Math.random() - 0.5) * 0.9,
        z: (Math.random() - 0.5) * 0.9,
    });
    const cfg = ASTEROID_CONFIGS[type];

    useEffect(() => {
        const entity = ECS.add({
            id,
            isAsteroid: true,
            position: new THREE.Vector3(...startPos),
            health: cfg.health,
            asteroidType: type,
        });
        entityRef.current = entity;
        return () => { ECS.remove(entity); };
    }, [id, startPos, type, cfg.health]);

    useFrame(() => {
        if (!rbRef.current || !entityRef.current || destroyedRef.current) return;

        const gameState = useGameStore.getState().gameState;
        if (gameState === 'gameover') {
            rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            rbRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
            return;
        }

        if (entityRef.current.health! <= 0) {
            destroyedRef.current = true;
            const t = rbRef.current.translation();
            onDestroy(id, [t.x, t.y, t.z], false, type);
            return;
        }

        const translation = rbRef.current.translation();

        // Sync Rapier position to ECS for Turrets to read
        entityRef.current.position!.set(translation.x, translation.y, translation.z);

        // Move Asteroid towards the center platform (0,0,0)
        const currentPos = new THREE.Vector3(translation.x, translation.y, translation.z);
        if (currentPos.length() <= 3) { // Hit the platform
            destroyedRef.current = true;
            useGameStore.getState().takeDamage(cfg.damage);
            onDestroy(id, [translation.x, translation.y, translation.z], true, type);
            return;
        }

        const dir = currentPos.clone().negate().normalize();
        rbRef.current.setLinvel({ x: dir.x * cfg.speed, y: dir.y * cfg.speed, z: dir.z * cfg.speed }, true);
        rbRef.current.setAngvel(tumbleRef.current, true);
    });

    return (
        <RigidBody ref={rbRef} position={startPos} type="dynamic" colliders={false} gravityScale={0} friction={0} linearDamping={0}>
            <BallCollider args={[cfg.radius]} />
            <Trail width={0.7} length={4} decay={1.2} stride={0.2} color={cfg.color} attenuation={(t) => t * t}>
                <mesh>
                    <dodecahedronGeometry args={[cfg.radius, 0]} />
                    <meshStandardMaterial color={cfg.color} flatShading />
                    <Edges scale={1} threshold={15} color="black" />
                </mesh>
            </Trail>
        </RigidBody>
    );
}
