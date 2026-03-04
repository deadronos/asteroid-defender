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
export function queryAsteroidsInRange(position: THREE.Vector3, range: number): GameEntity[] {
    const rangeSq = range * range;
    const asteroids: GameEntity[] = [];
    for (const entity of asteroidQuery.entities) {
        if (entity.position && position.distanceToSquared(entity.position) <= rangeSq) {
            asteroids.push(entity);
        }
    }
    return asteroids;
}

// Create the React bindings
export const { Entity, Component } = createReactAPI(ECS);
