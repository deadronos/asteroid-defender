import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act } from "react";
import * as THREE from "three";
import { Physics } from "@react-three/rapier";
import AsteroidLayer from "./AsteroidLayer";
import Turret from "../Turret";
import { markBaseHit } from "../../game/combat";
import { ECS, asteroidQuery } from "../../ecs/world";
import { usePoolStore } from "../../store/poolStore";
import useGameStore from "../../store/gameStore";
import * as visualQuality from "../../utils/asteroidVisualQuality";

// Lets act() flush updates and warn about updates outside it; vite-plus does not set it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const POOL_SIZE = 60;
const mounted: Renderer[] = [];

/** One `<object3D>` per asteroid is the host Rapier mounts for its rigid body. */
const poolSlots = (renderer: Renderer) =>
  renderer.scene.findAll((node) => node.type === "Object3D" && node.props.colliders === false);

/** `<group visible={active}>` is how a parked asteroid is hidden (it stays mounted). */
const visibleAsteroids = (renderer: Renderer) =>
  renderer.scene.findAll((node) => node.type === "Group" && node.props.visible === true);

const liveIds = () => asteroidQuery.entities.map((entity) => entity.id).sort();
const activeSlotIds = () =>
  usePoolStore
    .getState()
    .asteroids.filter((slot) => slot.active)
    .map((slot) => slot.id);

async function settle(renderer: Renderer) {
  // Rapier's WASM init is async: wait until every asteroid has its rigid body.
  for (let attempt = 0; attempt < 200 && poolSlots(renderer).length !== POOL_SIZE; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

async function advance(renderer: Renderer, frames: number) {
  await act(async () => {
    await renderer.advanceFrames(frames, 1 / 60);
  });
}

async function mountLayer(onShieldImpact?: (pos: [number, number, number]) => void) {
  const renderer = await ReactThreeTestRenderer.create(
    <Physics>
      <AsteroidLayer effectsQuality="off" onShieldImpact={onShieldImpact} />
    </Physics>,
  );
  await settle(renderer);
  mounted.push(renderer);
  return renderer;
}

const activate = (...spawns: Array<[number, number, number]>) => {
  act(() => {
    usePoolStore
      .getState()
      .activateAsteroids(spawns.map((pos) => ({ pos, type: "swarmer" as const })));
  });
};

beforeEach(() => {
  // clear() also empties the query buckets, so no manual removal is needed.
  ECS.clear();
  usePoolStore.getState().resetPools(POOL_SIZE);
  useGameStore.setState({ gameState: "playing", asteroidsDestroyed: 0, activeAsteroids: 0 });
});

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
  vi.restoreAllMocks();
});

