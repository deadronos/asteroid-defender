import * as THREE from "three";
import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { ECS, asteroidQuery, updateSpatialIndex, type GameEntity } from "../../ecs/world";
import { releaseTarget, findTurretTarget } from "./helpers";
import { TARGETED_DISTANCE_MULTIPLIER } from "../../config/arena";

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

    it("should prefer a free asteroid within the targeting multiplier", () => {
      const turret = new THREE.Group();
      turret.position.set(0, 10, 0);

      // Held by another turret, a bit closer: 12 units -> cost 144 * multiplier
      const asteroid1 = addAsteroid("a-1", new THREE.Vector3(0, 10, 12));
      asteroid1.targetedBy = "other-turret";

      // Free, farther: 15 units -> cost 225
      addAsteroid("a-2", new THREE.Vector3(0, 10, 15));

      // 144 * 2 = 288 > 225, so the free one wins
      expect(144 * TARGETED_DISTANCE_MULTIPLIER).toBeGreaterThan(225);
      expect(findTurretTarget(turret, "t-1")?.id).toBe("a-2");

      // Drag asteroid1 in: 5 units -> cost 50, no longer worth crossing the field
      asteroid1.position?.set(0, 10, 5);
      updateSpatialIndex();
      expect(findTurretTarget(turret, "t-1")?.id).toBe("a-1");
    });

    it("should keep its own target when it is the only candidate", () => {
      const turret = new THREE.Group();
      turret.position.set(0, 10, 0);

      const asteroid = addAsteroid("a-1", new THREE.Vector3(0, 10, 10));
      asteroid.targetedBy = "t-1";

      expect(findTurretTarget(turret, "t-1")?.id).toBe("a-1");
    });
  });
});
