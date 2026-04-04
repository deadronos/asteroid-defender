import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AsteroidType, countAsteroidsInRange } from "../ecs/world";
import { enqueueAsteroidSpawn } from "../ecs/asteroidSpawnQueue";
import useGameStore from "../store/gameStore";
import { nextId } from "../utils/id";
import { clamp, getRandomSpherePosition } from "../utils/math";

function pickAsteroidType(): AsteroidType {
  const roll = Math.random();
  if (roll < 0.5) return "swarmer";
  if (roll < 0.75) return "tank";
  return "splitter";
}

const INITIAL_SPAWN_INTERVAL = 2.0;
const MIN_SPAWN_INTERVAL = 0.5;
const MAX_SPAWN_INTERVAL = 5.0;
const SPAWN_ADJUSTMENT = 0.2;
const SPAWN_RADIUS = 40;
const PROXIMITY_THRESHOLD = 3;

export default function AsteroidSpawner() {
  const origin = new THREE.Vector3(0, 0, 0);
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

      const closeCount = countAsteroidsInRange(origin, 25);

      // Adjust spawn rate based on proximity count
      if (closeCount < PROXIMITY_THRESHOLD) {
        currentInterval.current = clamp(
          currentInterval.current - SPAWN_ADJUSTMENT,
          MIN_SPAWN_INTERVAL,
          MAX_SPAWN_INTERVAL,
        );
      } else {
        currentInterval.current = clamp(
          currentInterval.current + SPAWN_ADJUSTMENT,
          MIN_SPAWN_INTERVAL,
          MAX_SPAWN_INTERVAL,
        );
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
