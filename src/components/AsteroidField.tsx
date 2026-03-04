import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  AsteroidType,
  ECS,
  GameEntity,
  removeAsteroidFromSpatialIndex,
  updateAsteroidSpatialIndex,
} from '../ecs/world';
import { clearAsteroidSpawns, drainAsteroidSpawns } from '../ecs/asteroidSpawnQueue';
import useGameStore from '../store/gameStore';

interface AsteroidConfig {
  radius: number;
  speed: number;
  health: number;
  color: string;
  damage: number;
}

const ASTEROID_CONFIGS: Record<AsteroidType, AsteroidConfig> = {
  swarmer: { radius: 0.8, speed: 13, health: 40, color: '#d4a843', damage: 5 },
  tank: { radius: 3.0, speed: 3, health: 350, color: '#555555', damage: 30 },
  splitter: { radius: 1.5, speed: 7, health: 100, color: '#a855f7', damage: 10 },
};

const ASTEROID_TYPES: AsteroidType[] = ['swarmer', 'tank', 'splitter'];
const MAX_ASTEROIDS_PER_TYPE = 2048;
const PLATFORM_HIT_RADIUS_SQ = 9;
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const tempDir = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();

interface RuntimeAsteroid {
  id: string;
  type: AsteroidType;
  entity: GameEntity;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Vector3;
  speed: number;
  damage: number;
}

type AsteroidMeshRefs = Record<AsteroidType, THREE.InstancedMesh | null>;

interface AsteroidFieldProps {
  onDestroy: (id: string, pos: [number, number, number], isBaseHit: boolean, type: AsteroidType) => void;
}

