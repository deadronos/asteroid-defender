import { useCallback, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STREAK_FRAG, STREAK_VERT } from './shaders';

interface ShootingStarProps {
    onComplete: () => void;
}

function createShootingStarTrajectory() {
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() * 0.6 + 0.2) * Math.PI;
    const r = 90;
    const startPos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
    );
    const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0).normalize();
    const speed = 28 + Math.random() * 22;
    const velocity = tangent.clone().multiplyScalar(speed);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    return { startPos, velocity, quaternion };
}

function ShootingStar({ onComplete }: ShootingStarProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const lifeRef = useRef(0);
    const doneRef = useRef(false);
    const uniforms = useMemo(() => ({ uOpacity: { value: 0 } }), []);
    const [{ startPos, velocity, quaternion }] = useState(createShootingStarTrajectory);

    useFrame((_, delta) => {
        if (!meshRef.current || doneRef.current) return;
        lifeRef.current += delta;
        const duration = 1.8;
        const t = lifeRef.current / duration;

        if (t >= 1) {
            doneRef.current = true;
            onComplete();
            return;
        }

        meshRef.current.position
            .copy(startPos)
            .addScaledVector(velocity, lifeRef.current);

        if (matRef.current) {
            matRef.current.uniforms.uOpacity.value = Math.sin(t * Math.PI) * 0.9;
        }
    });

    return (
        <mesh ref={meshRef} position={startPos} quaternion={quaternion}>
            <boxGeometry args={[0.07, 0.07, 5]} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={STREAK_VERT}
                fragmentShader={STREAK_FRAG}
                transparent
                depthWrite={false}
            />
        </mesh>
    );
}

export default function ShootingStars() {
    const [activeStars, setActiveStars] = useState<number[]>([]);
    const [initialSpawnDelay] = useState(() => 3 + Math.random() * 5);
    const timerRef = useRef(0);
    const nextSpawnRef = useRef(initialSpawnDelay);
    const counterRef = useRef(0);

    useFrame((_, delta) => {
        timerRef.current += delta;
        if (timerRef.current >= nextSpawnRef.current) {
            timerRef.current = 0;
            nextSpawnRef.current = 6 + Math.random() * 10;
            const id = counterRef.current;
            counterRef.current = (counterRef.current + 1) % 1e9;
            setActiveStars((prev) => [...prev, id]);
        }
    });

    const removeStar = useCallback((id: number) => {
        setActiveStars((prev) => prev.filter((starId) => starId !== id));
    }, []);

    return (
        <>
            {activeStars.map((id) => (
                <ShootingStar key={id} onComplete={() => removeStar(id)} />
            ))}
        </>
    );
}
