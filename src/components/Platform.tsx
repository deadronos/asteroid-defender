import { RigidBody, CylinderCollider } from "@react-three/rapier";
import { Edges } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import useGameStore from "../store/gameStore";

// Pre-allocated scratch colours to avoid per-frame GC pressure
const _shieldHealthy = new THREE.Color("#7ec8ff");
const _shieldCritical = new THREE.Color("#ff2222");
const _stripHealthy = new THREE.Color("#4f7cff");
const _stripCritical = new THREE.Color("#ff3322");
const _stripColorHealthy = new THREE.Color("#7aa2ff");
const _stripColorCritical = new THREE.Color("#ff5555");
const _scratch = new THREE.Color();
const _scratchB = new THREE.Color();

interface ShieldImpactData {
  id: string;
  pos: [number, number, number];
}

interface PlatformProps {
  shieldImpacts: ShieldImpactData[];
}

function ShieldRipple({ pos }: { pos: [number, number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const bornAtRef = useRef<number | null>(null);
  const shieldRadius = 3.15;

  const [px, py, pz] = pos;
  const impactData = useMemo(() => {
    const dir = new THREE.Vector3(px, py, pz);
    if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0);
    dir.normalize();
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    return {
      impactPoint: dir.multiplyScalar(shieldRadius).toArray() as [number, number, number],
      impactRotation: quat,
    };
  }, [px, py, pz]);

  useFrame((state) => {
    if (!ringRef.current || !ringMaterialRef.current) return;
    if (bornAtRef.current === null) bornAtRef.current = state.clock.elapsedTime;

    const progress = Math.min((state.clock.elapsedTime - bornAtRef.current) / 0.9, 1);
    const scale = 0.8 + progress * 3.6;
    ringRef.current.scale.set(scale, scale, scale);
    ringMaterialRef.current.opacity = 0.45 * (1 - progress);
  });

  return (
    <group position={impactData.impactPoint} quaternion={impactData.impactRotation}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.08, 0.22, 6]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color="#7ec8ff"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function Platform({ shieldImpacts }: PlatformProps) {
  const stripMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const rotatedStripMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const shieldMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const { health, maxHealth, reducedMotion } = useGameStore.getState();
    const ratio = maxHealth > 0 ? Math.max(0, health / maxHealth) : 1;

    // Shield sphere: colour and opacity react to hull integrity
    if (shieldMaterialRef.current) {
      _scratch.lerpColors(_shieldCritical, _shieldHealthy, ratio);
      shieldMaterialRef.current.color.copy(_scratch);
      shieldMaterialRef.current.opacity = 0.03 + (1 - ratio) * 0.15;
    }

    // At critical integrity (<30 %) add a rapid flicker on strips (skip for reduced-motion)
    const flicker =
      !reducedMotion && ratio < 0.3
        ? (Math.sin(state.clock.elapsedTime * 14) * 0.5 + 0.5) * ((0.3 - ratio) / 0.3)
        : 0;

    const pulse = !reducedMotion ? Math.sin(state.clock.elapsedTime * 0.8) * 0.5 + 0.5 : 0.5;

    // Energy strips: emissive colour and tint shift blue → red as health drops
    _scratch.lerpColors(_stripCritical, _stripHealthy, ratio);
    _scratchB.lerpColors(_stripColorCritical, _stripColorHealthy, ratio);
    const stripIntensity = 0.8 + pulse * 1.4 + flicker * 2.5;

    if (stripMaterialRef.current) {
      stripMaterialRef.current.color.copy(_scratchB);
      stripMaterialRef.current.emissive.copy(_scratch);
      stripMaterialRef.current.emissiveIntensity = stripIntensity;
    }
    if (rotatedStripMaterialRef.current) {
      rotatedStripMaterialRef.current.color.copy(_scratchB);
      rotatedStripMaterialRef.current.emissive.copy(_scratch);
      rotatedStripMaterialRef.current.emissiveIntensity = stripIntensity;
    }
    if (coreMaterialRef.current) coreMaterialRef.current.emissiveIntensity = 1.5 + pulse * 2.5;
    if (beaconGroupRef.current) beaconGroupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
  });

  return (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[1, 12]} />
      <group>
        <mesh receiveShadow>
          <cylinderGeometry args={[12, 12, 2, 16]} />
          <meshStandardMaterial color="#888c8d" flatShading />
          {/* Outlines overlay for the stylized look */}
          <Edges scale={1} threshold={15} color="black" />
        </mesh>
        <group position={[0, 1.05, 0]}>
          <mesh>
            <sphereGeometry args={[3.15, 24, 24]} />
            <meshBasicMaterial
              ref={shieldMaterialRef}
              color="#7ec8ff"
              transparent
              opacity={0.03}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[18, 0.1, 0.35]} />
            <meshStandardMaterial
              ref={stripMaterialRef}
              color="#7aa2ff"
              emissive="#4f7cff"
              emissiveIntensity={1.4}
            />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[18, 0.1, 0.35]} />
            <meshStandardMaterial
              ref={rotatedStripMaterialRef}
              color="#7aa2ff"
              emissive="#4f7cff"
              emissiveIntensity={1.4}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[1.6, 1.6, 0.22, 16]} />
            <meshStandardMaterial
              ref={coreMaterialRef}
              color="#8a3ffc"
              emissive="#8a3ffc"
              emissiveIntensity={2}
            />
          </mesh>
          <group ref={beaconGroupRef}>
            <pointLight
              position={[6, 0.4, 0]}
              color="#ff9f43"
              intensity={1.8}
              distance={10}
              decay={2}
            />
            <pointLight
              position={[-6, 0.4, 0]}
              color="#ff9f43"
              intensity={1.8}
              distance={10}
              decay={2}
            />
          </group>
          {shieldImpacts.map((impact) => (
            <ShieldRipple key={impact.id} pos={impact.pos} />
          ))}
        </group>
      </group>
    </RigidBody>
  );
}
