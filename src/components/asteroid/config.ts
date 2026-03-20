import type { AsteroidType } from '../../ecs/world';

export interface AsteroidConfig {
    radius: number;
    speed: number;
    health: number;
    color: string;
    damage: number;
}

export const ASTEROID_CONFIGS: Record<AsteroidType, AsteroidConfig> = {
    swarmer: { radius: 0.8, speed: 13, health: 40, color: '#d4a843', damage: 5 },
    tank: { radius: 3.0, speed: 3, health: 350, color: '#555555', damage: 30 },
    splitter: { radius: 1.5, speed: 7, health: 100, color: '#a855f7', damage: 10 },
};
