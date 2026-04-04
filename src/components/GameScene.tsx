import { lazy, Suspense } from "react";
import CinematicCamera from "./CinematicCamera";
import Platform from "./Platform";
import Turret from "./Turret";
import Asteroid from "./Asteroid";
import AsteroidSpawner from "./AsteroidSpawner";
import Explosion from "./Explosion";
import type { EffectsQuality } from "../utils/visualQuality";
import { useExplosionPool } from "./gameScene/useExplosionPool";
import { useShieldImpacts } from "./gameScene/useShieldImpacts";
import { useAsteroidManager } from "./gameScene/useAsteroidManager";

// Lazy-load the cosmetic background so core gameplay geometry renders first.
const SpaceBackground = lazy(() => import("./SpaceBackground"));

// Pool of pre-mounted Asteroid components. Inactive entries are parked off-screen
// so Rapier does not simulate them. Increase this value if waves grow beyond 60
// simultaneous asteroids; see Asteroid.tsx for a full explanation of the chosen
// per-component rendering strategy.
const POOL_SIZE = 60;

interface GameSceneProps {
  asteroidEffectsQuality: EffectsQuality;
  backgroundEffectsQuality: EffectsQuality;
  reducedMotion: boolean;
}

const TURRET_CONFIGS = [
  {
    id: "t1",
    position: [5, 1, 0] as [number, number, number],
    rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
  },
  {
    id: "t2",
    position: [-5, 1, 0] as [number, number, number],
    rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
  },
  {
    id: "t3",
    position: [5, -1, 0] as [number, number, number],
    rotation: [Math.PI / 2, 0, 0] as [number, number, number],
  },
  {
    id: "t4",
    position: [-5, -1, 0] as [number, number, number],
    rotation: [Math.PI / 2, 0, 0] as [number, number, number],
  },
];

export default function GameScene({
  asteroidEffectsQuality,
  backgroundEffectsQuality,
  reducedMotion,
}: GameSceneProps) {
  const { explosions, triggerExplosion } = useExplosionPool(POOL_SIZE);
  const { shieldImpacts, addShieldImpact } = useShieldImpacts();

  const { asteroids, handleDestroy } = useAsteroidManager({
    poolSize: POOL_SIZE,
    onShieldImpact: addShieldImpact,
    onAsteroidDestroyed: (pos, type) => triggerExplosion(pos, type),
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <Suspense fallback={null}>
        <SpaceBackground quality={backgroundEffectsQuality} reducedMotion={reducedMotion} />
      </Suspense>
      <CinematicCamera />

      <AsteroidSpawner />

      <Platform shieldImpacts={shieldImpacts} />

      {TURRET_CONFIGS.map((config) => (
        <Turret key={config.id} {...config} />
      ))}

      {asteroids.map((ast) => (
        <Asteroid
          key={ast.id}
          id={ast.id}
          startPos={ast.pos}
          type={ast.type}
          active={ast.active}
          effectsQuality={asteroidEffectsQuality}
          onDestroy={handleDestroy}
        />
      ))}

      {explosions.map((exp) => (
        <Explosion key={exp.id} position={exp.pos} type={exp.type} active={exp.active} />
      ))}
    </>
  );
}
