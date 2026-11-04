import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { act } from "react";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import Asteroid from "../Asteroid";
import { ECS, asteroidQuery } from "../../ecs/world";
import useGameStore from "../../store/gameStore";

// Lets act() flush updates and warn about updates outside it; vite-plus does not set it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const mounted: Renderer[] = [];
const r6 = (value: number) => Number(value.toFixed(6));

async function settle(renderer: Renderer, asteroidCount: number) {
  // Rapier's WASM init is async: wait until every asteroid has its rigid body.
  for (
    let attempt = 0;
    attempt < 200 &&
    renderer.scene.findAll((node) => node.type === "Object3D" && node.props.colliders === false)
      .length !== asteroidCount;
    attempt++
  ) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

async function advance(renderer: Renderer) {
  await act(async () => {
    await renderer.advanceFrames(1, 1 / 60);
  });
}

/**
 * What a player can see after a frame: ECS positions, each asteroid material's
 * emissive state and the tank danger-ring opacity. Values are rounded because
 * Rapier floats are the only unstable part; 6 decimals still catches any change
 * in the frame maths.
 */
function snapshot(renderer: Renderer) {
  const positions = asteroidQuery.entities
    .filter((entity) => entity.isAsteroid)
    .map((entity) => [entity.id, entity.position!.toArray().map(r6)] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1));

  const materials: Record<string, { emissive: string; intensity: number }> = {};
  let tankRingOpacity: number | null = null;
  for (const node of renderer.scene.findAll((n) => n.instance instanceof THREE.Mesh)) {
    const mesh = node.instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (mesh.geometry.type === "RingGeometry" && material.color.getHexString() === "ff3333") {
      tankRingOpacity = r6(material.opacity);
    } else if (mesh.geometry.type.endsWith("hedronGeometry")) {
      materials[material.color.getHexString()] = {
        emissive: material.emissive.getHexString(),
        intensity: r6(material.emissiveIntensity),
      };
    }
  }
  return { positions, materials, tankRingOpacity };
}

const destroyCalls: unknown[][] = [];
function recordDestroy(...args: unknown[]) {
  destroyCalls.push(args.map((arg) => (Array.isArray(arg) ? arg.map(r6) : arg)));
}

beforeEach(() => {
  ECS.clear();
  destroyCalls.length = 0;
  // effectsQuality="reduced" keeps glow and the tank ring, but turns off their
  // elapsed-time animation. The test renderer does not advance the clock, so
  // animated values would be frozen at t=0 and pin almost nothing.
  useGameStore.setState({ gameState: "playing", reducedMotion: false });
});

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
});

