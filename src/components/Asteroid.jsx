import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider } from '@react-three/rapier';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { ECS } from '../ecs/world';

export default function Asteroid({ id, startPos, onDestroy }) {
    const rbRef = useRef();
    const entityRef = useRef(null);
    const destroyedRef = useRef(false);

    useEffect(() => {
        entityRef.current = ECS.add({
            id,
            isAsteroid: true,
            position: new THREE.Vector3(...startPos),
            health: 100
        });
        return () => ECS.remove(entityRef.current);
    }, [id, startPos]);

    useFrame(() => {
        if (!rbRef.current || !entityRef.current || destroyedRef.current) return;

        if (entityRef.current.health <= 0) {
            destroyedRef.current = true;
            const t = rbRef.current.translation();
            onDestroy(id, [t.x, t.y, t.z]);
            return;
        }

        const translation = rbRef.current.translation();

        // Sync Rapier position to ECS for Turrets to read
        entityRef.current.position.set(translation.x, translation.y, translation.z);

        // Move Asteroid towards the center platform (0,0,0)
        const currentPos = new THREE.Vector3(translation.x, translation.y, translation.z);
        if (currentPos.length() > 3) { // Stop pushing if it's hitting the platform
            const dir = currentPos.clone().negate().normalize();
            const speed = 8;
            rbRef.current.setLinvel({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, true);
        }
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
