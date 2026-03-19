import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAsteroidSpawns,
  drainAsteroidSpawns,
  enqueueAsteroidSpawn,
  type SpawnData,
} from './asteroidSpawnQueue';

describe('asteroidSpawnQueue', () => {
  beforeEach(() => {
    clearAsteroidSpawns();
  });

  it('enqueues and drains a single asteroid spawn', () => {
    const spawn: SpawnData = {
      id: '1',
      pos: [0, 0, 0],
      type: 'swarmer',
    };

    enqueueAsteroidSpawn(spawn);
    const drained = drainAsteroidSpawns();

    expect(drained).toHaveLength(1);
    expect(drained[0]).toEqual(spawn);
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it('enqueues and drains multiple asteroid spawns in order', () => {
    const spawn1: SpawnData = { id: '1', pos: [0, 0, 0], type: 'swarmer' };
    const spawn2: SpawnData = { id: '2', pos: [1, 1, 1], type: 'tank' };

    enqueueAsteroidSpawn(spawn1);
    enqueueAsteroidSpawn(spawn2);
    const drained = drainAsteroidSpawns();

    expect(drained).toHaveLength(2);
    expect(drained[0]).toEqual(spawn1);
    expect(drained[1]).toEqual(spawn2);
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it('returns an empty array when draining an empty queue', () => {
    const drained = drainAsteroidSpawns();
    expect(drained).toEqual([]);
  });

  it('clears the queue', () => {
    enqueueAsteroidSpawn({ id: '1', pos: [0, 0, 0], type: 'swarmer' });
    clearAsteroidSpawns();
    expect(drainAsteroidSpawns()).toHaveLength(0);
  });

  it('drains should return a copy and not affect subsequent calls if modified (not applicable as it clears, but verify it returns new array)', () => {
    enqueueAsteroidSpawn({ id: '1', pos: [0, 0, 0], type: 'swarmer' });
    const drained = drainAsteroidSpawns();
    drained.push({ id: '2', pos: [1, 1, 1], type: 'tank' });

    expect(drainAsteroidSpawns()).toHaveLength(0);
  });
});
