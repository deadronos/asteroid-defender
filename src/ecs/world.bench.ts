import * as THREE from "three";
import { afterAll, beforeAll, bench, describe } from "vite-plus/test";
import {
  ECS,
  asteroidQuery,
  countAsteroidsInRange,
  findNearestAsteroidInRange,
  updateSpatialIndex,
} from "./world";

function clearWorld() {
  for (const entity of Array.from(asteroidQuery)) {
    ECS.remove(entity);
  }
  updateSpatialIndex();
}

function seedAsteroids(count: number) {
  clearWorld();

  for (let i = 0; i < count; i++) {
    ECS.add({
      id: `bench-${i}`,
      isAsteroid: true,
      position: new THREE.Vector3((i % 12) * 4 - 24, Math.floor(i / 12) * 3 - 12, i % 5),
      health: 100,
    });
  }

  updateSpatialIndex();
}

describe("spatial index hot paths", () => {
  beforeAll(() => seedAsteroids(60));
  afterAll(clearWorld);

  bench("rebuilds the asteroid spatial index", () => {
    updateSpatialIndex();
  });

  bench("counts nearby asteroids from indexed cells", () => {
    countAsteroidsInRange(new THREE.Vector3(0, 0, 0), 25);
  });

  bench("finds nearest turret target with scoring", () => {
    findNearestAsteroidInRange(new THREE.Vector3(5, 1, 0), 50, (entity, distSq) =>
      entity.position && entity.position.y < 0 ? Infinity : distSq,
    );
  });
});
