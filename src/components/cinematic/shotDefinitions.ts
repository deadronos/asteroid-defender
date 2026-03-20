import * as THREE from "three";

/** Seconds each shot is held before the next transition begins */
export const SHOT_DURATION = 17;
/** Seconds the smooth transition between shots takes */
export const TRANSITION_DURATION = 2.5;
/** Orbit angular speed for the wide-orbit shot (radians / second) */
export const ORBIT_SPEED = 0.035;
/**
 * Minimum seconds to hold a shot after a transition completes before
 * allowing the next cut (target-lock hysteresis).
 */
export const POST_TRANSITION_MIN_HOLD = 3;
/**
 * Maximum transition duration (seconds) enforced during active combat.
 * Keeps occlusion periods below the ~1.5 s threshold specified in the
 * readability requirements.
 */
export const COMBAT_MAX_TRANSITION_DURATION = 1.5;
/**
 * Shot indices that are skipped during active combat because they obstruct
 * readability (e.g. occlusion of the base center or low-angle that puts
 * turrets/asteroids mostly off-screen).
 */
export const COMBAT_BLOCKED_SHOTS = new Set([2]);

const turret1LookAt = new THREE.Vector3(5, 1, 0);
const turret2LookAt = new THREE.Vector3(-5, 1, 0);
const lookZero = new THREE.Vector3(0, 0, 0);
const lookHigh = new THREE.Vector3(0, 12, 0);

/** Fixed camera position and look-at used in static (non-cinematic) mode */
export const STATIC_CAMERA_POS = new THREE.Vector3(0, 18, 30);
export const STATIC_CAMERA_LOOK = new THREE.Vector3(0, 0, 0);

export interface ShotDef {
  getPos: (angle: number, t: number, target: THREE.Vector3) => THREE.Vector3;
  getLookAt: () => THREE.Vector3;
  focusDist: number;
}

export const SHOTS: ShotDef[] = [
  {
    getPos: (angle, _, target) => target.set(Math.cos(angle) * 32, 18, Math.sin(angle) * 32),
    getLookAt: () => lookZero,
    focusDist: 0.032,
  },
  {
    getPos: (_, t, target) =>
      target.set(10 + Math.sin(t * 0.25) * 0.35, 6 + Math.cos(t * 0.2) * 0.2, 10),
    getLookAt: () => turret1LookAt,
    focusDist: 0.012,
  },
  {
    getPos: (_, t, target) =>
      target.set(10 + Math.cos(t * 0.3) * 0.3, -9, 10 + Math.sin(t * 0.2) * 0.3),
    getLookAt: () => lookHigh,
    focusDist: 0.025,
  },
  {
    getPos: (_, t, target) =>
      target.set(-18 + Math.sin(t * 0.2) * 0.35, 8, 16 + Math.cos(t * 0.25) * 0.3),
    getLookAt: () => turret2LookAt,
    focusDist: 0.022,
  },
];

export function findNextSafeShot(currentIdx: number, blockedShots: Set<number>): number {
  let candidate = (currentIdx + 1) % SHOTS.length;
  for (let i = 0; i < SHOTS.length; i++) {
    if (!blockedShots.has(candidate)) return candidate;
    candidate = (candidate + 1) % SHOTS.length;
  }
  return currentIdx;
}