describe("AsteroidLayer pool smoke test", () => {
  it("mounts the full pool with no live asteroids", async () => {
    const renderer = await mountLayer();

    expect(poolSlots(renderer)).toHaveLength(POOL_SIZE);
    expect(visibleAsteroids(renderer)).toHaveLength(0);
    expect(asteroidQuery.entities).toHaveLength(0);
    expect(usePoolStore.getState().asteroids).toHaveLength(POOL_SIZE);
  }, 20000);

  it("activation mounts exactly one live asteroid", async () => {
    const renderer = await mountLayer();

    activate([10, 0, 0]);
    await advance(renderer, 2);

    expect(liveIds()).toEqual(activeSlotIds());
    expect(liveIds()).toHaveLength(1);
    expect(visibleAsteroids(renderer)).toHaveLength(1);
    expect(usePoolStore.getState().activeAsteroidCount).toBe(1);
  }, 20000);

  it("destroy removes the entity, frees the slot and fires onDestroy once", async () => {
    const renderer = await mountLayer();

    activate([10, 0, 0]);
    await advance(renderer, 2);
    const entity = asteroidQuery.entities[0];
    const id = entity.id;
    expect(entity.health).toBeGreaterThan(0);

    // Kill it the way a turret does: health drops to zero and the next frame
    // runs the destroy path.
    entity.health = 0;
    await advance(renderer, 1);

    const state = usePoolStore.getState();
    expect(liveIds()).toEqual([]);
    expect(visibleAsteroids(renderer)).toHaveLength(0);
    expect(state.activeAsteroidCount).toBe(0);
    expect(state.asteroidIdToIndex.has(id)).toBe(false);
    expect(state.asteroidFreeList).toHaveLength(POOL_SIZE);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);

    // The dead slot must stay dead: onDestroy may not fire again.
    await advance(renderer, 5);
    expect(liveIds()).toEqual([]);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
  }, 20000);

  it("reusing the freed slot produces a live asteroid again", async () => {
    const renderer = await mountLayer();

    activate([10, 0, 0]);
    await advance(renderer, 2);
    const id = asteroidQuery.entities[0].id;
    asteroidQuery.entities[0].health = 0;
    await advance(renderer, 1);
    expect(liveIds()).toEqual([]);

    activate([20, 0, 0]);
    await advance(renderer, 2);

    const state = usePoolStore.getState();
    const reused = state.asteroids.find((slot) => slot.id === id)!;
    expect(reused.active).toBe(true);
    expect(reused.pos).toEqual([20, 0, 0]);
    expect(liveIds()).toEqual([id]);
    expect(visibleAsteroids(renderer)).toHaveLength(1);
    expect(state.activeAsteroidCount).toBe(1);
  }, 20000);

  it("destroy plus spawn in one batch keeps one live asteroid (#156)", async () => {
    const renderer = await mountLayer();

    activate([10, 0, 0]);
    await advance(renderer, 2);
    const dyingId = activeSlotIds()[0];

    activate([12, 0, 0]);
    await advance(renderer, 2);
    const survivorId = activeSlotIds().find((id) => id !== dyingId)!;
    expect(liveIds()).toEqual([dyingId, survivorId].sort());

    const dyingEntity = asteroidQuery.entities.find((entity) => entity.id === dyingId)!;
    dyingEntity.health = 0;

    // A spawn and a death in the same React batch: the active count ends where
    // it started, so only slot identity can make the layer repaint. This is the
    // #156 jam: the dead slot kept `active` and onDestroy fired every frame.
    await act(async () => {
      usePoolStore.getState().activateAsteroids([{ pos: [30, 0, 0], type: "tank" }]);
      await renderer.advanceFrames(1, 1 / 60);
    });

    const spawnedId = activeSlotIds().find((id) => id !== survivorId)!;

    // Slot identity (copy-on-write) is covered by src/store/poolStore.test.ts;
    // this test only asserts what a player could see.
    expect(liveIds()).toEqual([spawnedId, survivorId].sort());
    expect(visibleAsteroids(renderer)).toHaveLength(2);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);

    await advance(renderer, 5);
    expect(liveIds()).toEqual([spawnedId, survivorId].sort());
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
  }, 20000);

  it("keeps a dead slot dead while frames keep running (#156)", async () => {
    const renderer = await mountLayer();

    activate([10, 0, 0]);
    await advance(renderer, 2);
    expect(liveIds()).toHaveLength(1);

    const dying = asteroidQuery.entities[0];
    dying.health = 0;
    // Spawn and the kill are handled in the same task, so the active count ends
    // where it started and only the slot replacement can make the layer repaint.
    // Updates run outside act(), the way the render loop runs them; the flag
    // only silences act()'s warning for those updates.
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      usePoolStore.getState().activateAsteroids([{ pos: [12, 0, 0], type: "swarmer" }]);
      for (let frame = 0; frame < 3; frame++) await renderer.advanceFrames(1, 1 / 60);
      await new Promise((resolve) => setTimeout(resolve, 20));
      for (let frame = 0; frame < 3; frame++) await renderer.advanceFrames(1, 1 / 60);
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }

    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
    expect(liveIds()).toEqual(activeSlotIds());
    expect(visibleAsteroids(renderer)).toHaveLength(1);
  }, 20000);

  it("a base hit fires one shield impact and a turret kill fires none (#186)", async () => {
    const impacts: Array<[number, number, number]> = [];
    const renderer = await mountLayer((pos) => impacts.push(pos));

    activate([10, 0, 0]);
    await advance(renderer, 2);
    asteroidQuery.entities[0].health = 0;
    await advance(renderer, 1);
    expect(impacts).toHaveLength(0);

    activate([20, 0, 0]);
    await advance(renderer, 2);
    const entity = asteroidQuery.entities[0];
    entity.isBaseHit = true;
    entity.health = 0;
    // One frame per act(): the game renders between frames, so a dead slot stops
    // at once. Several frames in one act() would all see it alive.
    for (let frame = 0; frame < 3; frame++) await advance(renderer, 1);

    expect(impacts).toHaveLength(1);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
  }, 20000);
});

