/**
 * Pool store benchmarks (issue #172).
 *
 * The pool store is where every asteroid and explosion allocation happens. It
 * is a plain Zustand module, so it benchmarks in Node without React or a DOM.
 *
 * Cases against the shipped 60-slot pool (`ASTEROID_POOL_SIZE`):
 *   1. activate 1 into 10 active slots — fast path: one array copy + one slot
 *   2. activate 4 (MAX_ACTIVATIONS_PER_FRAME) into 10 active slots
 *   3. deactivate 1 of 20 — one array copy + one slot + free-list push
 *   4. activate 4 with 1 free slot — slow path: rebuild the free list and the
 *      id-to-index map, activate the 1 that fits, starve the other 3
 *
 * Case 4 is not the "deactivate 4 in one call" setup the issue proposed:
 * `deactivateAsteroid` pushes the freed index back onto the free list, so
 * deactivating never forces the slow path. The slow path fires when an
 * activation asks for more slots than the free list holds, which in play
 * needs the pool near full (59 of 60 active here) — reachable once splitter
 * fragments eat the reserve.
 *
 * Setup vs measurement: the pool has to be re-seeded before every iteration or
 * the timed operation would run against exhausted state. Each task passes
 * `beforeEach`/`afterEach` hooks; tinybench runs them outside the timed
 * window, so the numbers cover the store call only, not `resetPools`. The
 * `afterEach` hooks also assert the operation took the intended path, so this
 * bench cannot quietly measure the fast path while claiming to measure the
 * slow one.
 */
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import { usePoolStore } from "./poolStore";
import type { AsteroidType } from "../ecs/world";
import { getSpawnStatsSnapshot } from "../ecs/spawnStats";
import { ASTEROID_POOL_SIZE, MAX_ACTIVATIONS_PER_FRAME } from "../config/spawning";

interface Spawn {
  pos: [number, number, number];
  type: AsteroidType;
}

const POOL_SIZE = ASTEROID_POOL_SIZE;

// Cache the store object so the timed functions do not pay a module export
// getter on every iteration (same reason as world.bench.ts's warnings).
const store = usePoolStore;

function makeSpawns(count: number): Spawn[] {
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    spawns.push({ pos: [i, 0, 0], type: "swarmer" });
  }
  return spawns;
}

/**
 * `time: 0` turns the time budget off so each task runs exactly `iterations`
 * samples. Without it tinybench keeps sampling until its default 1 s *measured*
 * budget is spent; at ~0.5 µs per call that is ~2 M iterations, and the
 * `resetPools` setup between them (outside the timed window) then takes over a
 * minute of wall time.
 */
const RUN_OPTIONS = {
  time: 0,
  warmupTime: 0,
  iterations: 20_000,
  warmupIterations: 2_000,
};

const oneSpawn = makeSpawns(1);
const fourSpawns = makeSpawns(MAX_ACTIVATIONS_PER_FRAME);

beforeAll(() => {
  // tinybench calls each benchmark function once at registration to detect
  // whether it returns a promise, with no hooks run. Seed first so that probe
  // sees a usable pool instead of the empty initial state, which would log the
  // "pool saturated" warning before the first sample.
  seed(10);
});

/** Reset to a 60-slot pool with `active` slots already taken, in one call. */
function seed(active: number) {
  store.getState().resetPools(POOL_SIZE);
  if (active > 0) {
    store.getState().activateAsteroids(makeSpawns(active));
  }
  if (store.getState().activeAsteroidCount !== active) {
    throw new Error(
      `seed(${active}) produced ${store.getState().activeAsteroidCount} active slots`,
    );
  }
}

function assertActive(expected: number) {
  const { activeAsteroidCount } = store.getState();
  if (activeAsteroidCount !== expected) {
    throw new Error(`expected ${expected} active slots, saw ${activeAsteroidCount}`);
  }
}

function firstActiveId(): string {
  const slot = store.getState().asteroids.find((asteroid) => asteroid.active);
  if (!slot) {
    throw new Error("seed left no active slot to deactivate");
  }
  return slot.id;
}

/**
 * Mirrors `useShallow((s) => s.asteroids)` in AsteroidLayer: notify only when a
 * slot reference (or the array) changes. The real subscriber also re-renders 60
 * Asteroid components, which a Node bench cannot measure; this covers the
 * comparison and the notification/selector work.
 */
let subscriberNotifications = 0;

function shallowAsteroidSubscriber() {
  return store.subscribe((state, previous) => {
    const next = state.asteroids;
    const prev = previous.asteroids;
    if (next === prev) return;
    if (next.length !== prev.length) {
      subscriberNotifications++;
      return;
    }
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== prev[i]) {
        subscriberNotifications++;
        return;
      }
    }
  });
}

describe("poolStore: activate 1 (fast path)", () => {
  test("activate 1 into 10 active slots", async ({ bench }) => {
    await bench(
      "activate 1 into 10 active slots",
      {
        beforeEach: () => seed(10),
        afterEach: () => {
          const state = store.getState();
          assertActive(11);
          if (state.asteroidFreeList.length !== POOL_SIZE - 11) {
            throw new Error(`free list should hold ${POOL_SIZE - 11} indices`);
          }
        },
      },
      () => {
        store.getState().activateAsteroids(oneSpawn);
      },
    ).run(RUN_OPTIONS);
  });
});

