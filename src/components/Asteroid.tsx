import { useRef, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { Edges, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { ECS, GameEntity, AsteroidType } from '../ecs/world';
import useGameStore from '../store/gameStore';

const tempVec = new THREE.Vector3();
const tempDir = new THREE.Vector3();

interface AsteroidConfig {
    radius: number;
    speed: number;
    health: number;
    color: string;
    damage: number;
}

const ASTEROID_CONFIGS: Record<AsteroidType, AsteroidConfig> = {
    swarmer: { radius: 0.8, speed: 13, health: 40, color: '#d4a843', damage: 5 },
    tank: { radius: 3.0, speed: 3, health: 350, color: '#555555', damage: 30 },
    splitter: { radius: 1.5, speed: 7, health: 100, color: '#a855f7', damage: 10 },
};

interface AsteroidProps {
    id: string;
    startPos: [number, number, number];
    type: AsteroidType;
    active: boolean; // Pooling: Object avoids physics/rendering workloads when inactive
    onDestroy: (id: string, pos: [number, number, number], isHit: boolean, type: AsteroidType) => void;
}

function Asteroid({ id, startPos, type, active, onDestroy }: AsteroidProps) {
    const rbRef = useRef<RapierRigidBody>(null);
    const entityRef = useRef<GameEntity | null>(null);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    // Pooling: Instead of re-mounting, randomize values manually
    const tumbleRef = useRef({
        x: (Math.random() - 0.5) * 0.9,
        y: (Math.random() - 0.5) * 0.9,
        z: (Math.random() - 0.5) * 0.9,
    });

    const prevHealthRef = useRef(0);
    const flashTimerRef = useRef(0);
    const isFirstActiveFrameRef = useRef(false);

    const cfg = ASTEROID_CONFIGS[type] || ASTEROID_CONFIGS['swarmer'];

    useEffect(() => {
        if (active) {
            const entity = ECS.add({
                id,
                isAsteroid: true,
                position: new THREE.Vector3(...startPos),
                health: cfg.health,
                asteroidType: type,
            });
            entityRef.current = entity;

            // Re-teleport and reset velocity when pulled from pool
            if (rbRef.current) {
                rbRef.current.setTranslation({ x: startPos[0], y: startPos[1], z: startPos[2] }, true);

                tempVec.set(startPos[0], startPos[1], startPos[2]);
                tempDir.copy(tempVec).negate().normalize();
                rbRef.current.setLinvel({ x: tempDir.x * cfg.speed, y: tempDir.y * cfg.speed, z: tempDir.z * cfg.speed }, true);
                rbRef.current.setAngvel({
                    x: (Math.random() - 0.5) * 0.9,
                    y: (Math.random() - 0.5) * 0.9,
                    z: (Math.random() - 0.5) * 0.9,
                }, true);
            }
            prevHealthRef.current = cfg.health;
            flashTimerRef.current = 0;
            isFirstActiveFrameRef.current = true;

            tumbleRef.current = {
                x: (Math.random() - 0.5) * 0.9,
                y: (Math.random() - 0.5) * 0.9,
                z: (Math.random() - 0.5) * 0.9,
            };
        } else {
            // Un-pool into storage
            if (entityRef.current) {
                ECS.remove(entityRef.current);
                entityRef.current = null;
            }
            if (rbRef.current) {
                // Teleport physically far beneath bounds to stop constraints overlapping
                rbRef.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
                rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                rbRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
            }
            if (materialRef.current) {
                materialRef.current.emissive.setHex(0x000000);
            }
        }

        return () => {
            if (entityRef.current) {
                ECS.remove(entityRef.current);
            }
        };
        // Only re-trigger pooling setup when `active` alters, not when positions rapidly shift upstream.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, id, type, cfg.health]);

    useFrame((_, delta) => {
        if (!rbRef.current || !entityRef.current || !active) return;

        // Let the first frame pass to apply translation before moving towards center so Trail starts smooth
        if (isFirstActiveFrameRef.current) {
            isFirstActiveFrameRef.current = false;
            return;
        }

        const gameState = useGameStore.getState().gameState;
        if (gameState !== 'playing') return;

        // Hit flash logic
        if (entityRef.current.health! < prevHealthRef.current) {
            flashTimerRef.current = 0.1;
        }
        prevHealthRef.current = entityRef.current.health!;

        if (flashTimerRef.current > 0) {
            flashTimerRef.current -= delta;
            if (materialRef.current) {
                materialRef.current.emissive.setHex(0xffffff);
                materialRef.current.emissiveIntensity = 2.0;
            }
            if (flashTimerRef.current <= 0 && materialRef.current) {
                materialRef.current.emissive.setHex(0x000000);
            }
        }

        if (entityRef.current.health! <= 0) {
            const t = rbRef.current.translation();
            onDestroy(id, [t.x, t.y, t.z], false, type);
            return;
        }

        const translation = rbRef.current.translation();

        // Sync Rapier position to ECS for Turrets to read
        entityRef.current.position!.set(translation.x, translation.y, translation.z);

        // Move Asteroid towards the center platform (0,0,0)
        tempVec.set(translation.x, translation.y, translation.z);
        if (tempVec.lengthSq() <= 9) { // Hit the platform
            useGameStore.getState().takeDamage(cfg.damage);
            onDestroy(id, [translation.x, translation.y, translation.z], true, type);
            return;
        }
    });

    return (
        <RigidBody ref={rbRef} position={startPos} type="dynamic" colliders={false} gravityScale={0} friction={0} linearDamping={0}>
            <BallCollider args={[cfg.radius]} />
            {active && (
                <Trail width={0.7} length={4} decay={1.2} stride={0.2} color={cfg.color} attenuation={(t) => t * t}>
                    <mesh>
                        <dodecahedronGeometry args={[cfg.radius, 0]} />
                        <meshStandardMaterial ref={materialRef} color={cfg.color} flatShading />
                        <Edges scale={1} threshold={15} color="black" />
                    </mesh>
                </Trail>
            )}
        </RigidBody>
    );
}

export default memo(Asteroid);