export default function AsteroidField({ onDestroy }: AsteroidFieldProps) {
  const runtimesRef = useRef<RuntimeAsteroid[]>([]);
  const runtimeByIdRef = useRef(new Map<string, RuntimeAsteroid>());
  const runtimeTypeCountsRef = useRef<Record<AsteroidType, number>>({
    swarmer: 0,
    tank: 0,
    splitter: 0,
  });
  const activeCountRef = useRef(0);
  const meshRefs = useRef<AsteroidMeshRefs>({
    swarmer: null,
    tank: null,
    splitter: null,
  });

  const syncActiveAsteroidCount = () => {
    const nextCount = runtimesRef.current.length;
    if (activeCountRef.current === nextCount) return;
    activeCountRef.current = nextCount;
    useGameStore.getState().setActiveAsteroids(nextCount);
  };

  const removeRuntimeAt = (index: number, isBaseHit: boolean) => {
    const runtime = runtimesRef.current[index];
    if (!runtime) return;

    removeAsteroidFromSpatialIndex(runtime.entity);
    ECS.remove(runtime.entity);
    runtimeByIdRef.current.delete(runtime.id);
    runtimeTypeCountsRef.current[runtime.type] = Math.max(
      0,
      runtimeTypeCountsRef.current[runtime.type] - 1
    );
    runtimesRef.current.splice(index, 1);
    syncActiveAsteroidCount();
    onDestroy(
      runtime.id,
      [runtime.position.x, runtime.position.y, runtime.position.z],
      isBaseHit,
      runtime.type
    );
  };

  const spawnAsteroid = (id: string, pos: [number, number, number], type: AsteroidType) => {
    if (runtimeByIdRef.current.has(id)) return;
    if (runtimeTypeCountsRef.current[type] >= MAX_ASTEROIDS_PER_TYPE) return;

    const cfg = ASTEROID_CONFIGS[type];
    const position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const entity = ECS.add({
      id,
      isAsteroid: true,
      position,
      health: cfg.health,
      asteroidType: type,
      targetedBy: null,
    });
    updateAsteroidSpatialIndex(entity, position);

    const runtime: RuntimeAsteroid = {
      id,
      type,
      entity,
      position,
      rotation: new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ),
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9
      ),
      speed: cfg.speed,
      damage: cfg.damage,
    };

    runtimesRef.current.push(runtime);
    runtimeByIdRef.current.set(id, runtime);
    runtimeTypeCountsRef.current[type] += 1;
  };

  useEffect(() => {
    for (const type of ASTEROID_TYPES) {
      const mesh = meshRefs.current[type];
      if (mesh) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
      }
    }

    return () => {
      for (const runtime of runtimesRef.current) {
        removeAsteroidFromSpatialIndex(runtime.entity);
        ECS.remove(runtime.entity);
      }
      runtimesRef.current.length = 0;
      runtimeByIdRef.current.clear();
      runtimeTypeCountsRef.current = { swarmer: 0, tank: 0, splitter: 0 };
      activeCountRef.current = 0;
      useGameStore.getState().setActiveAsteroids(0);
      clearAsteroidSpawns();
    };
  }, []);

  useFrame((_, delta) => {
    const pendingSpawns = drainAsteroidSpawns();
    for (const spawn of pendingSpawns) {
      spawnAsteroid(spawn.id, spawn.pos, spawn.type);
    }
    if (pendingSpawns.length > 0) {
      syncActiveAsteroidCount();
    }

    const gameState = useGameStore.getState().gameState;
    if (gameState !== 'gameover') {
      for (let i = runtimesRef.current.length - 1; i >= 0; i--) {
        const runtime = runtimesRef.current[i];
        if (!runtime) continue;

        if ((runtime.entity.health ?? 0) <= 0) {
          removeRuntimeAt(i, false);
          continue;
        }

        tempDir.copy(runtime.position).negate().normalize();
        runtime.position.addScaledVector(tempDir, runtime.speed * delta);
        runtime.rotation.x += runtime.angularVelocity.x * delta;
        runtime.rotation.y += runtime.angularVelocity.y * delta;
        runtime.rotation.z += runtime.angularVelocity.z * delta;

        if (runtime.position.lengthSq() <= PLATFORM_HIT_RADIUS_SQ) {
          useGameStore.getState().takeDamage(runtime.damage);
          removeRuntimeAt(i, true);
          continue;
        }

        updateAsteroidSpatialIndex(runtime.entity, runtime.position);
      }
    }

    const typeCounts: Record<AsteroidType, number> = {
      swarmer: 0,
      tank: 0,
      splitter: 0,
    };

    for (const runtime of runtimesRef.current) {
      const mesh = meshRefs.current[runtime.type];
      if (!mesh) continue;

      const instanceIndex = typeCounts[runtime.type];
      if (instanceIndex >= MAX_ASTEROIDS_PER_TYPE) continue;

      tempQuat.setFromEuler(runtime.rotation);
      tempMatrix.compose(runtime.position, tempQuat, UNIT_SCALE);
      mesh.setMatrixAt(instanceIndex, tempMatrix);
      typeCounts[runtime.type] = instanceIndex + 1;
    }

    for (const type of ASTEROID_TYPES) {
      const mesh = meshRefs.current[type];
      if (!mesh) continue;
      mesh.count = typeCounts[type];
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={(mesh) => {
          meshRefs.current.swarmer = mesh;
        }}
        args={[undefined, undefined, MAX_ASTEROIDS_PER_TYPE]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[ASTEROID_CONFIGS.swarmer.radius, 0]} />
        <meshStandardMaterial color={ASTEROID_CONFIGS.swarmer.color} flatShading />
      </instancedMesh>

      <instancedMesh
        ref={(mesh) => {
          meshRefs.current.tank = mesh;
        }}
        args={[undefined, undefined, MAX_ASTEROIDS_PER_TYPE]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[ASTEROID_CONFIGS.tank.radius, 0]} />
        <meshStandardMaterial color={ASTEROID_CONFIGS.tank.color} flatShading />
      </instancedMesh>

      <instancedMesh
        ref={(mesh) => {
          meshRefs.current.splitter = mesh;
        }}
        args={[undefined, undefined, MAX_ASTEROIDS_PER_TYPE]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[ASTEROID_CONFIGS.splitter.radius, 0]} />
        <meshStandardMaterial color={ASTEROID_CONFIGS.splitter.color} flatShading />
      </instancedMesh>
    </group>
  );
}
