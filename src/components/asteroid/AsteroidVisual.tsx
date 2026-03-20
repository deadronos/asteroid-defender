import type { RefObject } from "react";
import { Edges, Trail } from "@react-three/drei";
import * as THREE from "three";
import type { AsteroidType } from "../../ecs/world";
import type { AsteroidVisualProfile } from "../../utils/asteroidVisualQuality";
import type { AsteroidConfig } from "./config";

interface AsteroidVisualProps {
  type: AsteroidType;
  cfg: AsteroidConfig;
  visualProfile: AsteroidVisualProfile;
  materialRef: RefObject<THREE.MeshStandardMaterial | null>;
  dangerRingMaterialRef: RefObject<THREE.MeshBasicMaterial | null>;
}

export default function AsteroidVisual({
  type,
  cfg,
  visualProfile,
  materialRef,
  dangerRingMaterialRef,
}: AsteroidVisualProps) {
  const asteroidMesh = (
    <mesh>
      {type === "swarmer" && <dodecahedronGeometry args={[cfg.radius, 0]} />}
      {type === "tank" && <octahedronGeometry args={[cfg.radius, 0]} />}
      {type === "splitter" && <icosahedronGeometry args={[cfg.radius, 0]} />}
      <meshStandardMaterial ref={materialRef} color={cfg.color} flatShading />
      {visualProfile.showEdges && <Edges scale={1} threshold={15} color="black" />}
    </mesh>
  );

  return (
    <group>
      {visualProfile.showTrail ? (
        <Trail
          width={visualProfile.trailWidth}
          length={visualProfile.trailLength}
          decay={visualProfile.trailDecay}
          stride={visualProfile.trailStride}
          color={cfg.color}
          attenuation={(t) => t * t}
        >
          {asteroidMesh}
        </Trail>
      ) : (
        asteroidMesh
      )}

      {type === "tank" && visualProfile.showTankRing && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[cfg.radius * 1.55, cfg.radius * 1.75, 16]} />
          <meshBasicMaterial
            ref={dangerRingMaterialRef}
            color="#ff3333"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {type === "splitter" && visualProfile.showSplitterRings && (
        <>
          <mesh rotation={[0, 0, Math.PI / 6]}>
            <ringGeometry args={[cfg.radius * 1.3, cfg.radius * 1.45, 12]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <ringGeometry args={[cfg.radius * 1.3, cfg.radius * 1.45, 12]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}
