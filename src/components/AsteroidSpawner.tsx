import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AsteroidType, countAsteroidsInRange } from "../ecs/world";
import { enqueueAsteroidSpawn } from "../ecs/asteroidSpawnQueue";
import useGameStore from "../store/gameStore";
import { usePoolStore } from "../store/poolStore";
import { nextId } from "../utils/id";
import { getRandomSpherePosition } from "../utils/math";
import { INITIAL_SPAWN_INTERVAL, nextSpawnInterval, shouldEnqueueAmbient } from "./spawner/helpers";

function pickAsteroidType(): AsteroidType {
  const roll = Math.random();
  if (roll < 0.5) return "swarmer";
  if (roll < 0.75) return "tank";
  return "splitter";
}

const SPAWN_RADIUS = 40;
const PROXIMITY_RADIUS = 25;

export default function AsteroidSpawner() {
  const originRef = useRef(new THREE.Vector3(0, 0, 0));
  const spawnTimer = useRef(0);
  const currentInterval = useRef(INITIAL_SPAWN_INTERVAL);
  const sessionId = useGameStore((state) => state.sessionId);

  useEffect(() => {
    spawnTimer.current = 0;
    currentInterval.current = INITIAL_SPAWN_INTERVAL;
  }, [sessionId]);

  useFrame((_, delta) => {
    if (useGameStore.getState().gameState !== "playing") return;
    spawnTimer.current += delta;

    if (spawnTimer.current >= currentInterval.current) {
      spawnTimer.current = 0;

      const closeCount = countAsteroidsInRange(originRef.current, PROXIMITY_RADIUS);
      currentInterval.current = nextSpawnInterval(currentInterval.current, closeCount);

      // Reserve pool headroom for splitter fragments: stop ambient spawning
      // once the ambient cap is reached. The interval still adapts above so
      // backpressure resumes immediately when the field clears.
      if (!shouldEnqueueAmbient(usePoolStore.getState().activeAsteroidCount)) {
        return;
      }

      enqueueAsteroidSpawn({
        id: nextId(),
        pos: getRandomSpherePosition(SPAWN_RADIUS),
        type: pickAsteroidType(),
      });
    }
  });

  return null;
}
