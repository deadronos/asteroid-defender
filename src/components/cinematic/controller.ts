import * as THREE from "three";
import type { CameraMode } from "../../store/gameStore";
import { smoothstep } from "./cameraEffects";
import {
  COMBAT_BLOCKED_SHOTS,
  COMBAT_MAX_TRANSITION_DURATION,
  findNextSafeShot,
  ORBIT_SPEED,
  POST_TRANSITION_MIN_HOLD,
  SHOTS,
  SHOT_DURATION,
  STATIC_CAMERA_LOOK,
  STATIC_CAMERA_POS,
  TRANSITION_DURATION,
} from "./shotDefinitions";

/**
 * Pure state machine behind the cinematic camera.
 *
 * `stepCamera` is called once per frame. Both `state` and `outputs` are
 * allocated once and mutated in place, and every vector is reused, so a frame
 * allocates nothing. Plain numbers would work too, but reusing `THREE.Vector3`
 * keeps the solvers (`lerpVectors`, `getPos`) identical to the original code.
 *
 * The controller does not touch the store: `outputs` reports the two writes the
 * component has to mirror (`setDofFocusDistance`, `setCinematicTransition`)
 * with the same timing as before, and `outputs.shake` says whether the damage
 * shake (which draws from the seeded `utils/rng.ts`) may run this frame.
 */

export interface CameraState {
  shotIdx: number;
  timer: number;
  orbit: number;

  /** Mirrors the old `inTransition` ref. */
  inTransition: boolean;
  /** 0..1 progress of the current transition. */
  transitionT: number;
  /** Pose captured when a transition starts. */
  fromPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  /** Pose the current transition is heading to. */
  toPos: THREE.Vector3;
  toLook: THREE.Vector3;
  /** Look-at interpolated every frame; the camera lookAt() this after each step. */
  activeLook: THREE.Vector3;

  firstFrame: boolean;
  /** Seconds spent in the current shot after its transition completed. */
  hold: number;
  /** Camera mode seen on the previous frame, to detect runtime switches. */
  mode: CameraMode;
  /** Mirrors the last `setCinematicTransition` value pushed to the store. */
  storeTransition: boolean;
}

/** @param position the live camera position, read at the start and written in steady state. */
export interface CameraInput {
  delta: number;
  mode: CameraMode;
  reducedMotion: boolean;
  isActiveCombat: boolean;
  position: THREE.Vector3;
}

/** Store writes and side effects the component must apply after the step. */
export interface CameraOutputs {
  /** Non-null on frames that must call `setDofFocusDistance`. */
  dofFocusDistance: number | null;
  /** Non-null on frames that must call `setCinematicTransition`. */
  cinematicTransition: boolean | null;
  /** False in static mode, where the original code skipped the damage shake. */
  shake: boolean;
}

export function createCameraState(): CameraState {
  return {
    shotIdx: 0,
    timer: 0,
    // Small initial offset so the orbit feels natural (matches the old ref).
    orbit: 0.1,
    inTransition: false,
    transitionT: 0,
    fromPos: new THREE.Vector3(0, 15, 25), // matches the Canvas initial position
    fromLook: new THREE.Vector3(0, 0, 0),
    toPos: new THREE.Vector3(),
    toLook: new THREE.Vector3(),
    activeLook: new THREE.Vector3(0, 0, 0),
    firstFrame: true,
    hold: 0,
    // Initialised to the store default so mounting never looks like a switch.
    mode: "cinematic",
    storeTransition: false,
  };
}

export function createCameraOutputs(): CameraOutputs {
  return { dofFocusDistance: null, cinematicTransition: null, shake: false };
}

