import { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFrame } from "@react-three/fiber";
import useGameStore from "../../store/gameStore";
import { AsteroidType, updateSpatialIndex } from "../../ecs/world";
import { clearAsteroidSpawns, drainAsteroidSpawns } from "../../ecs/asteroidSpawnQueue";
import {
  activateQueuedAsteroidsWithDelta,
  createAsteroidPool,
  deactivateAsteroidWithDelta,
  type PooledAsteroid,
  spawnSplitterFragmentsWithDelta,
} from "./pools";

export interface AsteroidManagerOptions {
  poolSize: number;
  onAsteroidDestroyed?: (
    pos: [number, number, number],
    type: AsteroidType,
    isBaseHit: boolean,
  ) => void;
  onShieldImpact?: (pos: [number, number, number]) => void;
}

export interface AsteroidPoolState {
  items: PooledAsteroid[];
  activeCount: number;
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
  const [asteroidState, setAsteroidState] = useState<AsteroidPoolState>(() => ({
    items: createAsteroidPool(poolSize),
    activeCount: 0,
  }));

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
    if (useGameStore.getState().gameState !== "playing") return;

    updateSpatialIndex();
    const spawns = drainAsteroidSpawns();
    if (spawns.length > 0) {
      setAsteroidState((prev) => {
        const { items: nextItems, activeDelta } = activateQueuedAsteroidsWithDelta(
          prev.items,
          spawns,
        );
        // Optimization: Update store count immediately if changed
        if (nextItems !== prev.items) {
          const nextCount = prev.activeCount + activeDelta;
          setActiveAsteroids(nextCount);
          return { items: nextItems, activeCount: nextCount };
        }
        return prev;
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

      setAsteroidState((prev) => {
        const deactivateResult = deactivateAsteroidWithDelta(prev.items, id);
        let nextItems = deactivateResult.items;
        let activeDelta = deactivateResult.activeDelta;

        if (type === "splitter" && !isBaseHit) {
          const splitterResult = spawnSplitterFragmentsWithDelta(nextItems, pos);
          nextItems = splitterResult.items;
          activeDelta += splitterResult.activeDelta;
        }

        if (nextItems !== prev.items) {
          const nextCount = prev.activeCount + activeDelta;
          // Update active count in global store
          setActiveAsteroids(nextCount);
          return { items: nextItems, activeCount: nextCount };
        }
        return prev;
      });

      // Notify external listeners (e.g., for explosions)
      onAsteroidDestroyed?.(pos, type, isBaseHit);
    },
    [incrementDestroyed, setActiveAsteroids, onAsteroidDestroyed, onShieldImpact],
  );

  return {
    asteroids: asteroidState.items,
    handleDestroy,
  };
}
