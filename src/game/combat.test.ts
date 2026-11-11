import { describe, expect, it } from "vite-plus/test";
import type { GameEntity } from "../ecs/world";
import { TURRET_RANGE } from "../config/arena";
import {
  MAX_DELTA_CLAMP,
  TURRET_MAX_DPS,
  TURRET_MIN_DPS,
  applyTurretDamage,
  calculateTurretDamage,
  calculateTurretDps,
  markBaseHit,
} from "./combat";

const SWARMER_HEALTH = 40;

function asteroid(id: string, health: number): GameEntity {
  return { id, isAsteroid: true, health };
}

describe("calculateTurretDps", () => {
  it("should calculate max DPS at distance 0", () => {
    expect(calculateTurretDps(0)).toBeCloseTo(TURRET_MAX_DPS);
  });

  it("should calculate min DPS at max range", () => {
    expect(calculateTurretDps(TURRET_RANGE * TURRET_RANGE)).toBeCloseTo(TURRET_MIN_DPS);
  });

  it("should calculate intermediate DPS correctly (midpoint)", () => {
    const midDistSq = (TURRET_RANGE * TURRET_RANGE) / 2;
    const expectedDps = (TURRET_MAX_DPS + TURRET_MIN_DPS) / 2;
    expect(calculateTurretDps(midDistSq)).toBeCloseTo(expectedDps);
  });
});

describe("calculateTurretDamage", () => {
  it("should scale damage with delta per frame", () => {
    const dt60 = 1 / 60;
    const dt120 = 1 / 120;
    const damageAt60 = calculateTurretDamage(0, dt60);
    const damageAt120 = calculateTurretDamage(0, dt120);

    expect(damageAt60).toBeCloseTo(TURRET_MAX_DPS * dt60);
    expect(damageAt120).toBeCloseTo(TURRET_MAX_DPS * dt120);
    expect(damageAt60).toBeCloseTo(damageAt120 * 2);
  });

  it("should default delta to 1/60s when omitted", () => {
    expect(calculateTurretDamage(0)).toBeCloseTo(TURRET_MAX_DPS * (1 / 60));
  });

  it("should clamp large delta spikes to MAX_DELTA_CLAMP", () => {
    const hugeDelta = 2.0;
    expect(calculateTurretDamage(0, hugeDelta)).toBeCloseTo(TURRET_MAX_DPS * MAX_DELTA_CLAMP);
  });

  it("should clamp negative delta to 0", () => {
    expect(calculateTurretDamage(0, -1)).toBe(0);
  });
});

describe("applyTurretDamage", () => {
  it("removes exactly calculateTurretDamage for the given distance and delta", () => {
    const entity = asteroid("a-1", SWARMER_HEALTH);
    const distSq = 625;
    const delta = 1 / 60;
    const expected = calculateTurretDamage(distSq, delta);

    const applied = applyTurretDamage(entity, distSq, delta, "t-1");

    expect(applied).toBe(expected);
    expect(entity.health).toBeCloseTo(SWARMER_HEALTH - expected);
  });

  it("uses the delta clamp, so a long frame cannot deal more than MAX_DELTA_CLAMP worth", () => {
    const entity = asteroid("a-1", 1000);

    const applied = applyTurretDamage(entity, 0, 5, "t-1");

    expect(applied).toBeCloseTo(TURRET_MAX_DPS * MAX_DELTA_CLAMP);
    expect(entity.health).toBeCloseTo(1000 - TURRET_MAX_DPS * MAX_DELTA_CLAMP);
  });

  it("kills a swarmer in the expected number of frames", () => {
    const entity = asteroid("a-1", SWARMER_HEALTH);
    const delta = 1 / 60;
    const perFrame = applyTurretDamage(entity, 0, delta, "t-1");
    expect(perFrame).toBeCloseTo(3);

    const framesToKill = Math.ceil(SWARMER_HEALTH / perFrame);
    expect(framesToKill).toBe(14);

    for (let frame = 1; frame < framesToKill - 1; frame++) {
      applyTurretDamage(entity, 0, delta, "t-1");
      expect(entity.health).toBeGreaterThan(0);
    }

    applyTurretDamage(entity, 0, delta, "t-1");
    // Clamped to what was left, so a kill lands exactly on zero (#182).
    expect(entity.health).toBe(0);
  });
});

describe("attribution", () => {
  it("records which turret applied the damage", () => {
    const entity = asteroid("a-1", SWARMER_HEALTH);

    applyTurretDamage(entity, 625, 1 / 60, "t-3");

    expect(entity.lastHitBy).toBe("t-3");
  });

  it("stamps the damage tick so the hit flash needs no health diff", () => {
    const entity = asteroid("a-1", SWARMER_HEALTH);

    applyTurretDamage(entity, 625, 1 / 60, "t-3");

    expect(entity.healthChangedAt).toBeTypeOf("number");
  });

  it("never deals more than the remaining health", () => {
    const entity = asteroid("a-1", 1);

    const applied = applyTurretDamage(entity, 0, 1 / 60, "t-1");

    expect(applied).toBe(1);
    expect(entity.health).toBe(0);
  });

  it("clears attribution when the base delivers the killing blow", () => {
    const entity = asteroid("a-1", SWARMER_HEALTH);
    applyTurretDamage(entity, 625, 1 / 60, "t-1");

    markBaseHit([entity], "a-1");

    expect(entity.lastHitBy).toBeNull();
    expect(entity.isBaseHit).toBe(true);
  });
});

describe("markBaseHit", () => {
  it("marks the matching live asteroid and zeroes its health", () => {
    const target = asteroid("a-1", SWARMER_HEALTH);
    const bystander = asteroid("a-2", SWARMER_HEALTH);

    expect(markBaseHit([bystander, target], "a-1")).toBe(true);

    expect(target.isBaseHit).toBe(true);
    expect(target.health).toBe(0);
    expect(bystander.isBaseHit).toBeUndefined();
    expect(bystander.health).toBe(SWARMER_HEALTH);
  });

  it("does nothing on a second hit for the same asteroid", () => {
    const target = asteroid("a-1", SWARMER_HEALTH);
    const entities = [target];
    expect(markBaseHit(entities, "a-1")).toBe(true);

    expect(markBaseHit(entities, "a-1")).toBe(false);
    expect(target.health).toBe(0);
    expect(target.isBaseHit).toBe(true);
  });

  it("ignores an unknown id and leaves every entity alone", () => {
    const first = asteroid("a-1", SWARMER_HEALTH);
    const second = asteroid("a-2", SWARMER_HEALTH);

    expect(markBaseHit([first, second], "missing")).toBe(false);

    for (const entity of [first, second]) {
      expect(entity.health).toBe(SWARMER_HEALTH);
      expect(entity.isBaseHit).toBeUndefined();
    }
  });

  it("ignores an asteroid that is already dead", () => {
    const dead = asteroid("a-1", 0);

    expect(markBaseHit([dead], "a-1")).toBe(false);
    expect(dead.isBaseHit).toBeUndefined();
  });
});
