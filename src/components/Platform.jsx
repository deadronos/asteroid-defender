import React from 'react';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { Edges } from '@react-three/drei';

export default function Platform() {
    return (
        <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1, 12]} />
            <mesh receiveShadow>
                <cylinderGeometry args={[12, 12, 2, 16]} />
                <meshStandardMaterial color="#888c8d" flatShading />
                {/* Outlines overlay for the stylized look */}
                <Edges scale={1} threshold={15} color="black" />
            </mesh>
        </RigidBody>
    );
}
