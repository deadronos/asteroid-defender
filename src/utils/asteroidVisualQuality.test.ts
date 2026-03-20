import { describe, expect, it } from "vite-plus/test";
import { getAsteroidVisualProfile } from "./asteroidVisualQuality";

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
});
