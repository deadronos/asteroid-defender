import { create } from 'zustand';

export type GameplayState = 'menu' | 'playing' | 'paused' | 'gameover';

interface GameState {
    asteroidsDestroyed: number;
    activeAsteroids: number;
    health: number;
    maxHealth: number;
    gameState: GameplayState;
    sessionId: number;
    lastDamageTime: number;
    incrementDestroyed: () => void;
    setActiveAsteroids: (count: number) => void;
    takeDamage: (amount: number) => void;
    startGame: () => void;
    pauseGame: () => void;
    resumeGame: () => void;
    togglePause: () => void;
    restartGame: () => void;
    resetGame: () => void;
}

const MAX_HEALTH = 100;

function freshRoundState() {
    return {
        asteroidsDestroyed: 0,
        activeAsteroids: 0,
        health: MAX_HEALTH,
        lastDamageTime: 0,
    };
}

const useGameStore = create<GameState>((set) => ({
    ...freshRoundState(),
    maxHealth: MAX_HEALTH,
    gameState: 'menu',
    sessionId: 0,
    lastDamageTime: 0,

    incrementDestroyed: () => set((state) => ({
        asteroidsDestroyed: state.asteroidsDestroyed + 1
    })),

    setActiveAsteroids: (count) => set({ activeAsteroids: count }),

    takeDamage: (amount) => set((state) => {
        if (state.gameState !== 'playing') return state;
        const newHealth = Math.max(0, state.health - amount);
        return {
            health: newHealth,
            gameState: newHealth === 0 ? 'gameover' : state.gameState,
            lastDamageTime: Date.now()
        };
    }),

    startGame: () => set((state) => ({
        ...freshRoundState(),
        gameState: 'playing',
        sessionId: state.sessionId + 1,
    })),

    pauseGame: () => set((state) => {
        if (state.gameState !== 'playing') return state;
        return { gameState: 'paused' };
    }),

    resumeGame: () => set((state) => {
        if (state.gameState !== 'paused') return state;
        return { gameState: 'playing' };
    }),

    togglePause: () => set((state) => {
        if (state.gameState === 'playing') return { gameState: 'paused' };
        if (state.gameState === 'paused') return { gameState: 'playing' };
        return state;
    }),

    restartGame: () => set((state) => ({
        ...freshRoundState(),
        gameState: 'playing',
        sessionId: state.sessionId + 1,
    })),

    resetGame: () => set((state) => ({
        ...freshRoundState(),
        gameState: 'playing',
        sessionId: state.sessionId + 1,
    })),
}));

export default useGameStore;
