/**
 * Turret targeting & spatial index benchmarks.
 *
 * Issue #117: Benchmark turret targeting before raising asteroid cap.
 * Tests linear-scan vs indexed-query behaviour around the SPATIAL_INDEX_THRESHOLD (80).
 *
 * Interpreting results:
 *   - Below 80 entities: linear scan is used — fast, no index rebuild cost.
 *   - At/above 80 entities: spatial index is used — adds rebuild cost per frame
 *     but makes individual range queries O(cells) instead of O(n).
 *
 * Key metric: "finds nearest turret target with scoring" is the per-turret cost.
 * With 4 turrets the total cost is roughly 4× that number.
 */
import * as THREE from "three";
import { afterAll, beforeAll, bench, describe } from "vite-plus/test";
import {
  ECS,
  asteroidQuery,
  countAsteroidsInRange,
  findNearestAsteroidInRange,
  markAsteroidDirty,
  updateSpatialIndex,
} from "./world";

const TURRET_RANGE = 50;
const sourcePosition = new THREE.Vector3(5, 1, 0);

function clearWorld() {
  for (const entity of Array.from(asteroidQuery)) {
    ECS.remove(entity);
  }
  // Force a pass-through rebuild so cell bookkeeping is clean across describe blocks.
  markAsteroidDirty();
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

  markAsteroidDirty();
  updateSpatialIndex();
}

// Real-world turret scoring function matching findTurretTarget in turret/helpers.ts
function turretScoring(
  entity: { position?: THREE.Vector3; targetedBy?: string | null },
  distSq: number,
) {
  if (!entity.position) return Infinity;
  if (entity.position.y > 0 !== true) return Infinity;
  return distSq + (entity.targetedBy && entity.targetedBy !== "bench-turret" ? 400 : 0);
}

const SCALES = [10, 30, 60, 80, 90, 120, 200, 400];

for (const scale of SCALES) {
  const mode = scale < 80 ? "linear-scan" : "indexed";

  describe(`spatial index hot paths at ${scale} asteroids (${mode})`, () => {
    beforeAll(() => seedAsteroids(scale));
    afterAll(clearWorld);

    bench("rebuilds spatial index", () => {
      markAsteroidDirty();
      updateSpatialIndex();
    });

    bench("counts nearby asteroids", () => {
      countAsteroidsInRange(new THREE.Vector3(0, 0, 0), 25);
    });

    bench("finds nearest turret target with scoring", () => {
      findNearestAsteroidInRange(sourcePosition, TURRET_RANGE, turretScoring);
    });
  });
}

// ---------------------------------------------------------------------------
// Aggregate frame-time benchmarks
// ---------------------------------------------------------------------------
// Simulates a "worst-case" frame workload at 60 asteroids (current pool cap):
//   - Spatial index rebuild
//   - 4× turret target finds (matching real turret positions)
//   - Active count scan (iterating all entities to filter active ones)
//
// Use this to gauge headroom against the 16.67 ms (60 fps) frame budget.
// The hot-path CPU cost is well under 0.01 ms; real frame time is dominated
// by Rapier physics + Three.js GPU rendering.
// ---------------------------------------------------------------------------

const TURRET_POSITIONS: [number, number, number][] = [
  [5, 1, 0], // t1: top-right
  [-5, 1, 0], // t2: top-left
  [5, -1, 0], // t3: bottom-right
  [-5, -1, 0], // t4: bottom-left
];

const turretPositions = TURRET_POSITIONS.map(([x, y, z]) => new THREE.Vector3(x, y, z));

function turretScoringForPos(turretY: number) {
  const isTopTurret = turretY > 0;
  return (entity: { position?: THREE.Vector3; targetedBy?: string | null }, distSq: number) => {
    if (!entity.position) return Infinity;
    if (entity.position.y > 0 !== isTopTurret) return Infinity;
    return distSq + (entity.targetedBy && entity.targetedBy !== "bench-turret" ? 400 : 0);
  };
}

describe("simulated worst-case frame at 60 asteroids", () => {
  beforeAll(() => seedAsteroids(60));
  afterAll(clearWorld);

  bench("full frame: spatial index rebuild + 4 turret targetings + active count", () => {
    markAsteroidDirty();
    updateSpatialIndex();

    for (let t = 0; t < 4; t++) {
      findNearestAsteroidInRange(
        turretPositions[t],
        TURRET_RANGE,
        turretScoringForPos(TURRET_POSITIONS[t][1]),
      );
    }

    // Active count scan (iterating all entities to check a flag — similar to
    // the .filter() in useAsteroidManager)
    let activeCount = 0;
    const entities = asteroidQuery.entities;
    for (let i = 0; i < entities.length; i++) {
      if (entities[i].isAsteroid) activeCount++;
    }
    void activeCount;
  });
});

describe("simulated worst-case frame at 120 asteroids", () => {
  beforeAll(() => seedAsteroids(120));
  afterAll(clearWorld);

  bench("full frame: spatial index rebuild + 4 turret targetings + active count", () => {
    markAsteroidDirty();
    updateSpatialIndex();

    for (let t = 0; t < 4; t++) {
      findNearestAsteroidInRange(
        turretPositions[t],
        TURRET_RANGE,
        turretScoringForPos(TURRET_POSITIONS[t][1]),
      );
    }

    let activeCount = 0;
    const entities = asteroidQuery.entities;
    for (let i = 0; i < entities.length; i++) {
      if (entities[i].isAsteroid) activeCount++;
    }
    void activeCount;
  });
});
