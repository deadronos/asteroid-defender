import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Line } from "@react-three/drei";
import * as THREE from "three";
import { Line2, LineMaterial } from "three-stdlib";
import { GameEntity } from "../ecs/world";
import useGameStore from "../store/gameStore";
import {
  applyIdleTurretRotation,
  calculateTurretDamage,
  findTurretTarget,
  LASER_ORIGIN_Z,
  releaseTarget,
} from "./turret/helpers";

interface TurretProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

export default function Turret({ id, position, rotation }: TurretProps) {
  const turretGroup = useRef<THREE.Group>(null);
  const [hasTarget, setHasTarget] = useState(false);
  const [rotationX, rotationY, rotationZ] = rotation;
  const baseRotation = useMemo(
    () => new THREE.Euler(rotationX, rotationY, rotationZ),
    [rotationX, rotationY, rotationZ],
  );
  const idleOffsetRef = useRef(Math.random() * Math.PI * 2);
  const nextRecalibrationRef = useRef(6 + Math.random() * 5);
  const recalibrationStartRef = useRef<number | null>(null);
  const pulseRef = useRef(0);
  const impactRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const beamLightRef = useRef<THREE.PointLight>(null);
  const impactLightRef = useRef<THREE.PointLight>(null);
  const lineRef = useRef<Line2>(null);
  const barrelGroupRef = useRef<THREE.Group>(null);
  const hologramRingRef = useRef<THREE.Mesh>(null);
  const hologramRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const hologramReticleRef = useRef<THREE.Group>(null);

  // Keep vectors around instead of full React states to avoid unneeded renders
  const localTargetRef = useRef(new THREE.Vector3());
  const currentTargetRef = useRef<GameEntity | null>(null);

  useFrame((state) => {
    if (!turretGroup.current) return;

    if (useGameStore.getState().gameState !== "playing") {
      releaseTarget(currentTargetRef.current, id);
      currentTargetRef.current = null;
      if (hasTarget) setHasTarget(false);
      return;
    }

    const nearestEntity: GameEntity | null = findTurretTarget(turretGroup.current, id);

    if (nearestEntity) {
      // Un-mark previous target if we switched
      if (currentTargetRef.current && currentTargetRef.current !== nearestEntity) {
        releaseTarget(currentTargetRef.current, id);
      }
      currentTargetRef.current = nearestEntity;

      turretGroup.current.lookAt(nearestEntity.position!);

      // Optimized: Since we just called lookAt, the target's local position
      // is always (0, 0, actualDist). This avoids expensive matrix world
      // updates and worldToLocal inversions every frame.
      const actualDistSq = turretGroup.current.position.distanceToSquared(nearestEntity.position!);
      const actualDist = Math.sqrt(actualDistSq);
      localTargetRef.current.set(0, 0, actualDist);

      nearestEntity.targetedBy = id;

      if (!hasTarget) setHasTarget(true);
      recalibrationStartRef.current = null;
      if (barrelGroupRef.current) barrelGroupRef.current.rotation.set(0, 0, 0);

      nearestEntity.health! -= calculateTurretDamage(actualDist);
    } else {
      // Clear our lock if no target
      if (currentTargetRef.current) {
        releaseTarget(currentTargetRef.current, id);
        currentTargetRef.current = null;
      }
      if (hasTarget) setHasTarget(false);

      applyIdleTurretRotation(
        turretGroup.current,
        baseRotation,
        state.clock.elapsedTime,
        idleOffsetRef.current,
      );

      if (
        state.clock.elapsedTime >= nextRecalibrationRef.current &&
        recalibrationStartRef.current === null
      ) {
        recalibrationStartRef.current = state.clock.elapsedTime;
        nextRecalibrationRef.current = state.clock.elapsedTime + 8 + Math.random() * 6;
      }

      if (recalibrationStartRef.current !== null && barrelGroupRef.current) {
        const progress = Math.min(
          (state.clock.elapsedTime - recalibrationStartRef.current) / 1.2,
          1,
        );
        const raise = Math.sin(progress * Math.PI) * 0.35;
        barrelGroupRef.current.rotation.set(-raise, 0, progress * Math.PI * 7);
        if (progress >= 1) {
          recalibrationStartRef.current = null;
          barrelGroupRef.current.rotation.set(0, 0, 0);
        }
      }
    }

    // Pulse Animation for Laser & Impact
    pulseRef.current += 0.5;
    const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 1.6 + pulse * 1.8;
    }

    if (hologramRingRef.current) {
      hologramRingRef.current.rotation.z = (state.clock.elapsedTime * 1.2) % (Math.PI * 2);
      const scale = hasTarget ? 1.05 + pulse * 0.2 : 0.95 + pulse * 0.08;
      hologramRingRef.current.scale.setScalar(scale);
    }
    if (hologramRingMaterialRef.current) {
      hologramRingMaterialRef.current.opacity = hasTarget ? 0.45 + pulse * 0.2 : 0.2 + pulse * 0.08;
    }
    if (hologramReticleRef.current) {
      hologramReticleRef.current.rotation.z = (-state.clock.elapsedTime * 1.6) % (Math.PI * 2);
    }

    if (!hasTarget) return;

    const lineMaterial = lineRef.current?.material;
    if (lineMaterial instanceof LineMaterial) {
      // Pulse between 1 and 4 linewidth thickness
      lineMaterial.linewidth = 1 + pulse * 3;
    }

    if (lineRef.current) {
      lineRef.current.geometry.setPositions([
        0,
        0,
        LASER_ORIGIN_Z,
        localTargetRef.current.x,
        localTargetRef.current.y,
        localTargetRef.current.z,
      ]);
    }

    if (impactRef.current) {
      // Pulse scale between 0.8 and 1.5
      const scale = 0.8 + (Math.sin(pulseRef.current * 1.5) * 0.5 + 0.5) * 0.7;
      impactRef.current.scale.set(scale, scale, scale);
      impactRef.current.position.copy(localTargetRef.current);
    }
    if (beamLightRef.current) {
      beamLightRef.current.position.set(
        localTargetRef.current.x * 0.5,
        localTargetRef.current.y * 0.5,
        LASER_ORIGIN_Z + (localTargetRef.current.z - LASER_ORIGIN_Z) * 0.5,
      );
      beamLightRef.current.intensity = 4 + pulse * 2.5;
    }
    if (impactLightRef.current) {
      impactLightRef.current.position.copy(localTargetRef.current);
      impactLightRef.current.intensity = 5 + pulse * 3;
    }
  });

  return (
    <group position={position} rotation={rotation} ref={turretGroup}>
      <group ref={barrelGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.5]}>
          <cylinderGeometry args={[0.8, 0.8, 3, 12]} />
          <meshStandardMaterial color="#888c8d" flatShading />
          <Edges scale={1} threshold={15} color="black" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, LASER_ORIGIN_Z]}>
          <coneGeometry args={[0.8, 1, 12]} />
          <meshStandardMaterial
            ref={coreMaterialRef}
            color="#e03131"
            emissive="#ff4040"
            emissiveIntensity={2.2}
            flatShading
          />
          <Edges scale={1} threshold={15} color="black" />
        </mesh>
        <mesh position={[0, 0, 3.9]}>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color(10, 2, 2)} toneMapped={false} />
        </mesh>
      </group>
      <group position={[0, 0, 2.3]} ref={hologramReticleRef}>
        <mesh ref={hologramRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.45, 32]} />
          <meshBasicMaterial
            ref={hologramRingMaterialRef}
            color="#7ec8ff"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <Line
          points={[
            [-1.55, 0, 0],
            [1.55, 0, 0],
          ]}
          color="#7ec8ff"
          lineWidth={1}
          transparent
          opacity={0.45}
        />
        <Line
          points={[
            [0, -1.55, 0],
            [0, 1.55, 0],
          ]}
          color="#7ec8ff"
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      </group>

      {hasTarget && (
        <>
          <Line
            ref={lineRef}
            points={[
              [0, 0, LASER_ORIGIN_Z],
              [0, 0, LASER_ORIGIN_Z],
            ]} // Initialized coords, replaced in useFrame
            color={new THREE.Color(10, 2, 2)}
            lineWidth={3}
          />
          <mesh ref={impactRef} position={[0, 0, 0]}>
            <sphereGeometry args={[0.6, 8, 8]} />
            <meshBasicMaterial
              color={new THREE.Color(10, 2, 2)}
              toneMapped={false}
              transparent
              opacity={0.9}
            />
          </mesh>
          <pointLight
            ref={beamLightRef}
            position={[0, 0, 0]}
            color="#ff4a4a"
            intensity={5}
            distance={14}
            decay={2}
          />
          <pointLight
            ref={impactLightRef}
            position={[0, 0, 0]}
            color="#ff7a5f"
            intensity={7}
            distance={10}
            decay={2}
          />
        </>
      )}
    </group>
  );
}
