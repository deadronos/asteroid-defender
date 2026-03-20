import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function createSpaceDustData(count: number) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
        velocities[i * 3] = (Math.random() - 0.5) * 0.25;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
    }

    return { positions, velocities };
}

interface SpaceDustProps {
    count: number;
    animate: boolean;
}

export default function SpaceDust({ count, animate }: SpaceDustProps) {
    const pointsRef = useRef<THREE.Points>(null);
    const { positions, velocities } = useMemo(() => createSpaceDustData(count), [count]);

    useEffect(() => {
        if (!pointsRef.current) {
            return;
        }

        const geometry = pointsRef.current.geometry;
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }, [positions]);

    useFrame((_, delta) => {
        if (!pointsRef.current || !animate) return;
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
            pos[i * 3] += velocities[i * 3] * delta;
            pos[i * 3 + 1] += velocities[i * 3 + 1] * delta;
            pos[i * 3 + 2] += velocities[i * 3 + 2] * delta;
            for (let j = 0; j < 3; j++) {
                if (pos[i * 3 + j] > 25) pos[i * 3 + j] = -25;
                if (pos[i * 3 + j] < -25) pos[i * 3 + j] = 25;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    if (count === 0) {
        return null;
    }

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                size={0.06}
                color="#a8caff"
                transparent
                opacity={0.35}
                sizeAttenuation
                depthWrite={false}
            />
        </points>
    );
}
