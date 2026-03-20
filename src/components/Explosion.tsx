import { useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AsteroidType } from "../ecs/world";

const EXPLOSION_COLORS: Record<AsteroidType, string> = {
  swarmer: "#d4a843",
  tank: "#555555",
  splitter: "#a855f7",
};

const EMISSIVE_COLOR = new THREE.Color(10, 2, 0);
const EXPLOSION_FRAGMENT_IDS = Array.from({ length: 8 }, (_, index) => index);

interface ParticleProps {
  startPos: [number, number, number];
  color: string;
}

const Particle = memo(({ startPos, color }: ParticleProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const lifeRef = useRef(1.0);
  const velocityRef = useRef(new THREE.Vector3());

  useEffect(() => {
    lifeRef.current = 1.0;
    velocityRef.current.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
    );
    if (meshRef.current) {
      meshRef.current.position.set(...startPos);
      meshRef.current.scale.setScalar(1);
    }
    if (materialRef.current) {
      materialRef.current.opacity = 1.0;
    }
  }, [startPos]);

  useFrame((_, delta) => {
    if (!meshRef.current || lifeRef.current <= 0) return;

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
    <mesh ref={meshRef} position={startPos}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={EMISSIVE_COLOR}
        toneMapped={false}
        flatShading
        transparent
        opacity={1}
      />
    </mesh>
  );
});

interface ActiveExplosionEffectProps {
  position: [number, number, number];
  color: string;
}

const ActiveExplosionEffect = memo(({ position, color }: ActiveExplosionEffectProps) => {
  const blastLightRef = useRef<THREE.PointLight>(null);
  const lifeRef = useRef(1);

  useEffect(() => {
    lifeRef.current = 1.0;

    if (blastLightRef.current) {
      blastLightRef.current.intensity = 7;
      blastLightRef.current.position.set(...position);
    }
  }, [position]);

  useFrame((_, delta) => {
    lifeRef.current = Math.max(0, lifeRef.current - delta * 1.6);

    if (blastLightRef.current) {
      blastLightRef.current.intensity = 7 * lifeRef.current;
    }
  });

  return (
    <group>
      <pointLight
        ref={blastLightRef}
        position={position}
        color={color}
        intensity={7}
        distance={18}
        decay={2}
      />
      {EXPLOSION_FRAGMENT_IDS.map((fragmentId) => (
        <Particle key={fragmentId} startPos={position} color={color} />
      ))}
    </group>
  );
});

interface ExplosionProps {
  position: [number, number, number];
  type: AsteroidType;
  active: boolean;
}

function Explosion({ position, type, active }: ExplosionProps) {
  const color = EXPLOSION_COLORS[type] || "#ff6600";

  if (!active) return null;

  return <ActiveExplosionEffect position={position} color={color} />;
}

export default memo(Explosion);
