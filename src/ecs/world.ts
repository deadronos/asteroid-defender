import { World } from 'miniplex';
import { createReactAPI } from 'miniplex-react';
import * as THREE from 'three';

export type AsteroidType = 'swarmer' | 'tank' | 'splitter';

export type GameEntity = {
    id: string;
    isAsteroid?: boolean;
    position?: THREE.Vector3;
    health?: number;
    targetedBy?: string | null;
    asteroidType?: AsteroidType;
}

// Define the central ECS world
export const ECS = new World<GameEntity>();
export const asteroidQuery = ECS.with('isAsteroid');
const SPATIAL_CELL_SIZE = 10;
const asteroidSpatialGrid = new Map<string, Set<GameEntity>>();
const asteroidCellByEntity = new WeakMap<GameEntity, string>();

function toCellKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / SPATIAL_CELL_SIZE);
    const y = Math.floor(position.y / SPATIAL_CELL_SIZE);
    const z = Math.floor(position.z / SPATIAL_CELL_SIZE);
    return `${x},${y},${z}`;
}

export function updateAsteroidSpatialIndex(entity: GameEntity, position: THREE.Vector3) {
    const nextKey = toCellKey(position);
    const prevKey = asteroidCellByEntity.get(entity);
    if (prevKey === nextKey) return;

    if (prevKey) {
        const prevCell = asteroidSpatialGrid.get(prevKey);
        if (prevCell) {
            prevCell.delete(entity);
            if (prevCell.size === 0) asteroidSpatialGrid.delete(prevKey);
        }
    }

    let nextCell = asteroidSpatialGrid.get(nextKey);
    if (!nextCell) {
        nextCell = new Set<GameEntity>();
        asteroidSpatialGrid.set(nextKey, nextCell);
    }
    nextCell.add(entity);
    asteroidCellByEntity.set(entity, nextKey);
}

export function removeAsteroidFromSpatialIndex(entity: GameEntity) {
    const cellKey = asteroidCellByEntity.get(entity);
    if (!cellKey) return;

    const cell = asteroidSpatialGrid.get(cellKey);
    if (cell) {
        cell.delete(entity);
        if (cell.size === 0) asteroidSpatialGrid.delete(cellKey);
    }
    asteroidCellByEntity.delete(entity);
}

export function queryAsteroidsInRange(position: THREE.Vector3, range: number): GameEntity[] {
    const minX = Math.floor((position.x - range) / SPATIAL_CELL_SIZE);
    const maxX = Math.floor((position.x + range) / SPATIAL_CELL_SIZE);
    const minY = Math.floor((position.y - range) / SPATIAL_CELL_SIZE);
    const maxY = Math.floor((position.y + range) / SPATIAL_CELL_SIZE);
    const minZ = Math.floor((position.z - range) / SPATIAL_CELL_SIZE);
    const maxZ = Math.floor((position.z + range) / SPATIAL_CELL_SIZE);

    const asteroids: GameEntity[] = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const cell = asteroidSpatialGrid.get(`${x},${y},${z}`);
                if (cell) {
                    for (const asteroid of cell) asteroids.push(asteroid);
                }
            }
        }
    }

    return asteroids;
}

// Create the React bindings
export const { Entity, Component } = createReactAPI(ECS);
