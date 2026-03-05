import { beforeEach, describe, expect, it } from 'vitest';
import useGameStore from './gameStore';

const initialState = useGameStore.getInitialState();

beforeEach(() => {
  useGameStore.setState(initialState, true);
});

describe('gameStore gameplay state machine', () => {
  it('starts in menu state', () => {
    const state = useGameStore.getState();

    expect(state.gameState).toBe('menu');
    expect(state.health).toBe(state.maxHealth);
    expect(state.sessionId).toBe(0);
  });

  it('startGame resets counters and begins a new session', () => {
    useGameStore.setState({
      asteroidsDestroyed: 12,
      activeAsteroids: 8,
      health: 14,
      lastDamageTime: Date.now(),
    });

    const before = useGameStore.getState().sessionId;
    useGameStore.getState().startGame();
    const after = useGameStore.getState();

    expect(after.gameState).toBe('playing');
    expect(after.asteroidsDestroyed).toBe(0);
    expect(after.activeAsteroids).toBe(0);
    expect(after.health).toBe(after.maxHealth);
    expect(after.lastDamageTime).toBe(0);
    expect(after.sessionId).toBe(before + 1);
  });

  it('supports pause and resume transitions', () => {
    useGameStore.getState().startGame();
    useGameStore.getState().pauseGame();
    expect(useGameStore.getState().gameState).toBe('paused');

    useGameStore.getState().resumeGame();
    expect(useGameStore.getState().gameState).toBe('playing');
  });

  it('only applies damage while playing', () => {
    useGameStore.getState().startGame();
    useGameStore.getState().pauseGame();

    const before = useGameStore.getState().health;
    useGameStore.getState().takeDamage(20);
    expect(useGameStore.getState().health).toBe(before);

    useGameStore.getState().resumeGame();
    useGameStore.getState().takeDamage(20);
    expect(useGameStore.getState().health).toBe(before - 20);
  });

  it('sets gameover when health reaches zero and restart creates fresh run', () => {
    useGameStore.getState().startGame();
    useGameStore.getState().takeDamage(1000);
    expect(useGameStore.getState().gameState).toBe('gameover');

    const before = useGameStore.getState().sessionId;
    useGameStore.getState().restartGame();

    const after = useGameStore.getState();
    expect(after.gameState).toBe('playing');
    expect(after.health).toBe(after.maxHealth);
    expect(after.asteroidsDestroyed).toBe(0);
    expect(after.activeAsteroids).toBe(0);
    expect(after.sessionId).toBe(before + 1);
  });
});
