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

// Create the React bindings
export const { Entity, Component } = createReactAPI(ECS);
