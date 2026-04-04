import { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFrame } from "@react-three/fiber";
import useGameStore from "../../store/gameStore";
import { AsteroidType, updateSpatialIndex } from "../../ecs/world";
import { clearAsteroidSpawns, drainAsteroidSpawns } from "../../ecs/asteroidSpawnQueue";
import {
  activateQueuedAsteroids,
  countActiveItems,
  createAsteroidPool,
  deactivateAsteroid,
  type PooledAsteroid,
  spawnSplitterFragments,
} from "./pools";

export interface AsteroidManagerOptions {
  poolSize: number;
  onAsteroidDestroyed?: (pos: [number, number, number], type: AsteroidType, isBaseHit: boolean) => void;
  onShieldImpact?: (pos: [number, number, number]) => void;
}

/**
 * Manages the lifecycle of asteroids in the game scene, including spawning,
 * destruction, and synchronization with the global game store.
 */
export function useAsteroidManager({
  poolSize,
  onAsteroidDestroyed,
  onShieldImpact,
}: AsteroidManagerOptions) {
  const [asteroids, setAsteroids] = useState<PooledAsteroid[]>(() => createAsteroidPool(poolSize));

  const { incrementDestroyed, setActiveAsteroids } = useGameStore(
    useShallow((state) => ({
      incrementDestroyed: state.incrementDestroyed,
      setActiveAsteroids: state.setActiveAsteroids,
    })),
  );

  // Initialize and cleanup spawn queue
  useEffect(() => {
    clearAsteroidSpawns();
    return () => clearAsteroidSpawns();
  }, []);

  // Update spatial index and process new spawns every frame
  useFrame(() => {
    updateSpatialIndex();
    if (useGameStore.getState().gameState !== "playing") return;

    const spawns = drainAsteroidSpawns();
    if (spawns.length > 0) {
      setAsteroids((prev) => {
        const next = activateQueuedAsteroids(prev, spawns);
        // Optimization: Update store count immediately if changed
        if (next !== prev) {
          setActiveAsteroids(countActiveItems(next));
        }
        return next;
      });
    }
  });

  const handleDestroy = useCallback(
    (id: string, pos: [number, number, number], isBaseHit = false, type: AsteroidType) => {
      if (!isBaseHit) {
        incrementDestroyed();
      } else if (onShieldImpact) {
        onShieldImpact(pos);
      }

      setAsteroids((prev) => {
        let next = deactivateAsteroid(prev, id);
        if (type === "splitter" && !isBaseHit) {
          next = spawnSplitterFragments(next, pos);
        }
        
        // Update active count in global store
        setActiveAsteroids(countActiveItems(next));
        return next;
      });

      // Notify external listeners (e.g., for explosions)
      onAsteroidDestroyed?.(pos, type, isBaseHit);
    },
    [incrementDestroyed, setActiveAsteroids, onAsteroidDestroyed, onShieldImpact],
  );

  return {
    asteroids,
    handleDestroy,
  };
}
