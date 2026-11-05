import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act, useEffect } from "react";
import { Physics, useRapier, type RapierContext } from "@react-three/rapier";
import AsteroidLayer from "./AsteroidLayer";
import Platform from "../Platform";
import Turret from "../Turret";
import { markBaseHit } from "../../game/combat";
import { ECS, asteroidQuery } from "../../ecs/world";
import { usePoolStore } from "../../store/poolStore";
import useGameStore from "../../store/gameStore";

// Lets act() flush updates and warn about updates outside it; vite-plus does not set it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const POOL_SIZE = 60;
const mounted: Renderer[] = [];

/**
 * Reads the live Rapier world the mounted scene is stepping, so a test can
 * assert what physics actually sees rather than what the pool store believes.
 */
let world: RapierContext["world"] | null = null;
function WorldProbe() {
  const { world: rapierWorld } = useRapier();
  useEffect(() => {
    world = rapierWorld;
  }, [rapierWorld]);
  return null;
}

interface BodySnapshot {
  dynamic: boolean;
  enabled: boolean;
  sleeping: boolean;
  translation: [number, number, number];
  velocity: [number, number, number];
}

const worldBodies = (): BodySnapshot[] => {
  const bodies: BodySnapshot[] = [];
  world!.forEachRigidBody((body) => {
    const t = body.translation();
    const v = body.linvel();
    bodies.push({
      dynamic: body.isDynamic(),
      enabled: body.isEnabled(),
      sleeping: body.isSleeping(),
      translation: [t.x, t.y, t.z],
      velocity: [v.x, v.y, v.z],
    });
  });
  return bodies;
};

/** Only asteroids are dynamic; the fixed platform in the scene counts too. */
const enabledBodies = () => worldBodies().filter((body) => body.dynamic && body.enabled);
const isParkedAtOrigin = ([x, y, z]: [number, number, number]) => x === 0 && y === -1000 && z === 0;
const distanceToOrigin = ([x, y, z]: [number, number, number]) => Math.hypot(x, y, z);

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
  for (let attempt = 0; attempt < 200 && (world?.bodies.len() ?? 0) !== POOL_SIZE; attempt++) {
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

async function mountScene(element: React.ReactElement) {
  const renderer = await ReactThreeTestRenderer.create(element);
  mounted.push(renderer);
  await settle(renderer);
  return renderer;
}

async function mountLayer(onShieldImpact?: (pos: [number, number, number]) => void) {
  return mountScene(
    <Physics>
      <WorldProbe />
      <AsteroidLayer effectsQuality="off" onShieldImpact={onShieldImpact} />
    </Physics>,
  );
}

async function mountPlatformLayer(onShieldImpact?: (pos: [number, number, number]) => void) {
  return mountScene(
    <Physics>
      <WorldProbe />
      <Platform shieldImpacts={[]} />
      <AsteroidLayer effectsQuality="off" onShieldImpact={onShieldImpact} />
    </Physics>,
  );
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
  world = null;
  usePoolStore.getState().resetPools(POOL_SIZE);
  useGameStore.setState({ gameState: "playing", asteroidsDestroyed: 0, activeAsteroids: 0 });
});

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
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

