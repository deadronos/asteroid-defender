import { create } from 'zustand';

interface GameState {
    asteroidsDestroyed: number;
    activeAsteroids: number;
    health: number;
    maxHealth: number;
    gameState: 'playing' | 'gameover';
    lastDamageTime: number;
    incrementDestroyed: () => void;
    setActiveAsteroids: (count: number) => void;
    takeDamage: (amount: number) => void;
    resetGame: () => void;
}

const useGameStore = create<GameState>((set) => ({
    asteroidsDestroyed: 0,
    activeAsteroids: 0,
    health: 100,
    maxHealth: 100,
    gameState: 'playing', // 'playing' or 'gameover'
    lastDamageTime: 0,

    incrementDestroyed: () => set((state) => ({
        asteroidsDestroyed: state.asteroidsDestroyed + 1
    })),

    setActiveAsteroids: (count) => set({ activeAsteroids: count }),

    takeDamage: (amount) => set((state) => {
        if (state.gameState === 'gameover') return state;
        const newHealth = Math.max(0, state.health - amount);
        return {
            health: newHealth,
            gameState: newHealth === 0 ? 'gameover' : state.gameState,
            lastDamageTime: Date.now()
        };
    }),

    resetGame: () => set({
        asteroidsDestroyed: 0,
        activeAsteroids: 0,
        health: 100,
        gameState: 'playing',
        lastDamageTime: 0
    }),
}));

export default useGameStore;
