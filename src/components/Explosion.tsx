import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AsteroidType } from '../ecs/world';

export const EXPLOSION_COLORS: Record<AsteroidType, string> = {
    swarmer: '#d4a843',
    tank: '#555555',
    splitter: '#a855f7',
};

const EMISSIVE_COLOR = new THREE.Color(10, 2, 0);

interface ParticleProps {
    startPos: [number, number, number];
    color: string;
    active: boolean;
}

const Particle = ({ startPos, color, active }: ParticleProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);
    const lifeRef = useRef(1.0);
    const velocityRef = useRef(new THREE.Vector3());

    useEffect(() => {
        if (active) {
            lifeRef.current = 1.0;
            velocityRef.current.set(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
            );
            if (meshRef.current) {
                meshRef.current.position.set(...startPos);
                meshRef.current.scale.setScalar(1);
            }
            if (materialRef.current) {
                materialRef.current.opacity = 1.0;
            }
        }
    }, [active, startPos]);

    useFrame((_, delta) => {
        if (!meshRef.current || !active || lifeRef.current <= 0) return;

        lifeRef.current -= delta * 1.5;

        if (lifeRef.current <= 0) {
            meshRef.current.scale.setScalar(0);
            return;
        }

        meshRef.current.position.addScaledVector(velocityRef.current, delta);
        meshRef.current.rotation.x += velocityRef.current.y * delta;
        meshRef.current.rotation.y += velocityRef.current.x * delta;

        meshRef.current.scale.setScalar(lifeRef.current);
        if (materialRef.current) {
            materialRef.current.opacity = lifeRef.current;
        }
    });

    return (
        <mesh ref={meshRef} position={startPos} visible={active}>
            <dodecahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial ref={materialRef} color={color} emissive={EMISSIVE_COLOR} toneMapped={false} flatShading transparent opacity={1} />
        </mesh>
    );
};

interface ExplosionProps {
    position: [number, number, number];
    type: AsteroidType;
    active: boolean;
}

export default function Explosion({ position, type, active }: ExplosionProps) {
    const blastLightRef = useRef<THREE.PointLight>(null);
    const lifeRef = useRef(1);

    const fragments = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({ id: i })), []);

    const color = EXPLOSION_COLORS[type] || '#ff6600';

    useEffect(() => {
        if (active) {
            lifeRef.current = 1.0;
        } else {
            if (blastLightRef.current) blastLightRef.current.intensity = 0;
        }
    }, [active]);

    useFrame((_, delta) => {
        if (!active) return;
        lifeRef.current = Math.max(0, lifeRef.current - delta * 1.6);
        if (blastLightRef.current) {
            blastLightRef.current.intensity = 7 * lifeRef.current;
            blastLightRef.current.position.set(...position);
        }
    });

    return (
        <group visible={active}>
            <pointLight ref={blastLightRef} position={position} color={color} intensity={0} distance={18} decay={2} />
            {fragments.map(frag => (
                <Particle key={frag.id} startPos={position} color={color} active={active} />
            ))}
        </group>
    );
}
