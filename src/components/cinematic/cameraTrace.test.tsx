import { describe, expect, it } from "vite-plus/test";
import traceText from "./cameraTrace.json?raw";
import { compareTrace, POSE_TOLERANCE, recordAll, type Trace } from "./cameraTrace";

/**
 * Regression baseline for the cinematic camera, recorded from the component
 * before its state machine moved into `./controller.ts`. It pins every frame's
 * camera position, look direction and every store write, so the refactor is
 * checked against the old behaviour rather than a re-derivation of it.
 *
 * Tolerance: 1e-6 per pose component (the fixture is rounded to 1e-6); store
 * writes are compared exactly. `Date.now()` is kept out via lastDamageTime = 0.
 */
describe("cinematic camera baseline trace", () => {
  it(`matches the pre-refactor trace within ${POSE_TOLERANCE}`, async () => {
    const expected = JSON.parse(traceText) as Trace;
    expect(expected.delta).toBe(1 / 60);
    compareTrace(await recordAll(), expected);
  });

  it("covers the interactions the trace is meant to pin down", async () => {
    const trace = JSON.parse(traceText) as Trace;
    const transitions = (name: keyof typeof trace.scenarios) =>
      trace.scenarios[name].writes.filter((write) => write[1] === 1);
    const dofs = (name: keyof typeof trace.scenarios) =>
      trace.scenarios[name].writes.filter((write) => write[1] === 0);

    // A plain run makes four cuts, alternating transition on/off.
    const plain = transitions("plain");
    expect(plain.filter((write) => write[2] === 1).length).toBeGreaterThanOrEqual(4);
    expect(plain.filter((write) => write[2] === 0).length).toBeGreaterThanOrEqual(3);
    expect(dofs("plain").map((write) => write[2])).toEqual([0.032, 0.012, 0.025, 0.022, 0.032]);

    // Combat begins while the blocked shot is held: a cut starts immediately
    // and, because combat caps transitions at 1.5 s, it completes 90 frames later.
    const combat = transitions("combat");
    const preemption = combat.find((write) => write[2] === 1 && write[0] === 2400);
    expect(preemption).toBeDefined();
    expect(combat.some((write) => write[2] === 0 && write[0] === 2490)).toBe(true);
    // After combat ends, the next cut uses the normal 2.5 s transition again.
    const afterCombat = combat.find((write) => write[2] === 0 && write[0] === 3569);
    expect(afterCombat).toBeDefined();

    // Static mode reports "not transitioning" to the HUD while it holds, and
    // returning to cinematic starts a fresh transition with the shot's focus.
    const mode = transitions("modeSwitch");
    expect(mode.some((write) => write[2] === 0 && write[0] === 1100)).toBe(true);
    expect(mode.some((write) => write[2] === 1 && write[0] === 1200)).toBe(true);
    expect(dofs("modeSwitch").some((write) => write[0] === 1200 && write[2] === 0.012)).toBe(true);

    // Reduced motion mid-transition slows the in-flight 0->1 transition:
    // normally done at frame 1169, it needs until frame 1204.
    const rm = transitions("reducedMotion");
    expect(rm.some((write) => write[2] === 0 && write[0] === 1169)).toBe(false);
    expect(rm.some((write) => write[2] === 0 && write[0] === 1204)).toBe(true);
  });
});
