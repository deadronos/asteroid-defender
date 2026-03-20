import type { AsteroidType } from '../../ecs/world';
import { nextId } from '../../utils/id';

export interface PooledAsteroid {
    id: string;
    active: boolean;
    pos: [number, number, number];
    type: AsteroidType;
}

export interface PooledExplosion {
    id: string;
    active: boolean;
    pos: [number, number, number];
    type: AsteroidType;
    timer?: ReturnType<typeof setTimeout>;
}

function getStoragePosition(): [number, number, number] {
    return [0, -1000, 0];
}

export function createAsteroidPool(size: number): PooledAsteroid[] {
    return Array.from({ length: size }, () => ({
        id: nextId(),
        active: false,
        pos: getStoragePosition(),
        type: 'swarmer',
    }));
}

export function createExplosionPool(size: number): PooledExplosion[] {
    return Array.from({ length: size }, () => ({
        id: nextId(),
        active: false,
        pos: getStoragePosition(),
        type: 'swarmer',
    }));
}

export function clearExplosionTimers(pool: PooledExplosion[]) {
    for (const explosion of pool) {
        if (explosion.timer) {
            clearTimeout(explosion.timer);
        }
    }
}

export function activateQueuedAsteroids(
    pool: PooledAsteroid[],
    spawns: Array<{ pos: [number, number, number]; type: AsteroidType }>,
): PooledAsteroid[] {
    const nextPool = [...pool];
    let modified = false;
    let nextAvailableIdx = 0;

    for (const spawn of spawns) {
        while (nextAvailableIdx < nextPool.length && nextPool[nextAvailableIdx].active) {
            nextAvailableIdx++;
        }

        if (nextAvailableIdx >= nextPool.length) {
            break;
        }

        nextPool[nextAvailableIdx] = {
            ...nextPool[nextAvailableIdx],
            active: true,
            pos: spawn.pos,
            type: spawn.type,
        };
        modified = true;
        nextAvailableIdx++;
    }

    return modified ? nextPool : pool;
}

export function deactivateAsteroid(pool: PooledAsteroid[], id: string): PooledAsteroid[] {
    const idx = pool.findIndex((asteroid) => asteroid.id === id);
    if (idx === -1) {
        return pool;
    }

    const nextPool = [...pool];
    nextPool[idx] = { ...nextPool[idx], active: false };
    return nextPool;
}

export function spawnSplitterFragments(
    pool: PooledAsteroid[],
    pos: [number, number, number],
): PooledAsteroid[] {
    const nextPool = [...pool];
    const offset = 2.0;
    let splitsLeft = 2;

    for (let i = 0; i < nextPool.length && splitsLeft > 0; i++) {
        if (!nextPool[i].active) {
            nextPool[i] = {
                ...nextPool[i],
                active: true,
                type: 'swarmer',
                pos: [pos[0] + (splitsLeft === 2 ? offset : -offset), pos[1], pos[2]],
            };
            splitsLeft--;
        }
    }

    return nextPool;
}

export function countActiveItems<T extends { active: boolean }>(items: T[]): number {
    let activeCount = 0;
    for (let i = 0; i < items.length; i++) {
        if (items[i].active) {
            activeCount++;
        }
    }
    return activeCount;
}
