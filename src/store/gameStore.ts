import { create } from 'zustand';

export type GameplayState = 'menu' | 'playing' | 'paused' | 'gameover';
export type CameraMode = 'cinematic' | 'static';

interface GameState {
    asteroidsDestroyed: number;
    activeAsteroids: number;
    health: number;
    maxHealth: number;
    gameState: GameplayState;
    sessionId: number;
    runStartedAt: number;
    runEndedAt: number | null;
    lastDamageTime: number;
    cameraMode: CameraMode;
    reducedMotion: boolean;
    /** Whether the cinematic-sweep HUD label is shown during transitions */
    showCinematicIndicator: boolean;
    /** True while the cinematic camera is mid-transition between shots */
    inCinematicTransition: boolean;
    incrementDestroyed: () => void;
    setActiveAsteroids: (count: number) => void;
    takeDamage: (amount: number) => void;
    startGame: () => void;
    pauseGame: () => void;
    resumeGame: () => void;
    togglePause: () => void;
    restartGame: () => void;
    resetGame: () => void;
    toggleCameraMode: () => void;
    toggleReducedMotion: () => void;
    toggleCinematicIndicator: () => void;
    setCinematicTransition: (active: boolean) => void;
}

const MAX_HEALTH = 100;

function freshRoundState() {
    return {
        asteroidsDestroyed: 0,
        activeAsteroids: 0,
        health: MAX_HEALTH,
        runStartedAt: 0,
        runEndedAt: null,
        lastDamageTime: 0,
    };
}

const useGameStore = create<GameState>((set) => ({
    ...freshRoundState(),
    maxHealth: MAX_HEALTH,
    gameState: 'menu',
    sessionId: 0,
    lastDamageTime: 0,
    cameraMode: 'cinematic',
    reducedMotion: false,
    showCinematicIndicator: true,
    inCinematicTransition: false,

    incrementDestroyed: () => set((state) => ({
        asteroidsDestroyed: state.asteroidsDestroyed + 1
    })),

    setActiveAsteroids: (count) => set({ activeAsteroids: count }),

    takeDamage: (amount) => set((state) => {
        if (state.gameState !== 'playing') return state;
        const now = Date.now();
        const newHealth = Math.max(0, state.health - amount);
        return {
            health: newHealth,
            gameState: newHealth === 0 ? 'gameover' : state.gameState,
            runEndedAt: newHealth === 0 ? (state.runEndedAt ?? now) : state.runEndedAt,
            lastDamageTime: now
        };
    }),

    startGame: () => set((state) => ({
        ...freshRoundState(),
        gameState: 'playing',
        sessionId: state.sessionId + 1,
        runStartedAt: Date.now(),
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
        runStartedAt: Date.now(),
    })),

    resetGame: () => set((state) => ({
        ...freshRoundState(),
        gameState: 'playing',
        sessionId: state.sessionId + 1,
        runStartedAt: Date.now(),
    })),

    toggleCameraMode: () => set((state) => ({
        cameraMode: state.cameraMode === 'cinematic' ? 'static' : 'cinematic',
    })),

    toggleReducedMotion: () => set((state) => ({
        reducedMotion: !state.reducedMotion,
    })),

    toggleCinematicIndicator: () => set((state) => ({
        showCinematicIndicator: !state.showCinematicIndicator,
    })),

    setCinematicTransition: (active) => set({ inCinematicTransition: active }),
}));

export default useGameStore;
