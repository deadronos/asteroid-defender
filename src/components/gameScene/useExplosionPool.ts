import { useCallback, useState } from "react";
import type { AsteroidType } from "../../ecs/world";
import { createExplosionPool, deactivateExplosion } from "./pools";

/**
 * Manages a fixed-size pool of explosion effects.  Deactivation is driven
 * by a frame-based `onComplete` callback from the <Explosion> component
 * rather than a wall-clock `setTimeout`, so lifetime stays consistent even
 * when the tab is backgrounded or frames are dropped.
 */
export function useExplosionPool(poolSize: number) {
  const [explosions, setExplosions] = useState(() => createExplosionPool(poolSize));

  const triggerExplosion = useCallback((pos: [number, number, number], type: AsteroidType) => {
    setExplosions((prev) => {
      const nextIdx = prev.findIndex((explosion) => !explosion.active);
      if (nextIdx === -1) {
        return prev;
      }

      const nextExplosions = [...prev];
      nextExplosions[nextIdx] = {
        ...prev[nextIdx],
        active: true,
        pos,
        type,
      };
      return nextExplosions;
    });
  }, []);

  const handleExplosionComplete = useCallback((id: string) => {
    setExplosions((prev) => deactivateExplosion(prev, id));
  }, []);

  return { explosions, triggerExplosion, handleExplosionComplete };
}
