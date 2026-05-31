import { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFrame } from "@react-three/fiber";
import useGameStore from "../../store/gameStore";
import { AsteroidType, updateSpatialIndex } from "../../ecs/world";
import { clearAsteroidSpawns, drainAsteroidSpawns } from "../../ecs/asteroidSpawnQueue";
import { markTelemetry } from "../../telemetry/runtime";
import { usePoolStore } from "../../store/poolStore";

export interface AsteroidManagerOptions {
  poolSize: number;
  onShieldImpact?: (pos: [number, number, number]) => void;
}

// Keep for backwards compatibility — activeCount now derived from store
export interface AsteroidPoolState {
  items: Array<{ id: string; active: boolean; pos: [number, number, number]; type: AsteroidType }>;
  activeCount: number;
}

/**
 * Manages the lifecycle of asteroids in the game scene, including spawning,
 * destruction, and synchronization with the global game store.
 *
 * Pool state lives in poolStore; this hook dispatches operations to the store
 * and syncs active count to gameStore.
 */
export function useAsteroidManager({
  poolSize,
  onShieldImpact,
}: AsteroidManagerOptions) {
  // Track active count locally and sync to gameStore
  const [activeCount, setActiveAsteroidsCount] = useState(0);

  const { incrementDestroyed, setActiveAsteroids, sessionId } = useGameStore(
    useShallow((state) => ({
      incrementDestroyed: state.incrementDestroyed,
      setActiveAsteroids: state.setActiveAsteroids,
      sessionId: state.sessionId,
    })),
  );

  // Reset pool when sessionId changes, and clean up on unmount
  useEffect(() => {
    usePoolStore.getState().resetPools(poolSize);
    setActiveAsteroidsCount(0);
    setActiveAsteroids(0);
    markTelemetry("asteroids:reset-pool", {
      poolSize,
      sessionId,
    });
    clearAsteroidSpawns();
    return () => {
      clearAsteroidSpawns();
    };
  }, [sessionId, poolSize]);

  // Update spatial index and process new spawns every frame
  useFrame(() => {
    if (useGameStore.getState().gameState !== "playing") return;

    updateSpatialIndex();
    const spawns = drainAsteroidSpawns();
    if (spawns.length > 0) {
      markTelemetry("asteroids:drain-spawns", {
        count: spawns.length,
      });
      usePoolStore.getState().activateAsteroids(spawns);
    }

    // Derive active count from store and sync to gameStore
    const count = usePoolStore.getState().asteroids.filter((a) => a.active).length;
    if (count !== activeCount) {
      setActiveAsteroidsCount(count);
      setActiveAsteroids(count);
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

      usePoolStore.getState().deactivateAsteroid(id);
    },
    [incrementDestroyed, onShieldImpact],
  );

  // Expose asteroids from store for rendering
  const asteroids = usePoolStore((state) => state.asteroids);

  return {
    asteroids,
    handleDestroy,
  };
}