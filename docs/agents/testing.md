# Testing

## Automated tests

- Tests sit next to the code as `*.test.ts` or `*.test.tsx`, and benchmarks as `*.bench.ts`.
- There is no global DOM environment. HUD tests opt into jsdom per file with `// @vitest-environment jsdom` and `@testing-library/react` (see `src/components/hud/HUDStats.test.tsx`), so the scene tests keep the node environment and `@react-three/test-renderer` still mounts R3F without a browser (`src/components/gameScene/AsteroidLayer.test.tsx`). jsdom was chosen over happy-dom because its CSSOM normalizes inline colours, so the critical-health colour assertion checks a real computed value; reset `useGameStore` and `localStorage` in `beforeEach` to keep the HUD tests order-independent.
- Test behaviour at the seam that can break. For a bug fix, confirm the new test fails without the fix.
- When proving a test catches an old bug, restore the real old source with `git show <commit>^:<path>`, not a hand-made imitation. Check that a behavioural assertion is what fails: an earlier assertion can stop the test before it reaches them.

## Scene tests

- Physics mounts asynchronously. In `src/components/gameScene/AsteroidLayer.test.tsx`, `settle()` waits until every pooled asteroid has its rigid body before the test asserts or advances frames.
- Call `act()` once per frame. Several frames inside one `act()` don't render between frames, so a dying asteroid keeps its `active` prop and runs its destroy path on every frame. Use one frame per `act()` to count destroys; `AsteroidLayer.test.tsx` does this in the shield impact test.

## Why tests aren't enough

`vp check` and `vp test` both stayed green while the released game jammed within seconds (#156), and while `vp dev` crashed on load (#185). If a change affects gameplay, rendering or anything that runs during render, also run it in a browser.

## Checking a change in the browser

The app is served under a base path, so use the URL `vp` prints, which ends in `/asteroid-defender/`.

1. Start `vp dev`, or `vp build` and `vp preview` for production behaviour and any performance claim. Dev tracing distorts timings.
2. Use a fresh profile, so saved onboarding and telemetry settings don't hide problems.
3. Start a run with the real **Start Defense** button.
4. Confirm the canvas renders, with no error screen and no console errors.
5. Watch the HUD for a while. **Destroyed** should climb at a plausible rate, **Active Swarm** should move up and down, and **Base Integrity** should respond to hits.
6. For pool or lifecycle changes, also play through to game over and restart. Confirm the new run starts clean.

Normal play may not stress a change enough. Under dev, you can drive the running game by importing the same modules it uses:

```js
const { usePoolStore } = await import("/asteroid-defender/src/store/poolStore.ts");
usePoolStore.getState().activeAsteroidCount;
```

Report what you ran, for how long and what you saw. Headless Chrome with software rendering is fine for checking behaviour, but its frame rates say nothing about real devices.

Gameplay randomness is seeded (`utils/rng.ts`): add `?seed=<n>` to replay the exact spawn, turret and explosion sequence, and the seed used appears in dev telemetry as `rng:seed`. Background dust and shooting stars stay on `Math.random()` on purpose.
