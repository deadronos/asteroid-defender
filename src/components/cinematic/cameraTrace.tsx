import ReactThreeTestRenderer from "@react-three/test-renderer";
import * as THREE from "three";
import { act } from "react";
import CinematicCamera from "../CinematicCamera";
import useGameStore from "../../store/gameStore";

// Lets act() flush updates and warn about updates outside it; vite-plus does not set it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Records what the real `CinematicCamera` component does, frame by frame, so a
 * refactor can be checked against the pre-refactor behaviour. The fixture
 * `cameraTrace.json` was recorded once from the unchanged component (before
 * the controller existed) and `cameraTrace.test.tsx` compares against it.
 * Regenerating it would erase the baseline, so only do that deliberately.
 *
 * `Date.now()` never enters the trace: `lastDamageTime` stays 0, so the damage
 * shake (the only `Math.random()` user) returns before it touches the camera.
 */

/** Fixed timestep for every recorded frame. */
export const FRAME_DELTA = 1 / 60;
/** Absolute tolerance per camera position / quaternion component. */
export const POSE_TOLERANCE = 1e-6;

export type Pose = [number, number, number, number, number, number, number];
type StorePatch = Partial<ReturnType<typeof useGameStore.getState>>;
/** [frame, 0 = dofFocusDistance, value] or [frame, 1 = inCinematicTransition, 0|1] */
export type StoreWrite = [number, 0 | 1, number];

export interface Scenario {
  frames: number;
  /** Store changes applied immediately before the given frame index. */
  events?: Record<number, StorePatch>;
}

export interface ScenarioTrace {
  poses: Pose[];
  writes: StoreWrite[];
}

export type Trace = { delta: number; scenarios: Record<string, ScenarioTrace> };

/**
 * The same frame schedule is used to record (on the old code) and to compare
 * (after the refactor), so the traces are like-for-like.
 */
export const SCENARIOS: Record<string, Scenario> = {
  // 70 s: shot 0 -> 1 -> 2 -> 3, three full cuts plus steady drift and orbit.
  plain: { frames: 4200 },
  // Combat starts at 40 s while the combat-blocked shot 2 is held, so the
  // camera is pre-empted immediately and transitions at the combat-cap speed;
  // combat ends at 43.3 s, before the next cut.
  combat: {
    frames: 3600,
    events: {
      2400: { activeAsteroids: 1 },
      2600: { activeAsteroids: 0 },
    },
  },
  // Switch to static at 18.3 s (mid 0->1 transition), back to cinematic at
  // 20 s (mid static transition), then run to 45 s.
  modeSwitch: {
    frames: 2700,
    events: { 1100: { cameraMode: "static" }, 1200: { cameraMode: "cinematic" } },
  },
  // Reduced motion turned on at 18.3 s, mid 0->1 transition.
  reducedMotion: {
    frames: 3600,
    events: { 1100: { reducedMotion: true } },
  },
};

const round = (value: number) => Math.round(value * 1e6) / 1e6;

let frame = 0;

export async function recordScenario(scenario: Scenario): Promise<ScenarioTrace> {
  const poses: Pose[] = [];
  const writes: StoreWrite[] = [];

  useGameStore.setState({
    gameState: "playing",
    activeAsteroids: 0,
    cameraMode: "cinematic",
    reducedMotion: false,
    lastDamageTime: 0,
    inCinematicTransition: false,
    dofFocusDistance: 0.032,
  });

  const state = useGameStore.getState();
  const originalDof = state.setDofFocusDistance;
  const originalTransition = state.setCinematicTransition;
  useGameStore.setState({
    setDofFocusDistance: (dist: number) => {
      writes.push([frame, 0, dist]);
      originalDof(dist);
    },
    setCinematicTransition: (active: boolean) => {
      writes.push([frame, 1, active ? 1 : 0]);
      originalTransition(active);
    },
  });

  // The same camera the test renderer would create (75°, near 0.1, far 1000, at
  // 0,0,5), passed in so the trace can read it without a probe component.
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 0, 5);

  const renderer = await ReactThreeTestRenderer.create(<CinematicCamera />, { camera: cam });

  try {
    for (frame = 0; frame < scenario.frames; frame++) {
      const event = scenario.events?.[frame];
      if (event) {
        useGameStore.setState(event);
      }

      await act(async () => {
        await renderer.advanceFrames(1, FRAME_DELTA);
      });

      poses.push([
        round(cam.position.x),
        round(cam.position.y),
        round(cam.position.z),
        round(cam.quaternion.x),
        round(cam.quaternion.y),
        round(cam.quaternion.z),
        round(cam.quaternion.w),
      ]);
    }
  } finally {
    await renderer.unmount();
    useGameStore.setState({
      setDofFocusDistance: originalDof,
      setCinematicTransition: originalTransition,
    });
  }

  return { poses, writes };
}

export async function recordAll(): Promise<Trace> {
  const scenarios: Record<string, ScenarioTrace> = {};
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    scenarios[name] = await recordScenario(scenario);
  }
  return { delta: FRAME_DELTA, scenarios };
}

/** Compares every frame and store write; throws with the first few mismatches. */
export function compareTrace(actual: Trace, expected: Trace) {
  const failures: string[] = [];

  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    const got = actual.scenarios[name];
    const want = expected.scenarios[name];
    if (!want) {
      failures.push(`${name}: no trace recorded`);
      continue;
    }
    if (got.poses.length !== scenario.frames || want.poses.length !== scenario.frames) {
      failures.push(
        `${name}: expected ${scenario.frames} frames, got ${got.poses.length}, recorded ${want.poses.length}`,
      );
      continue;
    }

    for (let i = 0; i < scenario.frames; i++) {
      const a = got.poses[i];
      const e = want.poses[i];
      const bad = a.findIndex((value, c) => Math.abs(value - e[c]) > POSE_TOLERANCE);
      if (bad !== -1) {
        failures.push(
          `${name} frame ${i}: got [${a.join(",")}] expected [${e.join(",")}] (component ${bad})`,
        );
        if (failures.length >= 5) break;
      }
    }

    if (JSON.stringify(got.writes) !== JSON.stringify(want.writes)) {
      failures.push(
        `${name}: store writes differ (got ${JSON.stringify(got.writes)}, expected ${JSON.stringify(want.writes)})`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`camera trace mismatch:\n${failures.join("\n")}`);
  }
}
