import { describe, expect, it } from "vite-plus/test";
import * as THREE from "three";
import {
  createCameraOutputs,
  createCameraState,
  stepCamera,
  type CameraInput,
  type CameraOutputs,
  type CameraState,
} from "./controller";
import {
  COMBAT_MAX_TRANSITION_DURATION,
  ORBIT_SPEED,
  POST_TRANSITION_MIN_HOLD,
  SHOTS,
  SHOT_DURATION,
  STATIC_CAMERA_LOOK,
  STATIC_CAMERA_POS,
  TRANSITION_DURATION,
} from "./shotDefinitions";

const DT = 1 / 60;
const framesFor = (seconds: number) => Math.round(seconds / DT);

/** Steps a state once with a fresh input; returns the outputs it reported. */
function stepOnce(
  state: CameraState,
  overrides: Partial<Omit<CameraInput, "position">> = {},
  outputs: CameraOutputs = createCameraOutputs(),
) {
  const input: CameraInput = {
    delta: DT,
    mode: "cinematic",
    reducedMotion: false,
    isActiveCombat: false,
    position: new THREE.Vector3(),
    ...overrides,
  };
  stepCamera(state, input, outputs);
  return outputs;
}

/** Sequential helper that keeps one camera position and one reused input. */
function harness() {
  const state = createCameraState();
  const outputs = createCameraOutputs();
  // The same initial camera position the scene's Canvas mounts.
  const position = new THREE.Vector3(0, 0, 5);
  const input: CameraInput = {
    delta: DT,
    mode: "cinematic",
    reducedMotion: false,
    isActiveCombat: false,
    position,
  };
  const step = (overrides: Partial<Omit<CameraInput, "position">> = {}) => {
    Object.assign(input, overrides);
    stepCamera(state, input, outputs);
  };
  return { state, outputs, position, step };
}

/** A state sitting still in a shot, with every cut gate already satisfied. */
function steady(overrides: Partial<CameraState> = {}): CameraState {
  return {
    ...createCameraState(),
    firstFrame: false,
    inTransition: false,
    timer: SHOT_DURATION,
    hold: POST_TRANSITION_MIN_HOLD,
    ...overrides,
  };
}

function expectVector(actual: THREE.Vector3, expected: THREE.Vector3) {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
}

describe("stepCamera cut timing", () => {
  it("first holds shot 0 for the full duration, then cuts to shot 1", () => {
    const { state, outputs, step } = harness();

    // Frame 0 starts the intro transition; it completes 2.5 s later.
    step();
    expect(state.inTransition).toBe(true);
    expect(outputs.dofFocusDistance).toBe(SHOTS[0].focusDist);
    expect(outputs.cinematicTransition).toBe(true);

    for (let frame = 1; frame < 1020; frame++) {
      step();
      expect(state.shotIdx).toBe(0);
      if (frame === framesFor(TRANSITION_DURATION)) expect(state.inTransition).toBe(false);
    }

    step();
    expect(state.shotIdx).toBe(1);
    expect(state.timer).toBeCloseTo(0, 10);
    expect(state.inTransition).toBe(true);
    expect(outputs.dofFocusDistance).toBe(SHOTS[1].focusDist);
    expect(outputs.cinematicTransition).toBe(true);
  });

  it("needs both the shot duration and the post-transition hold (hysteresis)", () => {
    // Timer is due but nothing has been held since the last transition yet.
    const early = steady({ timer: SHOT_DURATION, hold: POST_TRANSITION_MIN_HOLD - 0.1 });
    stepOnce(early);
    expect(early.shotIdx).toBe(0);

    // Once the hold is met, the cut fires on the very next frame.
    early.hold = POST_TRANSITION_MIN_HOLD;
    stepOnce(early);
    expect(early.shotIdx).toBe(1);
  });
});

describe("stepCamera in active combat", () => {
  it("skips the blocked shot when a timed cut comes due", () => {
    const state = steady({ shotIdx: 1 });
    const outputs = stepOnce(state, { isActiveCombat: true });
    // Shot 2 is blocked, so the cut skips it.
    expect(state.shotIdx).toBe(3);
    expect(outputs.dofFocusDistance).toBe(SHOTS[3].focusDist);

    // Without combat the same cut goes to shot 2.
    const calm = steady({ shotIdx: 1 });
    stepOnce(calm);
    expect(calm.shotIdx).toBe(2);
  });

  it("pre-empts a blocked shot immediately, but not mid-transition", () => {
    const state = steady({ shotIdx: 2, timer: 1, hold: 1 });
    const outputs = stepOnce(state, { isActiveCombat: true });
    expect(state.shotIdx).toBe(3);
    expect(state.inTransition).toBe(true);
    expect(state.timer).toBe(0);
    expect(state.hold).toBe(0);
    expect(outputs.dofFocusDistance).toBe(SHOTS[3].focusDist);
    expect(outputs.cinematicTransition).toBe(true);

    // A blocked shot that is already being transitioned into is left alone.
    const transitioning = steady({ shotIdx: 2, inTransition: true, transitionT: 0.2 });
    stepOnce(transitioning, { isActiveCombat: true });
    expect(transitioning.shotIdx).toBe(2);
  });

  it("caps transitions to the combat duration, then uses the normal one", () => {
    // Pre-emption starts the transition on the first step, so the first step counts.
    const combat = steady({ shotIdx: 2, timer: 1, hold: 1 });
    stepOnce(combat, { isActiveCombat: true });
    let frames = 1;
    while (combat.inTransition) {
      stepOnce(combat, { isActiveCombat: true });
      frames++;
    }
    // 90 * (1/60) / 1.5 does not sum to exactly 1.0 in floating point, so the
    // capped transition needs one extra frame to finish.
    expect(frames).toBe(91);
    expect(frames).toBeLessThan(framesFor(TRANSITION_DURATION));

    const calm = harness();
    calm.step();
    let calmFrames = 1;
    while (calm.state.inTransition) {
      calm.step();
      calmFrames++;
    }
    expect(calmFrames).toBe(framesFor(TRANSITION_DURATION));
  });
});

