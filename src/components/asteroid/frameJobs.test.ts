import { describe, expect, it } from "vite-plus/test";
import * as THREE from "three";
import type { GameEntity } from "../../ecs/world";
import {
  type AsteroidFrameState,
  getImminentRatio,
  getProximityGlowIntensity,
  getTankRingOpacity,
  updateHitFlash,
} from "./frameJobs";

const newFrameState = (): AsteroidFrameState => ({
  isFirstActiveFrame: false,
  lastHealthChangedAt: 0,
  flashTimer: 0,
  prevEmissiveIntensity: -1,
  prevTankRingOpacity: -1,
});

describe("getImminentRatio", () => {
  it("is 1 at the platform and 0 from 35 units out", () => {
    expect(getImminentRatio(0, 0, 0)).toBe(1);
    expect(getImminentRatio(17.5, 0, 0)).toBeCloseTo(0.5, 10);
    expect(getImminentRatio(0, 0, 35)).toBe(0);
    expect(getImminentRatio(40, 0, 0)).toBe(0);
  });
});

describe("getProximityGlowIntensity", () => {
  it("uses a steady intensity when the pulse is off or motion is reduced", () => {
    expect(getProximityGlowIntensity(0.8, false, false, 0)).toBeCloseTo(0.32, 10);
    expect(getProximityGlowIntensity(0.5, false, false, 0)).toBe(0);
    expect(getProximityGlowIntensity(0, false, false, 0)).toBe(0);
    // reducedMotion falls back to the same steady branch
    expect(getProximityGlowIntensity(0.8, true, true, 0)).toBeCloseTo(0.32, 10);
  });

  it("pulses with time when animation is on", () => {
    // sin(11 * PI/22) = 1, so the full pulse is visible at ratio 1
    expect(getProximityGlowIntensity(1, true, false, Math.PI / 22)).toBeCloseTo(1.2, 10);
    // sin(0) = 0, so the pulse sits at half strength
    expect(getProximityGlowIntensity(1, true, false, 0)).toBeCloseTo(0.6, 10);
  });
});

describe("getTankRingOpacity", () => {
  it("is hidden when the profile turns the ring off", () => {
    expect(getTankRingOpacity(0.5, false, false, false, 0)).toBe(0);
  });

  it("uses a steady opacity when the pulse is off or motion is reduced", () => {
    expect(getTankRingOpacity(0, true, false, false, 0)).toBeCloseTo(0.3, 10);
    expect(getTankRingOpacity(0.5, true, false, false, 0)).toBeCloseTo(0.45, 10);
    expect(getTankRingOpacity(0.5, true, true, true, 0)).toBeCloseTo(0.45, 10);
  });

  it("pulses with time when animation is on", () => {
    // sin(0) = 0
    expect(getTankRingOpacity(0, true, true, false, 0)).toBeCloseTo(0.1875, 10);
    // sin(1.5 * PI/3) = 1
    expect(getTankRingOpacity(0, true, true, false, Math.PI / 3)).toBeCloseTo(0.25, 10);
  });
});

describe("updateHitFlash", () => {
  const entity = { health: 39, healthChangedAt: 1000 } as GameEntity;

  it("arms the white flash when a damage tick lands and skips redundant intensity writes", () => {
    const material = new THREE.MeshStandardMaterial();
    const frame = newFrameState();

    updateHitFlash(entity, material, frame, 1 / 60);
    expect(frame.flashTimer).toBeCloseTo(0.1 - 1 / 60, 10);
    expect(material.emissive.getHexString()).toBe("ffffff");
    expect(material.emissiveIntensity).toBe(2);

    // Same intensity: the material must not be written again.
    material.emissiveIntensity = 5;
    updateHitFlash(entity, material, frame, 1 / 60);
    expect(material.emissiveIntensity).toBe(5);
  });

  it("does not re-arm the flash while no new damage tick arrives", () => {
    const material = new THREE.MeshStandardMaterial();
    const frame = newFrameState();

    updateHitFlash(entity, material, frame, 1 / 60);
    const armed = frame.flashTimer;
    updateHitFlash(entity, material, frame, 1 / 60);

    expect(frame.flashTimer).toBeLessThan(armed);
  });

  it("clears the flash to black once the timer runs out", () => {
    const material = new THREE.MeshStandardMaterial();
    const frame = {
      ...newFrameState(),
      lastHealthChangedAt: 1000,
      flashTimer: 0.005,
      prevEmissiveIntensity: 2,
    };

    updateHitFlash(entity, material, frame, 0.01);
    expect(frame.flashTimer).toBeLessThan(0);
    expect(material.emissive.getHexString()).toBe("000000");
    expect(material.emissiveIntensity).toBe(0);
  });
});
