import { bench, describe } from "vite-plus/test";
import {
  activateQueuedAsteroidsWithDelta,
  createAsteroidPool,
  deactivateAsteroidWithDelta,
  spawnSplitterFragmentsWithDelta,
} from "./pools";

const spawns = Array.from({ length: 10 }, (_, index) => ({
  pos: [index, 0, 0] as [number, number, number],
  type: index % 3 === 0 ? ("tank" as const) : ("swarmer" as const),
}));

describe("pool lifecycle hot paths", () => {
  bench("activates queued asteroids in a 60-slot pool", () => {
    const pool = createAsteroidPool(60);
    activateQueuedAsteroidsWithDelta(pool, spawns);
  });

  bench("deactivates an active asteroid in a 60-slot pool", () => {
    const pool = createAsteroidPool(60).map((asteroid, index) => ({
      ...asteroid,
      active: index < 30,
    }));
    deactivateAsteroidWithDelta(pool, pool[20].id);
  });

  bench("spawns splitter fragments into a partially occupied pool", () => {
    const pool = createAsteroidPool(60).map((asteroid, index) => ({
      ...asteroid,
      active: index < 45,
    }));
    spawnSplitterFragmentsWithDelta(pool, [0, 0, 0]);
  });
});
