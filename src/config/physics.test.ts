import { describe, expect, it } from "vite-plus/test";
import RAPIER from "@dimforge/rapier3d-compat";
import { ASTEROID_COLLISION_GROUPS, BASE_COLLISION_GROUPS } from "./physics";

/** Rapier's own rule: both membership bits must be in the other's filter. */
const collides = (a: number, b: number) =>
  ((a >> 16) & b & 0xffff) !== 0 && ((b >> 16) & a & 0xffff) !== 0;

await RAPIER.init();

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  return world;
}

function addBall(
  world: RAPIER.World,
  radius: number,
  at: [number, number, number],
  groups: number,
  fixed = false,
) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc[fixed ? "fixed" : "dynamic"]().setTranslation(...at),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(radius).setCollisionGroups(groups), body);
  return body;
}

const stepFor = (world: RAPIER.World, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) world.step();
};

describe("collision groups", () => {
  it("lets asteroids hit the base", () => {
    expect(collides(ASTEROID_COLLISION_GROUPS, BASE_COLLISION_GROUPS)).toBe(true);
  });

  it("lets asteroids pass through each other", () => {
    expect(collides(ASTEROID_COLLISION_GROUPS, ASTEROID_COLLISION_GROUPS)).toBe(false);
  });
});

describe("collision groups in the solver", () => {
  it("stops an asteroid at the base instead of letting it through", () => {
    const world = makeWorld();
    addBall(world, 12, [0, 0, 0], BASE_COLLISION_GROUPS, true);
    const asteroid = addBall(world, 1, [0, 0, 20], ASTEROID_COLLISION_GROUPS);
    asteroid.setLinvel({ x: 0, y: 0, z: -10 }, true);

    stepFor(world, 4);

    // Unobstructed it would sail past z = 0; contact holds it at 12 + 1.
    expect(asteroid.translation().z).toBeGreaterThan(12);
  });

  it("lets two asteroids cross rather than push each other", () => {
    const world = makeWorld();
    const a = addBall(world, 1, [-6, 0, 0], ASTEROID_COLLISION_GROUPS);
    const b = addBall(world, 1, [6, 0, 0], ASTEROID_COLLISION_GROUPS);
    a.setLinvel({ x: 5, y: 0, z: 0 }, true);
    b.setLinvel({ x: -5, y: 0, z: 0 }, true);

    stepFor(world, 2);

    expect(a.translation().x).toBeGreaterThan(b.translation().x);
  });
});
