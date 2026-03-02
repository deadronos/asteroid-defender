import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// An individual piece of shrapnel
const Particle = ({ startPos, velocity }) => {
    const meshRef = useRef();
    const [scale, setScale] = useState(1);
    const lifeRef = useRef(1.0); // 1.0 down to 0.0

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        lifeRef.current -= delta * 1.5; // Controls how fast they fade/shrink

        if (lifeRef.current <= 0) {
            setScale(0); // Hide completely
            return;
        }

        // Move the fragment outward
        meshRef.current.position.add(velocity.clone().multiplyScalar(delta));

        // Spin the fragment randomly
        meshRef.current.rotation.x += velocity.y * delta;
        meshRef.current.rotation.y += velocity.x * delta;

        // Shrink as it dies
        setScale(lifeRef.current);
    });

    if (scale <= 0) return null;

    return (
        <mesh ref={meshRef} position={startPos} scale={scale}>
            <dodecahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial color="#888c8d" flatShading transparent opacity={lifeRef.current} />
        </mesh>
    );
};

export default function Explosion({ position }) {
    // Generate 8 random debris velocities once on mount
    const fragments = useMemo(() => {
        return Array.from({ length: 8 }).map((_, i) => {
            return {
                id: i,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 15, // X burst
                    (Math.random() - 0.5) * 15, // Y burst
                    (Math.random() - 0.5) * 15  // Z burst
                )
            };
        });
    }, []);

    return (
        <group>
            {fragments.map(frag => (
                <Particle key={frag.id} startPos={position} velocity={frag.velocity} />
            ))}
        </group>
    );
}
