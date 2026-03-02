import { create } from 'zustand';

const useGameStore = create((set) => ({
    asteroidsDestroyed: 0,
    activeAsteroids: 0,

    incrementDestroyed: () => set((state) => ({
        asteroidsDestroyed: state.asteroidsDestroyed + 1
    })),

    setActiveAsteroids: (count) => set({ activeAsteroids: count }),
}));

export default useGameStore;
