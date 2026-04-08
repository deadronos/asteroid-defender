import { World } from "miniplex";
import { createReactAPI } from "miniplex-react";
import * as THREE from "three";

export type AsteroidType = "swarmer" | "tank" | "splitter";

export type GameEntity = {
  id: string;
  isAsteroid?: boolean;
  position?: THREE.Vector3;
  health?: number;
  targetedBy?: string | null;
  asteroidType?: AsteroidType;
};

// Define the central ECS world
export const ECS = new World<GameEntity>();
export const asteroidQuery = ECS.with("isAsteroid");

const CELL_SIZE = 25;

/**
 * Packs 3 integer coordinates into a single numeric key for the spatial index.
 * Uses offset arithmetic to ensure a unique positive integer for common coordinate ranges.
 */
export function getCellKey(x: number, y: number, z: number): number {
  return x + 32768 + (y + 32768) * 65536 + (z + 32768) * 4294967296;
}

export const asteroidCells = new Map<number, GameEntity[]>();

interface CellBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function getRangeCellBounds(position: THREE.Vector3, range: number): CellBounds {
  return {
    minX: Math.floor((position.x - range) / CELL_SIZE),
    maxX: Math.floor((position.x + range) / CELL_SIZE),
    minY: Math.floor((position.y - range) / CELL_SIZE),
    maxY: Math.floor((position.y + range) / CELL_SIZE),
    minZ: Math.floor((position.z - range) / CELL_SIZE),
    maxZ: Math.floor((position.z + range) / CELL_SIZE),
  };
}

function visitAsteroidsInCell(
  cell: GameEntity[],
  position: THREE.Vector3,
  rangeSq: number,
  visitor: (entity: GameEntity, distSq: number) => void,
) {
  for (let i = 0; i < cell.length; i++) {
    const entity = cell[i];
    if (!entity.position) {
      continue;
    }

    const distSq = position.distanceToSquared(entity.position);
    if (distSq <= rangeSq) {
      visitor(entity, distSq);
    }
  }
}

function visitAsteroidsInRange(
  position: THREE.Vector3,
  range: number,
  visitor: (entity: GameEntity, distSq: number) => void,
) {
  const rangeSq = range * range;
  const { minX, maxX, minY, maxY, minZ, maxZ } = getRangeCellBounds(position, range);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const key = getCellKey(x, y, z);
        const cell = asteroidCells.get(key);
        if (cell && cell.length > 0) {
          visitAsteroidsInCell(cell, position, rangeSq, visitor);
        }
      }
    }
  }
}

export function updateSpatialIndex() {
  for (const arr of asteroidCells.values()) {
    arr.length = 0;
  }
  for (const entity of asteroidQuery.entities) {
    if (!entity.position) continue;
    const x = Math.floor(entity.position.x / CELL_SIZE);
    const y = Math.floor(entity.position.y / CELL_SIZE);
    const z = Math.floor(entity.position.z / CELL_SIZE);
    const key = getCellKey(x, y, z);
    let arr = asteroidCells.get(key);
    if (!arr) {
      arr = [];
      asteroidCells.set(key, arr);
    }
    arr.push(entity);
  }
}

export function queryAsteroidsInRange(position: THREE.Vector3, range: number): GameEntity[] {
  const asteroids: GameEntity[] = [];

  visitAsteroidsInRange(position, range, (entity) => {
    asteroids.push(entity);
  });

  return asteroids;
}

export function countAsteroidsInRange(position: THREE.Vector3, range: number): number {
  let count = 0;

  visitAsteroidsInRange(position, range, () => {
    count++;
  });

  return count;
}

export function findNearestAsteroidInRange(
  position: THREE.Vector3,
  range: number,
  scoreFn?: (entity: GameEntity, distSq: number) => number,
): GameEntity | null {
  let nearestScore = Infinity;
  let nearest: GameEntity | null = null;

  visitAsteroidsInRange(position, range, (entity, distSq) => {
    const score = scoreFn ? scoreFn(entity, distSq) : distSq;
    if (score < nearestScore) {
      nearestScore = score;
      nearest = entity;
    }
  });

  return nearest;
}

// Create the React bindings
export const { Entity, Component } = createReactAPI(ECS);
