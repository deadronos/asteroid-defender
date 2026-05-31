import { useCallback } from "react";
import type { AsteroidType } from "../../ecs/world";
import { usePoolStore } from "../../store/poolStore";

/**
 * Manages explosion pool operations by dispatching to poolStore.
 * Explosion rendering is handled by ExplosionLayer which subscribes
 * to poolStore.explosions directly.
 */
export function useExplosionPool() {
  const triggerExplosion = useCallback(
    (pos: [number, number, number], type: AsteroidType) => {
      usePoolStore.getState().triggerExplosion(pos, type);
    },
    [],
  );

  const handleExplosionComplete = useCallback((id: string) => {
    usePoolStore.getState().deactivateExplosion(id);
  }, []);

  return { triggerExplosion, handleExplosionComplete };
}