import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── Nebula Backdrop ────────────────────────────────────────────────────────

const NEBULA_VERTEX = `
    varying vec3 vPos;
    void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const NEBULA_FRAGMENT = `
    uniform float uTime;
    varying vec3 vPos;

    float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
    }

    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(
                mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
            ),
            mix(
                mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
            ),
            f.z
        );
    }

    float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
            v += a * noise(p);
            p = p * 2.1 + vec3(1.7, 9.2, 3.3);
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec3 p = normalize(vPos) * 4.0;
        float t = uTime * 0.004;

        float n1 = fbm(p + vec3(t, t * 0.7, t * 0.4));
        float n2 = fbm(p * 1.3 - vec3(t * 0.5, t, t * 0.2));
        float shape = smoothstep(0.3, 0.7, n1 * n2 * 2.0);

        vec3 deepBlue    = vec3(0.02, 0.04, 0.18);
        vec3 nebulaPurple = vec3(0.15, 0.03, 0.25);
        vec3 nebulaTeal  = vec3(0.02, 0.12, 0.20);
        vec3 nebulaRed   = vec3(0.20, 0.04, 0.08);

        float band = fbm(p * 0.4 + vec3(5.3, 2.1, 1.1));
        vec3 col = mix(mix(deepBlue, nebulaPurple, n1), mix(nebulaTeal, nebulaRed, n2), band);
        col += vec3(0.06, 0.02, 0.14) * shape * 2.5;

        float alpha = (0.22 + shape * 0.28) * 0.85;
        gl_FragColor = vec4(col, alpha);
    }
`;

function Nebula() {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

    useFrame((_, delta) => {
        if (matRef.current) {
            // Keep uTime bounded to avoid floating-point precision loss over long sessions
            matRef.current.uniforms.uTime.value = (matRef.current.uniforms.uTime.value + delta) % 1000.0;
        }
    });

    return (
        <mesh>
            <sphereGeometry args={[185, 32, 32]} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={NEBULA_VERTEX}
                fragmentShader={NEBULA_FRAGMENT}
                side={THREE.BackSide}
                transparent
                depthWrite={false}
            />
        </mesh>
    );
}

// ─── Space Dust ─────────────────────────────────────────────────────────────

const DUST_COUNT = 400;

function SpaceDust() {
    const pointsRef = useRef<THREE.Points>(null);

    const { positions, velocities } = useMemo(() => {
        const positions = new Float32Array(DUST_COUNT * 3);
        const velocities = new Float32Array(DUST_COUNT * 3);
        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
            velocities[i * 3] = (Math.random() - 0.5) * 0.25;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        }
        return { positions, velocities };
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current) return;
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < DUST_COUNT; i++) {
            pos[i * 3] += velocities[i * 3] * delta;
            pos[i * 3 + 1] += velocities[i * 3 + 1] * delta;
            pos[i * 3 + 2] += velocities[i * 3 + 2] * delta;
            // Wrap particles that drift too far back to the other side
            for (let j = 0; j < 3; j++) {
                if (pos[i * 3 + j] > 25) pos[i * 3 + j] = -25;
                if (pos[i * 3 + j] < -25) pos[i * 3 + j] = 25;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

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

// ─── Shooting Stars ──────────────────────────────────────────────────────────

interface ShootingStarProps {
    onComplete: () => void;
}

const STREAK_VERT = `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STREAK_FRAG = `uniform float uOpacity; void main() { gl_FragColor = vec4(0.87, 0.93, 1.0, uOpacity); }`;

function ShootingStar({ onComplete }: ShootingStarProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const lifeRef = useRef(0);
    const doneRef = useRef(false);
    // Shader uniform updated directly each frame — no material property mutation
    const uniforms = useMemo(() => ({ uOpacity: { value: 0 } }), []);

    const { startPos, velocity, quaternion } = useMemo(() => {
        // Place the start point on a background sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() * 0.6 + 0.2) * Math.PI;
        const r = 90;
        const startPos = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
        );
        // Velocity tangential to the sphere so the streak crosses the sky
        const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0).normalize();
        const speed = 28 + Math.random() * 22;
        const velocity = tangent.clone().multiplyScalar(speed);

        // Orient the streak mesh along the velocity direction
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

        return { startPos, velocity, quaternion };
    }, []);

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

        // Update opacity via uniform — avoids per-frame material property mutation
        if (matRef.current) {
            matRef.current.uniforms.uOpacity.value = Math.sin(t * Math.PI) * 0.9;
        }
    });

    return (
        <mesh ref={meshRef} position={startPos} quaternion={quaternion}>
            {/* Elongated box acts as a bright streak / comet tail */}
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

function ShootingStars() {
    const [activeStars, setActiveStars] = useState<number[]>([]);
    const timerRef = useRef(0);
    const nextSpawnRef = useRef(3 + Math.random() * 5);
    const counterRef = useRef(0);

    useFrame((_, delta) => {
        timerRef.current += delta;
        if (timerRef.current >= nextSpawnRef.current) {
            timerRef.current = 0;
            nextSpawnRef.current = 6 + Math.random() * 10; // every 6–16 s
            const id = counterRef.current;
            counterRef.current = (counterRef.current + 1) % 1e9; // prevent integer overflow
            setActiveStars(prev => [...prev, id]);
        }
    });

    const removeStar = useCallback((id: number) => {
        setActiveStars(prev => prev.filter(s => s !== id));
    }, []);

    return (
        <>
            {activeStars.map(id => (
                <ShootingStar key={id} onComplete={() => removeStar(id)} />
            ))}
        </>
    );
}

// ─── Combined export ─────────────────────────────────────────────────────────

export default function SpaceBackground() {
    return (
        <>
            {/* Dense star field — more stars, slight colour tint vs. original */}
            <Stars radius={150} depth={80} count={7000} factor={5} saturation={0.15} fade speed={0.5} />
            {/* Colourful nebula painted on the inside of the skydome */}
            <Nebula />
            {/* Slow-drifting dust motes that catch the scene lighting */}
            <SpaceDust />
            {/* Occasional comet / shooting-star events in the far background */}
            <ShootingStars />
        </>
    );
}
