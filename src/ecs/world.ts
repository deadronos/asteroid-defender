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

const CELL_SIZE = 25;
export const asteroidCells = new Map<string, GameEntity[]>();

export function updateSpatialIndex() {
    for (const arr of asteroidCells.values()) {
        arr.length = 0;
    }
    for (const entity of asteroidQuery.entities) {
        if (!entity.position) continue;
        const x = Math.floor(entity.position.x / CELL_SIZE);
        const y = Math.floor(entity.position.y / CELL_SIZE);
        const z = Math.floor(entity.position.z / CELL_SIZE);
        const key = `${x},${y},${z}`;
        let arr = asteroidCells.get(key);
        if (!arr) {
            arr = [];
            asteroidCells.set(key, arr);
        }
        arr.push(entity);
    }
}

export function queryAsteroidsInRange(position: THREE.Vector3, range: number): GameEntity[] {
    const rangeSq = range * range;
    const asteroids: GameEntity[] = [];
    
    const minX = Math.floor((position.x - range) / CELL_SIZE);
    const maxX = Math.floor((position.x + range) / CELL_SIZE);
    const minY = Math.floor((position.y - range) / CELL_SIZE);
    const maxY = Math.floor((position.y + range) / CELL_SIZE);
    const minZ = Math.floor((position.z - range) / CELL_SIZE);
    const maxZ = Math.floor((position.z + range) / CELL_SIZE);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const key = `${x},${y},${z}`;
                const cell = asteroidCells.get(key);
                if (cell && cell.length > 0) {
                    for (let i = 0; i < cell.length; i++) {
                        const entity = cell[i];
                        if (entity.position && position.distanceToSquared(entity.position) <= rangeSq) {
                            asteroids.push(entity);
                        }
                    }
                }
            }
        }
    }
    return asteroids;
}

// Create the React bindings
export const { Entity, Component } = createReactAPI(ECS);
