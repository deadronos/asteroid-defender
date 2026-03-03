import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { ECS, GameEntity } from '../ecs/world';
import useGameStore from '../store/gameStore';

interface AsteroidProps {
    id: string;
    startPos: [number, number, number];
    onDestroy: (id: string, pos: [number, number, number], isHit: boolean) => void;
}

export default function Asteroid({ id, startPos, onDestroy }: AsteroidProps) {
    const rbRef = useRef<RapierRigidBody>(null);
    const entityRef = useRef<GameEntity | null>(null);
    const destroyedRef = useRef(false);

    useEffect(() => {
        const entity = ECS.add({
            id,
            isAsteroid: true,
            position: new THREE.Vector3(...startPos),
            health: 100
        });
        entityRef.current = entity;
        return () => { ECS.remove(entity); };
    }, [id, startPos]);

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
            onDestroy(id, [t.x, t.y, t.z], false);
            return;
        }

        const translation = rbRef.current.translation();

        // Sync Rapier position to ECS for Turrets to read
        entityRef.current.position!.set(translation.x, translation.y, translation.z);

        // Move Asteroid towards the center platform (0,0,0)
        const currentPos = new THREE.Vector3(translation.x, translation.y, translation.z);
        if (currentPos.length() <= 3) { // Hit the platform
            destroyedRef.current = true;
            useGameStore.getState().takeDamage(10);
            onDestroy(id, [translation.x, translation.y, translation.z], true);
            return;
        }

        const dir = currentPos.clone().negate().normalize();
        const speed = 8;
        rbRef.current.setLinvel({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, true);
    });

    return (
        <RigidBody ref={rbRef} position={startPos} type="dynamic" colliders={false} gravityScale={0} friction={0} linearDamping={0}>
            <BallCollider args={[1.5]} />
            <mesh>
                <dodecahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial color="#b3b3b3" flatShading />
                <Edges scale={1} threshold={15} color="black" />
            </mesh>
        </RigidBody>
    );
}