describe("parked bodies leave the physics simulation (#170)", () => {
  it("keeps every pooled body disabled and at the parking point at rest", async () => {
    const renderer = await mountLayer();

    expect(worldBodies()).toHaveLength(POOL_SIZE);
    expect(enabledBodies()).toHaveLength(0);
    expect(worldBodies().every((body) => isParkedAtOrigin(body.translation))).toBe(true);

    // The old pile of overlapping dynamic bodies drifted off y=-1000 as soon as
    // Rapier separated them. A disabled body cannot move.
    await advance(renderer, 120);
    expect(enabledBodies()).toHaveLength(0);
    expect(worldBodies().every((body) => isParkedAtOrigin(body.translation))).toBe(true);
  }, 20000);

  it("enables the body at its spawn point, moving toward the origin, before the first step", async () => {
    const renderer = await mountLayer();

    activate([20, 0, 0]);

    // The lifecycle effect must finish before the next physics step: a body
    // enabled at the old parking point would collide there first.
    expect(enabledBodies()).toHaveLength(1);
    const spawned = enabledBodies()[0];
    expect(spawned.translation[0]).toBeCloseTo(20, 5);
    expect(spawned.translation[1]).toBeCloseTo(0, 5);
    expect(spawned.translation[2]).toBeCloseTo(0, 5);
    expect(spawned.velocity[0]).toBeCloseTo(-13, 5);

    await advance(renderer, 1);
    const moved = enabledBodies()[0];
    expect(moved.translation[0]).toBeLessThan(20);
    expect(moved.translation[0]).toBeGreaterThan(19.5);
    expect(distanceToOrigin(moved.translation)).toBeLessThan(20);

    await advance(renderer, 60);
    const later = enabledBodies()[0];
    expect(distanceToOrigin(later.translation)).toBeLessThan(15);
    expect(enabledBodies()).toHaveLength(1);
  }, 20000);

  it("reuses the same body many times without leaving a spare enabled", async () => {
    const renderer = await mountLayer();

    for (let cycle = 0; cycle < 8; cycle++) {
      const spawn: [number, number, number] = [20 + cycle, 0, 0];
      activate(spawn);
      await advance(renderer, 1);

      const live = enabledBodies();
      expect(live).toHaveLength(1);
      expect(live[0].translation[0]).toBeGreaterThan(spawn[0] - 1);
      expect(live[0].translation[0]).toBeLessThan(spawn[0]);

      asteroidQuery.entities[0].health = 0;
      await advance(renderer, 1);

      expect(liveIds()).toEqual([]);
      expect(enabledBodies()).toHaveLength(0);
      expect(worldBodies().every((body) => isParkedAtOrigin(body.translation))).toBe(true);
    }
  }, 20000);

  it("parks every body again after the scene remounts for a new session", async () => {
    const first = await mountLayer();
    activate([20, 0, 0]);
    await advance(first, 2);
    expect(enabledBodies()).toHaveLength(1);

    await first.unmount();
    mounted.splice(mounted.indexOf(first), 1);
    act(() => usePoolStore.getState().resetPools(POOL_SIZE));

    const second = await mountLayer();
    expect(worldBodies()).toHaveLength(POOL_SIZE);
    expect(enabledBodies()).toHaveLength(0);
    expect(worldBodies().every((body) => isParkedAtOrigin(body.translation))).toBe(true);

    activate([30, 0, 0]);
    await advance(second, 1);
    expect(enabledBodies()).toHaveLength(1);
    expect(enabledBodies()[0].translation[0]).toBeGreaterThan(29);
    expect(enabledBodies()[0].translation[0]).toBeLessThan(30);
  }, 20000);
});

describe("live collision with the real Platform (#170)", () => {
  it("takes exactly one base hit from an asteroid that flies in", async () => {
    const impacts: Array<[number, number, number]> = [];
    const renderer = await mountPlatformLayer((pos) => impacts.push(pos));
    useGameStore.setState({ health: 100, maxHealth: 100 });

    // A swarmer spawned 30 units out is outside the platform's 12-unit cylinder
    // and flies straight into it.
    activate([30, 0, 0]);
    expect(enabledBodies()).toHaveLength(1);

    let frames = 0;
    while (useGameStore.getState().health === 100 && frames < 240) {
      await advance(renderer, 1);
      frames++;
    }

    expect(useGameStore.getState().health, "the asteroid never reached the platform").toBe(95);
    expect(frames).toBeLessThan(240);
    expect(useGameStore.getState().asteroidsDestroyed).toBe(0);

    // The collider stops existing for physics before the slot can be reused.
    await advance(renderer, 2);
    expect(impacts).toHaveLength(1);
    expect(enabledBodies()).toHaveLength(0);

    await advance(renderer, 10);
    expect(useGameStore.getState().health).toBe(95);
    expect(impacts).toHaveLength(1);

    // Reusing a parked body must not replay a collision from its old spot.
    activate([30, 0, 0]);
    expect(enabledBodies()).toHaveLength(1);
    let second = 0;
    while (useGameStore.getState().health === 95 && second < 240) {
      await advance(renderer, 1);
      second++;
    }
    expect(useGameStore.getState().health, "the reused body never reached the platform").toBe(90);
    await advance(renderer, 2);
    expect(impacts).toHaveLength(2);
    expect(enabledBodies()).toHaveLength(0);
  }, 20000);
});

describe("combat rules at the scene seam", () => {
  it("a turret kills an asteroid and the kill counts once", async () => {
    const renderer = await mountScene(
      <Physics>
        <WorldProbe />
        <Turret id="test-turret" position={[0, -1, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <AsteroidLayer effectsQuality="off" />
      </Physics>,
    );

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
