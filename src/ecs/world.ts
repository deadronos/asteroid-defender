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
  isBaseHit?: boolean;
};

// Define the central ECS world
export const ECS = new World<GameEntity>();
export const asteroidQuery = ECS.with("isAsteroid");
export const CELL_SIZE = 25;

// Threshold below which queries use linear scan instead of spatial index.
// Must match the threshold used in visitAsteroidsInRange.
export const SPATIAL_INDEX_THRESHOLD = 80;

let anyAsteroidMoved = false;
const scratchCellBounds: CellBounds = {
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0,
  minZ: 0,
  maxZ: 0,
};
const rebuildBucketMap = new Map<number, GameEntity[]>();

export function markAsteroidDirty() {
  anyAsteroidMoved = true;
}

/**
 * Packs 3 integer coordinates into a single 32-bit signed integer.
 * Offsets each coordinate to fit in 10 bits (values 0-1023), allowing coordinates in [-512, 511].
 * This covers coordinates in space from -12800 to 12775 (since CELL_SIZE is 25).
 */
export function getCellKey(x: number, y: number, z: number): number {
  const ox = (x + 512) & 1023;
  const oy = (y + 512) & 1023;
  const oz = (z + 512) & 1023;
  return ox | (oy << 10) | (oz << 20);
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

function getRangeCellBounds(position: THREE.Vector3, range: number, out: CellBounds): CellBounds {
  out.minX = Math.floor((position.x - range) / CELL_SIZE);
  out.maxX = Math.floor((position.x + range) / CELL_SIZE);
  out.minY = Math.floor((position.y - range) / CELL_SIZE);
  out.maxY = Math.floor((position.y + range) / CELL_SIZE);
  out.minZ = Math.floor((position.z - range) / CELL_SIZE);
  out.maxZ = Math.floor((position.z + range) / CELL_SIZE);
  return out;
}

function visitAsteroidsInCell(
  cell: GameEntity[],
  position: THREE.Vector3,
  rangeSq: number,
  visitor: (entity: GameEntity, distSq: number) => void,
) {
  const px = position.x;
  const py = position.y;
  const pz = position.z;

  for (let i = 0; i < cell.length; i++) {
    const entity = cell[i];
    const entityPosition = entity.position;
    if (!entityPosition) {
      continue;
    }

    const dx = px - entityPosition.x;
    const dy = py - entityPosition.y;
    const dz = pz - entityPosition.z;
    const distSq = dx * dx + dy * dy + dz * dz;

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
  const entities = asteroidQuery.entities;
  const px = position.x;
  const py = position.y;
  const pz = position.z;

  // Performance optimization: For small numbers of active entities,
  // a linear scan is much faster than checking 125 spatial index cells.
  if (entities.length < SPATIAL_INDEX_THRESHOLD) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityPosition = entity.position;
      if (entityPosition) {
        const dx = px - entityPosition.x;
        const dy = py - entityPosition.y;
        const dz = pz - entityPosition.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= rangeSq) {
          visitor(entity, distSq);
        }
      }
    }
    return;
  }

  const { minX, maxX, minY, maxY, minZ, maxZ } = getRangeCellBounds(
    position,
    range,
    scratchCellBounds,
  );

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
  if (!anyAsteroidMoved) return;
  anyAsteroidMoved = false;

  const entities = asteroidQuery.entities;
  rebuildBucketMap.clear();

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const entityPosition = entity.position;
    if (!entityPosition) continue;

    const x = Math.floor(entityPosition.x / CELL_SIZE);
    const y = Math.floor(entityPosition.y / CELL_SIZE);
    const z = Math.floor(entityPosition.z / CELL_SIZE);
    const key = getCellKey(x, y, z);

    let cell = rebuildBucketMap.get(key);
    if (!cell) {
      cell = asteroidCells.get(key) ?? [];
      cell.length = 0;
      rebuildBucketMap.set(key, cell);
    }

    cell.push(entity);
  }

  asteroidCells.clear();
  for (const [key, cell] of rebuildBucketMap) {
    asteroidCells.set(key, cell);
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