describe("Asteroid frame behaviour", () => {
  it("pins per-frame position sync, proximity glow and the tank ring", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <Asteroid
          id="swarmer"
          startPos={[10, 0, 0]}
          type="swarmer"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
        <Asteroid
          id="tank"
          startPos={[0, 10, 0]}
          type="tank"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
        <Asteroid
          id="splitter"
          startPos={[-10, 0, 0]}
          type="splitter"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
      </Physics>,
    );
    mounted.push(renderer);
    await settle(renderer, 3);

    // Nothing has synced yet: the entity still sits at its spawn point while
    // the first active frame is skipped.
    expect(snapshot(renderer)).toEqual({
      positions: [
        ["splitter", [-10, 0, 0]],
        ["swarmer", [10, 0, 0]],
        ["tank", [0, 10, 0]],
      ],
      materials: {
        "555555": { emissive: "000000", intensity: 1 },
        a855f7: { emissive: "000000", intensity: 1 },
        d4a843: { emissive: "000000", intensity: 1 },
      },
      tankRingOpacity: 0.4,
    });

    await advance(renderer);

    const frames = [];
    for (let frame = 0; frame < 4; frame++) {
      await advance(renderer);
      frames.push(snapshot(renderer));
    }

    expect(frames).toEqual([
      {
        positions: [
          ["splitter", [-9.76667, 0, 0]],
          ["swarmer", [9.566666, 0, 0]],
          ["tank", [0, 9.900002, 0]],
        ],
        materials: {
          "555555": { emissive: "555555", intensity: 0.286857 },
          a855f7: { emissive: "a855f7", intensity: 0.288381 },
          d4a843: { emissive: "d4a843", intensity: 0.290667 },
        },
        tankRingOpacity: 0.515143,
      },
      {
        positions: [
          ["splitter", [-9.650005, 0, 0]],
          ["swarmer", [9.349998, 0, 0]],
          ["tank", [0, 9.850002, 0]],
        ],
        materials: {
          "555555": { emissive: "555555", intensity: 0.286857 },
          a855f7: { emissive: "a855f7", intensity: 0.288381 },
          d4a843: { emissive: "d4a843", intensity: 0.290667 },
        },
        tankRingOpacity: 0.515143,
      },
      {
        positions: [
          ["splitter", [-9.53334, 0, 0]],
          ["swarmer", [9.133331, 0, 0]],
          ["tank", [0, 9.800003, 0]],
        ],
        materials: {
          "555555": { emissive: "555555", intensity: 0.286857 },
          a855f7: { emissive: "a855f7", intensity: 0.288381 },
          d4a843: { emissive: "d4a843", intensity: 0.290667 },
        },
        tankRingOpacity: 0.515143,
      },
      {
        positions: [
          ["splitter", [-9.416676, 0, 0]],
          ["swarmer", [8.916664, 0, 0]],
          ["tank", [0, 9.750004, 0]],
        ],
        materials: {
          "555555": { emissive: "555555", intensity: 0.286857 },
          a855f7: { emissive: "a855f7", intensity: 0.288381 },
          d4a843: { emissive: "d4a843", intensity: 0.290667 },
        },
        tankRingOpacity: 0.515143,
      },
    ]);
  }, 20000);

  it("holds the hit flash for 0.1s and then returns to proximity glow", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <Asteroid
          id="swarmer"
          startPos={[10, 0, 0]}
          type="swarmer"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
      </Physics>,
    );
    mounted.push(renderer);
    await settle(renderer, 1);
    await advance(renderer);

    asteroidQuery.entities[0].health = 39;
    const flash = [];
    for (let frame = 0; frame < 7; frame++) {
      await advance(renderer);
      flash.push(snapshot(renderer).materials["d4a843"]);
    }

    expect(flash).toEqual([
      { emissive: "ffffff", intensity: 2 },
      { emissive: "ffffff", intensity: 2 },
      { emissive: "ffffff", intensity: 2 },
      { emissive: "ffffff", intensity: 2 },
      { emissive: "ffffff", intensity: 2 },
      { emissive: "ffffff", intensity: 2 },
      { emissive: "d4a843", intensity: 0.305524 },
    ]);
  }, 20000);

  it("leaves a far asteroid unlit and calls onDestroy with the last position", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <Asteroid
          id="far"
          startPos={[40, 0, 0]}
          type="swarmer"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
      </Physics>,
    );
    mounted.push(renderer);
    await settle(renderer, 1);
    await advance(renderer);

    for (let frame = 0; frame < 3; frame++) await advance(renderer);
    expect(snapshot(renderer).materials["d4a843"]).toEqual({ emissive: "000000", intensity: 0 });

    const entity = asteroidQuery.entities[0];
    entity.health = 0;
    await advance(renderer);

    expect(destroyCalls).toEqual([["far", [38.916702, 0, 0], false, "swarmer", 5]]);
    // A turret kill is not a base hit; the kill branch does not touch position sync.
    expect(asteroidQuery.entities[0].position!.toArray().map(r6)).toEqual([39.133362, 0, 0]);
  }, 20000);

  it("reports a base hit through onDestroy without counting it as a turret kill", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Physics>
        <Asteroid
          id="tank"
          startPos={[0, 10, 0]}
          type="tank"
          active
          effectsQuality="reduced"
          loadTier={0}
          onDestroy={recordDestroy as never}
        />
      </Physics>,
    );
    mounted.push(renderer);
    await settle(renderer, 1);
    await advance(renderer);
    await advance(renderer);

    const entity = asteroidQuery.entities[0];
    entity.isBaseHit = true;
    entity.health = 0;
    await advance(renderer);

    expect(destroyCalls).toEqual([["tank", [0, 9.850002, 0], true, "tank", 30]]);
  }, 20000);
});
