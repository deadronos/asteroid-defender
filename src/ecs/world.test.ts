import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ECS,
  asteroidQuery,
  queryAsteroidsInRange,
  removeAsteroidFromSpatialIndex,
  updateAsteroidSpatialIndex,
  type GameEntity,
} from './world';

function clearWorld() {
  for (const entity of Array.from(asteroidQuery)) {
    removeAsteroidFromSpatialIndex(entity);
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
  updateAsteroidSpatialIndex(entity, position);
  return entity;
}

describe('asteroid spatial index', () => {
  beforeEach(() => {
    clearWorld();
  });

  afterEach(() => {
    clearWorld();
  });

  it('returns indexed asteroids that are in range', () => {
    const asteroid = addAsteroid('a-1', new THREE.Vector3(0, 0, 0));

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 5);

    expect(results).toContain(asteroid);
  });

  it('moves asteroids between cells when position changes', () => {
    const asteroid = addAsteroid('a-2', new THREE.Vector3(0, 0, 0));

    asteroid.position!.set(25, 0, 0);
    updateAsteroidSpatialIndex(asteroid, asteroid.position!);

    const oldCellResults = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 5);
    const newCellResults = queryAsteroidsInRange(new THREE.Vector3(25, 0, 0), 5);

    expect(oldCellResults).not.toContain(asteroid);
    expect(newCellResults).toContain(asteroid);
  });

  it('removes asteroids from range queries after index removal', () => {
    const asteroid = addAsteroid('a-3', new THREE.Vector3(10, 0, 0));

    removeAsteroidFromSpatialIndex(asteroid);

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
    updateAsteroidSpatialIndex(asteroid, asteroid.position!);

    const results = queryAsteroidsInRange(new THREE.Vector3(0, 0, 0), 20);
    const matches = results.filter((entity) => entity === asteroid);
    expect(matches).toHaveLength(1);
  });
});
