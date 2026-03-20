import type { AsteroidType } from "../ecs/world";
import type { EffectsQuality } from "./visualQuality";

export interface AsteroidVisualProfile {
  showTrail: boolean;
  trailWidth: number;
  trailLength: number;
  trailDecay: number;
  trailStride: number;
  showEdges: boolean;
  showTankRing: boolean;
  showSplitterRings: boolean;
  showProximityGlow: boolean;
  animateProximityGlow: boolean;
  animateTankRing: boolean;
}

const FULL_PROFILE: AsteroidVisualProfile = {
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
};

const OFF_PROFILE: AsteroidVisualProfile = {
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
};

export function getAsteroidVisualProfile(
  type: AsteroidType,
  quality: EffectsQuality,
): AsteroidVisualProfile {
  if (quality === "full") {
    return FULL_PROFILE;
  }

  if (quality === "off") {
    return OFF_PROFILE;
  }

  return {
    showTrail: type !== "swarmer",
    trailWidth: type === "tank" ? 0.6 : 0.5,
    trailLength: type === "tank" ? 2.8 : 2.2,
    trailDecay: 1,
    trailStride: type === "tank" ? 0.28 : 0.35,
    showEdges: false,
    showTankRing: type === "tank",
    showSplitterRings: false,
    showProximityGlow: true,
    animateProximityGlow: false,
    animateTankRing: false,
  };
}
