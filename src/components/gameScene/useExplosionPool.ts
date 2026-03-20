import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsteroidType } from '../../ecs/world';
import { clearExplosionTimers, createExplosionPool } from './pools';

const EXPLOSION_DURATION_MS = 1000;

export function useExplosionPool(poolSize: number) {
    const [explosions, setExplosions] = useState(() => createExplosionPool(poolSize));
    const explosionsRef = useRef(explosions);

    useEffect(() => {
        explosionsRef.current = explosions;
    }, [explosions]);

    useEffect(() => {
        return () => {
            clearExplosionTimers(explosionsRef.current);
        };
    }, []);

    const triggerExplosion = useCallback((pos: [number, number, number], type: AsteroidType) => {
        setExplosions((prev) => {
            const nextIdx = prev.findIndex((explosion) => !explosion.active);
            if (nextIdx === -1) {
                return prev;
            }

            const nextExplosions = [...prev];
            const explosion = nextExplosions[nextIdx];

            if (explosion.timer) {
                clearTimeout(explosion.timer);
            }

            nextExplosions[nextIdx] = {
                ...explosion,
                active: true,
                pos,
                type,
                timer: setTimeout(() => {
                    setExplosions((current) => current.map((item, index) => (
                        index === nextIdx ? { ...item, active: false, timer: undefined } : item
                    )));
                }, EXPLOSION_DURATION_MS),
            };
            return nextExplosions;
        });
    }, []);

    return { explosions, triggerExplosion };
}
