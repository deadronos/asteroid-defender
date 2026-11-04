import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act } from "react";
import { useAsteroidManager } from "./useAsteroidManager";
import { clearAsteroidSpawns, enqueueAsteroidSpawn } from "../../ecs/asteroidSpawnQueue";
import {
  getSpawnStatsSnapshot,
  recordSpawnActivations,
  recordSpawnOverflow,
  resetSpawnStats,
} from "../../ecs/spawnStats";
import useGameStore from "../../store/gameStore";

// Lets act() flush updates and warn about updates outside it; vite-plus does not set it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const POOL_SIZE = 4;
const mounted: Renderer[] = [];

function Harness() {
  useAsteroidManager({ poolSize: POOL_SIZE });
  return null;
}

beforeEach(() => {
  resetSpawnStats();
  clearAsteroidSpawns();
  useGameStore.setState({ gameState: "menu", sessionId: 0 });
});

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
  resetSpawnStats();
  clearAsteroidSpawns();
});

describe("useAsteroidManager session reset", () => {
  it("clears the spawn stats when the session changes", async () => {
    const renderer = await ReactThreeTestRenderer.create(<Harness />);
    mounted.push(renderer);

    act(() => {
      enqueueAsteroidSpawn({ id: "queued", pos: [0, 0, 0], type: "swarmer" });
      recordSpawnActivations(3, 1);
      recordSpawnOverflow(2);
    });
    expect(getSpawnStatsSnapshot().activations).toBe(3);

    act(() => {
      useGameStore.setState({ sessionId: 1 });
    });
    await act(async () => {
      await renderer.advanceFrames(1, 1 / 60);
    });

    expect(getSpawnStatsSnapshot()).toEqual({
      ambientEnqueued: 0,
      fragmentsEnqueued: 0,
      activations: 0,
      starvedDrops: 0,
      overflowDrops: 0,
      queueDepth: 0,
    });
  }, 20000);
});
