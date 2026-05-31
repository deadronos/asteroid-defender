import { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFrame } from "@react-three/fiber";
import useGameStore from "../../store/gameStore";
import { AsteroidType, updateSpatialIndex } from "../../ecs/world";
import { clearAsteroidSpawns, drainAsteroidSpawns } from "../../ecs/asteroidSpawnQueue";
import { markTelemetry } from "../../telemetry/runtime";
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

  const { incrementDestroyed, setActiveAsteroids, sessionId } = useGameStore(
    useShallow((state) => ({
      incrementDestroyed: state.incrementDestroyed,
      setActiveAsteroids: state.setActiveAsteroids,
      sessionId: state.sessionId,
    })),
  );

  // Reset state and spawn queue when sessionId changes, and clean up on unmount
  useEffect(() => {
    setAsteroidState({
      items: createAsteroidPool(poolSize),
      activeCount: 0,
    });
    markTelemetry("asteroids:reset-pool", {
      poolSize,
      sessionId,
    });
    clearAsteroidSpawns();
    return () => {
      clearAsteroidSpawns();
    };
  }, [sessionId, poolSize]);

  // Sync active count to global store when it changes
  useEffect(() => {
    setActiveAsteroids(asteroidState.activeCount);
  }, [asteroidState.activeCount, setActiveAsteroids]);

  // Update spatial index and process new spawns every frame
  useFrame(() => {
    if (useGameStore.getState().gameState !== "playing") return;

    updateSpatialIndex();
    const spawns = drainAsteroidSpawns();
    if (spawns.length > 0) {
      markTelemetry("asteroids:drain-spawns", {
        count: spawns.length,
      });
      setAsteroidState((prev) => {
        const { items: nextItems, activeDelta } = activateQueuedAsteroidsWithDelta(
          prev.items,
          spawns,
        );
        if (activeDelta !== 0) {
          const nextCount = prev.activeCount + activeDelta;
          return { items: nextItems, activeCount: nextCount };
        }
        return prev;
      });
    }
  });

  const handleDestroy = useCallback(
    (id: string, pos: [number, number, number], isBaseHit = false, type: AsteroidType) => {
      markTelemetry("asteroids:destroy", {
        type,
        baseHit: isBaseHit,
      });

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
          if (splitterResult.activeDelta > 0) {
            markTelemetry("asteroids:splitter-fragments", {
              spawned: splitterResult.activeDelta,
            });
          }
        }

        if (activeDelta !== 0) {
          const nextCount = prev.activeCount + activeDelta;
          return { items: nextItems, activeCount: nextCount };
        }
        return prev;
      });

      // Notify external listeners (e.g., for explosions)
      onAsteroidDestroyed?.(pos, type, isBaseHit);
    },
    [incrementDestroyed, onAsteroidDestroyed, onShieldImpact],
  );

  return {
    asteroids: asteroidState.items,
    handleDestroy,
  };
}
