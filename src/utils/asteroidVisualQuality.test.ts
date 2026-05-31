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

  // --- Load-based degradation ---

  it("drops trails when active asteroid count >= 20", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full", 20);
    expect(profile.showTrail).toBe(false);
    // Other effects remain
    expect(profile.showEdges).toBe(true);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("drops trails and edges when active asteroid count >= 40", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full", 40);
    expect(profile.showTrail).toBe(false);
    expect(profile.showEdges).toBe(false);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("drops splitter rings when active asteroid count >= 50", () => {
    const profile = getAsteroidVisualProfile("splitter", "full", 50);
    expect(profile.showTrail).toBe(false);
    expect(profile.showEdges).toBe(false);
    expect(profile.showSplitterRings).toBe(false);
    // Tank ring is a critical threat cue — kept regardless of load
    expect(profile.showTankRing).toBe(true);
  });

  it("applies load-based degradation on top of reduced quality tier", () => {
    // reduced tier already drops trails for swarmers
    const profile = getAsteroidVisualProfile("swarmer", "reduced", 40);
    expect(profile.showTrail).toBe(false); // already off at reduced
    expect(profile.showEdges).toBe(false); // load drops edges
    expect(profile.showSplitterRings).toBe(false); // load drops splitter rings
  });

  it("keeps tank ring as critical threat cue regardless of load", () => {
    const profile = getAsteroidVisualProfile("tank", "full", 60);
    expect(profile.showTankRing).toBe(true);
  });

  it("returns base profile when activeAsteroidCount is undefined", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full");
    expect(profile.showTrail).toBe(true);
    expect(profile.showEdges).toBe(true);
    expect(profile.showSplitterRings).toBe(true);
  });

  it("does not drop effects below load thresholds", () => {
    const profile = getAsteroidVisualProfile("swarmer", "full", 19);
    expect(profile.showTrail).toBe(true);
    expect(profile.showEdges).toBe(true);
    expect(profile.showSplitterRings).toBe(true);
  });
});