describe("stepCamera mode switches", () => {
  it("switches to static mid-transition, reports it, and settles on the overview", () => {
    const { state, outputs, step } = harness();
    for (let i = 0; i < 1100; i++) step();
    expect(state.shotIdx).toBe(1);
    expect(state.inTransition).toBe(true);

    const before = state.activeLook.clone();
    step({ mode: "static" });
    // Starts from wherever the camera was, heading straight for the overview.
    expectVector(state.fromLook, before);
    expectVector(state.toPos, STATIC_CAMERA_POS);
    expectVector(state.toLook, STATIC_CAMERA_LOOK);
    expect(outputs.cinematicTransition).toBe(false);
    expect(outputs.dofFocusDistance).toBeNull();
    expect(outputs.shake).toBe(false);

    for (let i = 0; i < framesFor(TRANSITION_DURATION); i++) step({ mode: "static" });
    expect(state.inTransition).toBe(false);
    expectVector(state.activeLook, STATIC_CAMERA_LOOK);

    // Holding static neither re-writes the store nor shakes.
    step({ mode: "static" });
    expect(outputs.cinematicTransition).toBeNull();
    expect(outputs.shake).toBe(false);
  });

  it("returns to cinematic mid static transition targeting the current shot", () => {
    const { state, outputs, step } = harness();
    for (let i = 0; i < 1100; i++) step();
    step({ mode: "static" });
    for (let i = 0; i < 30; i++) step({ mode: "static" });
    expect(state.inTransition).toBe(true);

    const midStatic = state.activeLook.clone();
    step({ mode: "cinematic" });
    expect(state.inTransition).toBe(true);
    expect(state.timer).toBe(0);
    expect(state.hold).toBe(0);
    expectVector(state.fromLook, midStatic);
    const shotStart = new THREE.Vector3();
    SHOTS[state.shotIdx].getPos(state.orbit, 0, shotStart);
    expectVector(state.toPos, shotStart);
    expect(outputs.dofFocusDistance).toBe(SHOTS[state.shotIdx].focusDist);
    expect(outputs.cinematicTransition).toBe(true);
  });

  it("keeps the static transition on the base duration even with reduced motion", () => {
    const { state, step } = harness();
    step();
    step({ mode: "static", reducedMotion: true });
    let frames = 1;
    while (state.inTransition) {
      step({ mode: "static", reducedMotion: true });
      frames++;
    }
    expect(frames).toBe(framesFor(TRANSITION_DURATION));
  });
});

describe("stepCamera reduced motion", () => {
  it("slows the orbit to 40%", () => {
    const normal = harness();
    const reduced = harness();
    const base = normal.state.orbit;
    normal.step();
    reduced.step({ reducedMotion: true });
    const normalPerFrame = normal.state.orbit - base;
    const reducedPerFrame = reduced.state.orbit - base;
    expect(normalPerFrame).toBeCloseTo(DT * ORBIT_SPEED, 12);
    expect(reducedPerFrame / normalPerFrame).toBeCloseTo(0.4, 12);
  });

  it("doubles the shot duration and the minimum hold", () => {
    // 17 s is not enough with reduced motion, nor is the normal 3 s hold.
    const justDue = steady();
    stepOnce(justDue, { reducedMotion: true });
    expect(justDue.shotIdx).toBe(0);

    const holdDue = steady({ timer: SHOT_DURATION * 2, hold: POST_TRANSITION_MIN_HOLD + 1 });
    stepOnce(holdDue, { reducedMotion: true });
    expect(holdDue.shotIdx).toBe(0);

    const bothDue = steady({ timer: SHOT_DURATION * 2, hold: POST_TRANSITION_MIN_HOLD * 2 });
    const outputs = stepOnce(bothDue, { reducedMotion: true });
    expect(bothDue.shotIdx).toBe(1);
    expect(outputs.dofFocusDistance).toBe(SHOTS[1].focusDist);
  });

  it("stretches transitions to 150%, capped back to 1.5 s in combat", () => {
    const calm = harness();
    calm.step({ reducedMotion: true });
    let frames = 1;
    while (calm.state.inTransition) {
      calm.step({ reducedMotion: true });
      frames++;
    }
    expect(frames).toBe(framesFor(TRANSITION_DURATION * 1.5));

    const combat = harness();
    combat.step({ reducedMotion: true, isActiveCombat: true });
    let combatFrames = 1;
    while (combat.state.inTransition) {
      combat.step({ reducedMotion: true, isActiveCombat: true });
      combatFrames++;
    }
    // Capped back to the combat duration (plus one frame of float rounding).
    expect(combatFrames).toBeGreaterThanOrEqual(framesFor(COMBAT_MAX_TRANSITION_DURATION));
    expect(combatFrames).toBeLessThanOrEqual(framesFor(COMBAT_MAX_TRANSITION_DURATION) + 1);
  });
});
