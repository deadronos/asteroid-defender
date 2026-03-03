import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AsteroidType } from '../ecs/world';

export const EXPLOSION_COLORS: Record<AsteroidType, string> = {
    swarmer: '#d4a843',
    tank: '#555555',
    splitter: '#a855f7',
};

interface ParticleProps {
    startPos: [number, number, number];
    velocity: THREE.Vector3;
    color: string;
}

// An individual piece of shrapnel
const Particle = ({ startPos, velocity, color }: ParticleProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [scale, setScale] = useState(1);
    const lifeRef = useRef(1.0); // 1.0 down to 0.0

    useFrame((_, delta) => {
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
            <meshStandardMaterial color={color} emissive={new THREE.Color(10, 2, 0)} toneMapped={false} flatShading transparent opacity={lifeRef.current} />
        </mesh>
    );
};

interface ExplosionProps {
    position: [number, number, number];
    type: AsteroidType;
}

export default function Explosion({ position, type }: ExplosionProps) {
    const blastLightRef = useRef<THREE.PointLight>(null);
    const lifeRef = useRef(1);

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

    const color = EXPLOSION_COLORS[type] || '#ff6600';

    useFrame((_, delta) => {
        lifeRef.current = Math.max(0, lifeRef.current - delta * 1.6);
        if (blastLightRef.current) {
            blastLightRef.current.intensity = 7 * lifeRef.current;
        }
    });

    return (
        <group>
            <pointLight ref={blastLightRef} position={position} color={color} intensity={7} distance={18} decay={2} />
            {fragments.map(frag => (
                <Particle key={frag.id} startPos={position} velocity={frag.velocity} color={color} />
            ))}
        </group>
    );
}
