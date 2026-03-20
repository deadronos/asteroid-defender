import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ECS,
  asteroidQuery,
  countAsteroidsInRange,
  findNearestAsteroidInRange,
  queryAsteroidsInRange,
  updateSpatialIndex,
  type GameEntity,
} from './world';

function clearWorld() {
  for (const entity of Array.from(asteroidQuery)) {
    ECS.remove(entity);
  }
}

function addAsteroid(id: string, position: THREE.Vector3): GameEntity {
  const entity = ECS.add({
    id,
    isAsteroid: true,
    position,
    health: 100,
  });
  updateSpatialIndex();
  return entity;
}

describe('asteroid spatial index', () => {
  beforeEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  afterEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  it('returns indexed asteroids that are in range', () => {
    const asteroid = addAsteroid('a-1', new THREE.Vector3(0, 0, 0));

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 5);

    expect(results).toContain(asteroid);
  });

  it('moves asteroids between cells when position changes', () => {
    const asteroid = addAsteroid('a-2', new THREE.Vector3(0, 0, 0));

    asteroid.position!.set(25, 0, 0);
    updateSpatialIndex();

    const newCellResults = queryAsteroidsInRange(new THREE.Vector3(25, 0, 0), 5);

    expect(newCellResults).toContain(asteroid);
  });

  it('removes asteroids from range queries after index removal', () => {
    const asteroid = addAsteroid('a-3', new THREE.Vector3(10, 0, 0));

    ECS.remove(asteroid);
    updateSpatialIndex();

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 50);
    expect(results).not.toContain(asteroid);
  });

  it('does not return asteroids outside the queried bounds', () => {
    const inBounds = addAsteroid('a-4', new THREE.Vector3(49.9, 0, 0));
    const outOfBounds = addAsteroid('a-5', new THREE.Vector3(60.1, 0, 0));

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 50);

    expect(results).toContain(inBounds);
    expect(results).not.toContain(outOfBounds);
  });

  it('does not duplicate asteroids when updated in the same cell', () => {
    const asteroid = addAsteroid('a-6', new THREE.Vector3(1, 1, 1));

    asteroid.position!.set(8, 2, 1);
    updateSpatialIndex();

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 20);
    const matches = results.filter((entity) => entity === asteroid);
    expect(matches).toHaveLength(1);
  });
});

describe('countAsteroidsInRange', () => {
  beforeEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  afterEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  it('returns zero when no asteroids are present', () => {
    expect(countAsteroidsInRange(new THREE.Vector3(0, 0, 0), 50)).toBe(0);
  });

  it('counts asteroids within range', () => {
    addAsteroid('c-1', new THREE.Vector3(0, 0, 0));
    addAsteroid('c-2', new THREE.Vector3(5, 0, 0));

    expect(countAsteroidsInRange(new THREE.Vector3(0, 0, 0), 10)).toBe(2);
  });

  it('does not count asteroids outside the range', () => {
    addAsteroid('c-3', new THREE.Vector3(0, 0, 0));
    addAsteroid('c-4', new THREE.Vector3(60, 0, 0));

    expect(countAsteroidsInRange(new THREE.Vector3(0, 0, 0), 50)).toBe(1);
  });

  it('matches the length of queryAsteroidsInRange for equivalence', () => {
    addAsteroid('c-5', new THREE.Vector3(10, 0, 0));
    addAsteroid('c-6', new THREE.Vector3(20, 0, 0));
    addAsteroid('c-7', new THREE.Vector3(80, 0, 0));

    const origin = new THREE.Vector3(0, 0, 0);
    const range = 30;
    expect(countAsteroidsInRange(origin, range)).toBe(queryAsteroidsInRange(origin, range).length);
  });
});

describe('findNearestAsteroidInRange', () => {
  beforeEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  afterEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  it('returns null when no asteroids are present', () => {
    expect(findNearestAsteroidInRange(new THREE.Vector3(0, 0, 0), 50)).toBeNull();
  });

  it('returns the nearest asteroid within range', () => {
    const close = addAsteroid('n-1', new THREE.Vector3(5, 0, 0));
    addAsteroid('n-2', new THREE.Vector3(15, 0, 0));

    expect(findNearestAsteroidInRange(new THREE.Vector3(0, 0, 0), 50)).toBe(close);
  });

  it('returns null when the only asteroid is out of range', () => {
    addAsteroid('n-3', new THREE.Vector3(100, 0, 0));

    expect(findNearestAsteroidInRange(new THREE.Vector3(0, 0, 0), 50)).toBeNull();
  });

  it('applies the scoreFn to select a different candidate', () => {
    const closer = addAsteroid('n-4', new THREE.Vector3(5, 0, 0));
    const farther = addAsteroid('n-5', new THREE.Vector3(20, 0, 0));

    // scoreFn heavily penalises the closer asteroid so the farther one wins
    const result = findNearestAsteroidInRange(
      new THREE.Vector3(0, 0, 0),
      50,
      (entity, distSq) => (entity === closer ? distSq + 10000 : distSq)
    );

    expect(result).toBe(farther);
  });

  it('returns Infinity-scored entities as not nearest (scoreFn filter)', () => {
    addAsteroid('n-6', new THREE.Vector3(5, 1, 0));
    const preferred = addAsteroid('n-7', new THREE.Vector3(10, -1, 0));

    // Only allow asteroids with y <= 0
    const result = findNearestAsteroidInRange(
      new THREE.Vector3(0, 0, 0),
      50,
      (entity, distSq) => (entity.position && entity.position.y > 0 ? Infinity : distSq)
    );

    expect(result).toBe(preferred);
  });
});
