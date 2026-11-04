import { describe, expect, it } from "vite-plus/test";
import { ASTEROID_POOL_SIZE } from "../config/spawning";
import {
  getAsteroidVisualProfile,
  getLoadTier,
  type AsteroidVisualProfile,
} from "./asteroidVisualQuality";

describe("asteroidVisualQuality", () => {
  it("preserves the current asteroid presentation on full quality", () => {
    expect(getAsteroidVisualProfile("swarmer", "full")).toEqual({
      showTrail: true,
      trailWidth: 0.7,
      trailLength: 4,
      trailDecay: 1.2,
      trailStride: 0.2,
      showEdges: true,
      showTankRing: true,
      showSplitterRings: true,
      showProximityGlow: true,
      animateProximityGlow: true,
      animateTankRing: true,
    });
  });

  it("drops swarmer trails and decorative geometry on reduced quality", () => {
    expect(getAsteroidVisualProfile("swarmer", "reduced")).toEqual({
      showTrail: false,
      trailWidth: 0.5,
      trailLength: 2.2,
      trailDecay: 1,
      trailStride: 0.35,
      showEdges: false,
      showTankRing: false,
      showSplitterRings: false,
      showProximityGlow: true,
      animateProximityGlow: false,
      animateTankRing: false,
    });
  });

  it("keeps a trimmed threat cue for tanks on reduced quality", () => {
    expect(getAsteroidVisualProfile("tank", "reduced")).toEqual({
      showTrail: true,
      trailWidth: 0.6,
      trailLength: 2.8,
      trailDecay: 1,
      trailStride: 0.28,
      showEdges: false,
      showTankRing: true,
      showSplitterRings: false,
      showProximityGlow: true,
      animateProximityGlow: false,
      animateTankRing: false,
    });
  });

  it("reduces asteroids to bare gameplay meshes when effects are off", () => {
    expect(getAsteroidVisualProfile("splitter", "off")).toEqual({
      showTrail: false,
      trailWidth: 0.55,
      trailLength: 0,
      trailDecay: 1,
      trailStride: 0.45,
      showEdges: false,
      showTankRing: false,
      showSplitterRings: false,
      showProximityGlow: false,
      animateProximityGlow: false,
      animateTankRing: false,
    });
  });

  // --- Load tiers ---

  it("bands the active count at the three thresholds", () => {
    expect([0, 1, 19, 20, 39, 40, 49, 50, 60].map(getLoadTier)).toEqual([
      0, 0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it("drops trails from tier 1", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full", 1);
    expect(profile.showTrail).toBe(false);
    // Other effects remain
    expect(profile.showEdges).toBe(true);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("drops trails and edges from tier 2", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full", 2);
    expect(profile.showTrail).toBe(false);
    expect(profile.showEdges).toBe(false);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("drops splitter rings from tier 3", () => {
    const profile = getAsteroidVisualProfile("splitter", "full", 3);
    expect(profile.showTrail).toBe(false);
    expect(profile.showEdges).toBe(false);
    expect(profile.showSplitterRings).toBe(false);
    // Tank ring is a critical threat cue — kept regardless of load
    expect(profile.showTankRing).toBe(true);
  });

  it("applies load-based degradation on top of reduced quality tier", () => {
    // reduced tier already drops trails for swarmers
    const profile = getAsteroidVisualProfile("swarmer", "reduced", 2);
    expect(profile.showTrail).toBe(false); // already off at reduced
    expect(profile.showEdges).toBe(false); // load drops edges
    expect(profile.showSplitterRings).toBe(false); // load drops splitter rings
  });

  it("keeps tank ring as critical threat cue regardless of load", () => {
    const profile = getAsteroidVisualProfile("tank", "full", 3);
    expect(profile.showTankRing).toBe(true);
  });

  it("returns the un-degraded profile at tier 0", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full");
    expect(profile.showTrail).toBe(true);
    expect(profile.showEdges).toBe(true);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("matches the pre-tier count rules at every count, type and quality (#173)", () => {
    const types = ["swarmer", "tank", "splitter"] as const;
    const qualities = ["full", "reduced", "off"] as const;

    for (const type of types) {
      for (const quality of qualities) {
        const base = getAsteroidVisualProfile(type, quality);
        for (let count = 0; count <= ASTEROID_POOL_SIZE; count++) {
          // The count rules as they were before #173; a tier may only replace the
          // raw count if it reproduces these profiles exactly.
          const before: AsteroidVisualProfile = { ...base };
          if (count >= 20) before.showTrail = false;
          if (count >= 40) before.showEdges = false;
          if (count >= 50) before.showSplitterRings = false;

          const after = getAsteroidVisualProfile(type, quality, getLoadTier(count));
          expect(after, `${type}/${quality}/${count}`).toEqual(before);
        }
      }
    }
  });
});