describe("render fan-out (#173)", () => {
  // `Asteroid` calls getAsteroidVisualProfile once per render, and the profile is
  // the only thing the count used to decide. So this spy counts asteroid renders.
  const countRenders = async (quality: "full" | "off") => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <AsteroidLayer effectsQuality={quality} />
      </Physics>,
    );
    await settle(renderer);
    mounted.push(renderer);
    return { renderer, spy: vi.spyOn(visualQuality, "getAsteroidVisualProfile") };
  };

  /** One trail mesh per asteroid that renders the trail subtree. */
  const trailMeshes = (renderer: Renderer) =>
    renderer.scene.findAll((node) => {
      if (!(node.instance instanceof THREE.Mesh)) return false;
      const material = Array.isArray(node.instance.material)
        ? node.instance.material[0]
        : node.instance.material;
      return material?.type === "MeshLineMaterial";
    });

  const spawnAll = (count: number) => {
    for (let i = 0; i < count; i++) activate([i % 5, 0, i]);
  };

  it("a spawn or death re-renders one slot, not the whole pool", async () => {
    const { renderer, spy } = await countRenders("off");

    spawnAll(50);
    // 50 renders for 50 spawns, plus one full-pool repaint (59 more) for each of
    // the three threshold crossings at 20, 40 and 50. The pool has 60 slots.
    expect(spy.mock.calls.length).toBe(227);

    await advance(renderer, 2);
    expect(spy.mock.calls.length).toBe(227);

    for (let i = 0; i < 20; i++) {
      asteroidQuery.entities.find((entity) => entity.health! > 0)!.health = 0;
      await advance(renderer, 1);
    }

    // 20 renders for 20 deaths, plus repaints at the 49 and 39 crossings.
    expect(usePoolStore.getState().activeAsteroidCount).toBe(30);
    expect(spy.mock.calls.length).toBe(227 + 138);
  }, 20000);

  it("crossing a threshold repaints every slot with the new profile", async () => {
    const { renderer, spy } = await countRenders("full");

    spawnAll(19);
    expect(spy.mock.calls.length).toBe(19);
    expect(spy.mock.results.every(({ value }) => value.showTrail && value.showEdges)).toBe(true);

    expect(trailMeshes(renderer)).toHaveLength(19);

    spawnAll(1); // the 20th spawn crosses into tier 1
    expect(spy.mock.calls.length).toBe(19 + POOL_SIZE);
    const repainted = spy.mock.results.slice(19).map(({ value }) => value);
    expect(repainted.every((profile) => !profile.showTrail && profile.showEdges)).toBe(true);
    expect(trailMeshes(renderer)).toHaveLength(0);
  }, 20000);
});

describe("combat rules at the scene seam", () => {
  it("a turret kills an asteroid and the kill counts once", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <Turret id="test-turret" position={[0, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <AsteroidLayer effectsQuality="off" />
      </Physics>,
    );
    await settle(renderer);
    mounted.push(renderer);

    activate([10, 0, 0]);
    await advance(renderer, 2);
    expect(liveIds()).toHaveLength(1);

    // One frame per act(); a real turret deals damage every frame until the
    // asteroid's destroy frame runs.
    for (let frame = 0; frame < 120; frame++) {
      if (useGameStore.getState().asteroidsDestroyed > 0) break;
      await advance(renderer, 1);
    }

    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
    expect(liveIds()).toEqual([]);
    expect(visibleAsteroids(renderer)).toHaveLength(0);

    for (let frame = 0; frame < 5; frame++) await advance(renderer, 1);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(1);
  }, 20000);

  it("a base hit damages the base once, not once per frame, and is not a kill", async () => {
    const impacts: Array<[number, number, number]> = [];
    const renderer = await mountLayer((pos) => impacts.push(pos));
    useGameStore.setState({ health: 100, maxHealth: 100 });

    act(() => {
      usePoolStore.getState().activateAsteroids([{ pos: [10, 0, 0], type: "tank" }]);
    });
    await advance(renderer, 2);
    const entity = asteroidQuery.entities[0];
    expect(entity.health).toBe(350);

    // The collision callback may run again before the asteroid's destroy frame.
    expect(markBaseHit(asteroidQuery.entities, entity.id)).toBe(true);
    expect(markBaseHit(asteroidQuery.entities, entity.id)).toBe(false);

    for (let frame = 0; frame < 3; frame++) await advance(renderer, 1);

    expect(useGameStore.getState().health).toBe(70);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(0);
    expect(impacts).toHaveLength(1);

    for (let frame = 0; frame < 5; frame++) await advance(renderer, 1);
    expect(useGameStore.getState().health).toBe(70);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(0);
    expect(impacts).toHaveLength(1);
  }, 20000);
});
