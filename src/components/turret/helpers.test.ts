import * as THREE from "three";
import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { ECS, asteroidQuery, updateSpatialIndex, type GameEntity } from "../../ecs/world";
import {
  releaseTarget,
  calculateTurretDamage,
  findTurretTarget,
  TURRET_RANGE,
  TARGETING_PENALTY,
} from "./helpers";

function clearWorld() {
  for (const entity of Array.from(asteroidQuery)) {
    ECS.remove(entity);
  }
}

function addAsteroid(id: string, position: THREE.Vector3) {
  const entity = ECS.add({
    id,
    isAsteroid: true,
    position,
    health: 100,
  });
  updateSpatialIndex();
  return entity;
}

function createTarget(id: string, targetedBy: string | null): GameEntity {
  return { id, targetedBy };
}

describe("Turret Helpers", () => {
  beforeEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  afterEach(() => {
    clearWorld();
    updateSpatialIndex();
  });

  describe("releaseTarget", () => {
    it("should clear targetedBy if it matches the turretId", () => {
      const target = createTarget("target-1", "turret-1");
      releaseTarget(target, "turret-1");
      expect(target.targetedBy).toBeNull();
    });

    it("should not clear targetedBy if it does not match the turretId", () => {
      const target = createTarget("target-1", "turret-2");
      releaseTarget(target, "turret-1");
      expect(target.targetedBy).toBe("turret-2");
    });

    it("should handle null target gracefully", () => {
      expect(() => releaseTarget(null, "turret-1")).not.toThrow();
    });
  });

  describe("calculateTurretDamage", () => {
    it("should return max damage (5.0) at distance 0", () => {
      expect(calculateTurretDamage(0)).toBeCloseTo(5.0);
    });

    it("should return min damage (0.1) at max range", () => {
      expect(calculateTurretDamage(TURRET_RANGE * TURRET_RANGE)).toBeCloseTo(0.1);
    });

    it("should return intermediate damage correctly (midpoint)", () => {
      const midDistSq = (TURRET_RANGE * TURRET_RANGE) / 2;
      expect(calculateTurretDamage(midDistSq)).toBeCloseTo((5.0 + 0.1) / 2);
    });
  });

  describe("findTurretTarget", () => {
    it("should target the nearest asteroid in the correct hemisphere", () => {
      const topTurret = new THREE.Group();
      topTurret.position.set(0, 10, 0);

      const bottomTurret = new THREE.Group();
      bottomTurret.position.set(0, -10, 0);

      addAsteroid("a-top", new THREE.Vector3(0, 5, 10));
      addAsteroid("a-bottom", new THREE.Vector3(0, -5, 10));

      const targetTop = findTurretTarget(topTurret, "t-top");
      const targetBottom = findTurretTarget(bottomTurret, "t-bottom");

      expect(targetTop?.id).toBe("a-top");
      expect(targetBottom?.id).toBe("a-bottom");
    });

    it("should ignore asteroids in the opposite hemisphere", () => {
      const topTurret = new THREE.Group();
      topTurret.position.set(0, 10, 0);

      addAsteroid("a-bottom", new THREE.Vector3(0, -5, 10));

      const target = findTurretTarget(topTurret, "t-top");
      expect(target).toBeNull();
    });

    it("should apply TARGETING_PENALTY to already targeted asteroids", () => {
      const turret = new THREE.Group();
      turret.position.set(0, 10, 0);

      // Targeted asteroid is closer
      const asteroid1 = addAsteroid("a-1", new THREE.Vector3(0, 10, 10)); // distSq = 100
      asteroid1.targetedBy = "other-turret";

      // Untargeted asteroid is slightly further
      const asteroid2 = addAsteroid("a-2", new THREE.Vector3(0, 10, 25)); // distSq = 625

      const targetedScore = 100 + TARGETING_PENALTY;

      // 100 + TARGETING_PENALTY = 500
      // 625 (no penalty)
      // So it should still pick asteroid1 because 500 < 625
      expect(targetedScore).toBe(500);

      const target1 = findTurretTarget(turret, "t-1");
      expect(target1?.id).toBe("a-1");

      // Move asteroid2 closer to flip the decision
      asteroid2.position?.set(0, 10, 15); // distSq = 225
      // Now 500 (asteroid1) vs 225 (asteroid2) -> asteroid2 wins

      updateSpatialIndex();
      const target2 = findTurretTarget(turret, "t-1");
      expect(target2?.id).toBe("a-2");
    });
  });
});