describe("poolStore: activate 4 (fast path)", () => {
  test("activate 4 (MAX_ACTIVATIONS_PER_FRAME) into 10 active slots", async ({ bench }) => {
    await bench(
      "activate 4 (MAX_ACTIVATIONS_PER_FRAME) into 10 active slots",
      {
        beforeEach: () => seed(10),
        afterEach: () => {
          const state = store.getState();
          assertActive(10 + MAX_ACTIVATIONS_PER_FRAME);
          if (state.asteroidFreeList.length !== POOL_SIZE - 10 - MAX_ACTIVATIONS_PER_FRAME) {
            throw new Error("free list did not shrink by MAX_ACTIVATIONS_PER_FRAME");
          }
        },
      },
      () => {
        store.getState().activateAsteroids(fourSpawns);
      },
    ).run(RUN_OPTIONS);
  });
});

describe("poolStore: deactivate 1", () => {
  test("deactivate 1 of 20 active slots", async ({ bench }) => {
    let activeId = "";

    await bench(
      "deactivate 1 of 20 active slots",
      {
        beforeEach: () => {
          seed(20);
          activeId = firstActiveId();
        },
        afterEach: () => {
          const state = store.getState();
          assertActive(19);
          if (state.asteroidFreeList.length !== POOL_SIZE - 19) {
            throw new Error(`free list should hold ${POOL_SIZE - 19} indices`);
          }
        },
      },
      () => {
        store.getState().deactivateAsteroid(activeId);
      },
    ).run(RUN_OPTIONS);
  });
});

describe("poolStore: activate 4 with 1 free slot (slow path)", () => {
  test("activate 4 with 1 free slot rebuilds bookkeeping and starves 3", async ({ bench }) => {
    let starvedBefore = 0;

    await bench(
      "activate 4 with 1 free slot (slow path: rebuild + starve)",
      {
        beforeEach: () => {
          seed(POOL_SIZE - 1);
          if (store.getState().asteroidFreeList.length !== 1) {
            // Guard: without exactly one free slot this would measure the fast
            // path or the fully saturated early return instead.
            throw new Error("slow-path bench needs exactly one free slot");
          }
          starvedBefore = getSpawnStatsSnapshot().starvedDrops;
        },
        afterEach: () => {
          const state = store.getState();
          assertActive(POOL_SIZE);
          if (state.asteroidFreeList.length !== 0) {
            throw new Error("slow path should have consumed the last free slot");
          }
          if (state.asteroidIdToIndex.size !== POOL_SIZE) {
            throw new Error("slow path should have rebuilt the id-to-index map");
          }
          const starved = getSpawnStatsSnapshot().starvedDrops - starvedBefore;
          if (starved !== MAX_ACTIVATIONS_PER_FRAME - 1) {
            throw new Error(
              `expected ${MAX_ACTIVATIONS_PER_FRAME - 1} starved spawns, saw ${starved}`,
            );
          }
        },
      },
      () => {
        store.getState().activateAsteroids(fourSpawns);
      },
    ).run(RUN_OPTIONS);
  });
});

describe("poolStore: with a useShallow-style asteroid subscriber", () => {
  let unsubscribe: () => void;

  beforeAll(() => {
    unsubscribe = shallowAsteroidSubscriber();

    // Sanity-check the subscriber before timing anything: one activation must
    // produce exactly one notification, or the "with subscriber" numbers are
    // measuring nothing.
    seed(0);
    const before = subscriberNotifications;
    store.getState().activateAsteroids(oneSpawn);
    if (subscriberNotifications - before !== 1) {
      throw new Error("shallow asteroid subscriber missed an activation");
    }
  });

  afterAll(() => {
    unsubscribe();
  });

  test("activate 1 into 10 active slots with subscriber", async ({ bench }) => {
    await bench(
      "activate 1 into 10 active slots (subscriber attached)",
      {
        beforeEach: () => seed(10),
        afterEach: () => assertActive(11),
      },
      () => {
        store.getState().activateAsteroids(oneSpawn);
      },
    ).run(RUN_OPTIONS);
  });

  test("activate 4 into 10 active slots with subscriber", async ({ bench }) => {
    await bench(
      "activate 4 (MAX_ACTIVATIONS_PER_FRAME) into 10 active slots (subscriber attached)",
      {
        beforeEach: () => seed(10),
        afterEach: () => assertActive(10 + MAX_ACTIVATIONS_PER_FRAME),
      },
      () => {
        store.getState().activateAsteroids(fourSpawns);
      },
    ).run(RUN_OPTIONS);
  });

  test("deactivate 1 of 20 active slots with subscriber", async ({ bench }) => {
    let activeId = "";

    await bench(
      "deactivate 1 of 20 active slots (subscriber attached)",
      {
        beforeEach: () => {
          seed(20);
          activeId = firstActiveId();
        },
        afterEach: () => assertActive(19),
      },
      () => {
        store.getState().deactivateAsteroid(activeId);
      },
    ).run(RUN_OPTIONS);
  });

  test("activate 4 with 1 free slot (slow path) with subscriber", async ({ bench }) => {
    await bench(
      "activate 4 with 1 free slot (slow path, subscriber attached)",
      {
        beforeEach: () => {
          seed(POOL_SIZE - 1);
          if (store.getState().asteroidFreeList.length !== 1) {
            throw new Error("slow-path bench needs exactly one free slot");
          }
        },
        afterEach: () => assertActive(POOL_SIZE),
      },
      () => {
        store.getState().activateAsteroids(fourSpawns);
      },
    ).run(RUN_OPTIONS);
  });
});