export function stepCamera(
  state: CameraState,
  input: CameraInput,
  outputs: CameraOutputs,
): CameraState {
  outputs.dofFocusDistance = null;
  outputs.cinematicTransition = null;
  outputs.shake = false;

  const { delta, mode, reducedMotion, isActiveCombat } = input;

  // Multipliers applied when reducedMotion is active
  const orbitMult = reducedMotion ? 0.4 : 1.0;
  const driftMult = reducedMotion ? 0.3 : 1.0;
  const activeShotDuration = reducedMotion ? SHOT_DURATION * 2 : SHOT_DURATION;
  const activeTransitionDuration = reducedMotion ? TRANSITION_DURATION * 1.5 : TRANSITION_DURATION;
  const minHold = reducedMotion ? POST_TRANSITION_MIN_HOLD * 2 : POST_TRANSITION_MIN_HOLD;

  // During active combat, cap transitions to COMBAT_MAX_TRANSITION_DURATION
  // to avoid occlusion periods longer than ~1.5 s.
  const effectiveTransitionDuration = isActiveCombat
    ? Math.min(activeTransitionDuration, COMBAT_MAX_TRANSITION_DURATION)
    : activeTransitionDuration;

  state.orbit += delta * ORBIT_SPEED * orbitMult;
  state.timer += delta;

  const shot = SHOTS[state.shotIdx];

  // ── One-time initialisation: kick off a transition into shot 0 ──────
  if (state.firstFrame) {
    state.firstFrame = false;
    state.fromPos.copy(input.position);
    state.fromLook.set(0, 0, 0);
    shot.getPos(state.orbit, 0, state.toPos);
    state.toLook.copy(shot.getLookAt());
    state.inTransition = true;
    state.transitionT = 0;
    state.timer = 0;
    state.hold = 0;
    outputs.dofFocusDistance = shot.focusDist;
  }

  // ── Detect runtime camera-mode switch and start a smooth transition ──
  if (state.mode !== mode) {
    state.mode = mode;
    state.fromPos.copy(input.position);
    state.fromLook.copy(state.activeLook);
    if (mode === "static") {
      state.toPos.copy(STATIC_CAMERA_POS);
      state.toLook.copy(STATIC_CAMERA_LOOK);
    } else {
      // Re-entering cinematic: smoothly move to the current shot's start
      shot.getPos(state.orbit, 0, state.toPos);
      state.toLook.copy(shot.getLookAt());
      state.timer = 0;
      state.hold = 0;
      outputs.dofFocusDistance = shot.focusDist;
    }
    state.inTransition = true;
    state.transitionT = 0;
  }

  // ── Static mode: handle transition to overview then hold ─────────────
  if (mode === "static") {
    if (state.inTransition) {
      state.transitionT = Math.min(state.transitionT + delta / TRANSITION_DURATION, 1);
      const t = smoothstep(state.transitionT);
      input.position.lerpVectors(state.fromPos, state.toPos, t);
      state.activeLook.lerpVectors(state.fromLook, state.toLook, t);
      if (state.transitionT >= 1) {
        state.inTransition = false;
      }
    }
    // Static mode is never mid-cinematic-transition from the HUD's perspective.
    if (state.storeTransition) {
      state.storeTransition = false;
      outputs.cinematicTransition = false;
    }
    return state;
  }

  // ── Cinematic mode ───────────────────────────────────────────────────

  // During active combat, if the current shot is a readability-blocked
  // shot (e.g. the low-angle shot) and we are not already transitioning,
  // immediately begin an eased cut to the next safe shot regardless of
  // the normal hold/duration timers.
  if (isActiveCombat && COMBAT_BLOCKED_SHOTS.has(state.shotIdx) && !state.inTransition) {
    state.fromPos.copy(input.position);
    state.fromLook.copy(state.activeLook);

    const safeIdx = findNextSafeShot(state.shotIdx, COMBAT_BLOCKED_SHOTS);
    state.shotIdx = safeIdx;
    const safeShot = SHOTS[safeIdx];
    safeShot.getPos(state.orbit, 0, state.toPos);
    state.toLook.copy(safeShot.getLookAt());
    state.inTransition = true;
    state.transitionT = 0;
    state.timer = 0;
    state.hold = 0;
    outputs.dofFocusDistance = safeShot.focusDist;
  }

  // Trigger transition to next shot only after the shot duration AND the
  // minimum post-transition hold (hysteresis) have both elapsed.
  if (!state.inTransition && state.timer >= activeShotDuration && state.hold >= minHold) {
    state.fromPos.copy(input.position);
    state.fromLook.copy(state.activeLook);

    // Advance to the next shot, skipping any that are blocked during
    // active combat to preserve readability.
    const nextIdx = isActiveCombat
      ? findNextSafeShot(state.shotIdx, COMBAT_BLOCKED_SHOTS)
      : (state.shotIdx + 1) % SHOTS.length;
    state.shotIdx = nextIdx;
    const next = SHOTS[nextIdx];

    next.getPos(state.orbit, 0, state.toPos);
    state.toLook.copy(next.getLookAt());
    state.inTransition = true;
    state.transitionT = 0;
    state.timer = 0;
    state.hold = 0;
    outputs.dofFocusDistance = next.focusDist;
  }

  // ── Animate camera this frame ────────────────────────────────────────
  if (state.inTransition) {
    state.transitionT = Math.min(state.transitionT + delta / effectiveTransitionDuration, 1);
    const t = smoothstep(state.transitionT);
    input.position.lerpVectors(state.fromPos, state.toPos, t);
    state.activeLook.lerpVectors(state.fromLook, state.toLook, t);
    if (state.transitionT >= 1) {
      state.inTransition = false;
      state.hold = 0;
    }
  } else {
    // Steady shot – orbit continuously for shot 0, subtle drift for others.
    // driftMult scales down oscillation time so reduced-motion produces
    // significantly less positional movement.
    state.hold += delta;
    shot.getPos(state.orbit, state.timer * driftMult, input.position);
    state.activeLook.copy(shot.getLookAt());
  }

  // Notify the store when transition state changes so the HUD indicator
  // can show / hide the "Cinematic sweep" label.
  if (state.inTransition !== state.storeTransition) {
    state.storeTransition = state.inTransition;
    outputs.cinematicTransition = state.inTransition;
  }

  outputs.shake = true;
  return state;
}
