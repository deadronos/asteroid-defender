import { World } from 'miniplex';
import { createReactAPI } from 'miniplex-react';

// Define the central ECS world
export const ECS = new World();

// Create the React bindings
export const { Entity, Component, useEntities, useArchetype, useQuery } = createReactAPI(ECS);
