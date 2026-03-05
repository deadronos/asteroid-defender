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

describe('gameStore camera settings', () => {
  it('defaults to cinematic mode and reducedMotion off', () => {
    const state = useGameStore.getState();
    expect(state.cameraMode).toBe('cinematic');
    expect(state.reducedMotion).toBe(false);
  });

  it('toggleCameraMode switches between cinematic and static', () => {
    useGameStore.getState().toggleCameraMode();
    expect(useGameStore.getState().cameraMode).toBe('static');

    useGameStore.getState().toggleCameraMode();
    expect(useGameStore.getState().cameraMode).toBe('cinematic');
  });

  it('toggleReducedMotion flips the reducedMotion flag', () => {
    useGameStore.getState().toggleReducedMotion();
    expect(useGameStore.getState().reducedMotion).toBe(true);

    useGameStore.getState().toggleReducedMotion();
    expect(useGameStore.getState().reducedMotion).toBe(false);
  });

  it('camera settings persist across game state changes', () => {
    useGameStore.getState().toggleCameraMode();
    useGameStore.getState().toggleReducedMotion();

    useGameStore.getState().startGame();
    const state = useGameStore.getState();
    expect(state.cameraMode).toBe('static');
    expect(state.reducedMotion).toBe(true);
  });
});

describe('gameStore cinematic indicator', () => {
  it('defaults showCinematicIndicator to true', () => {
    expect(useGameStore.getState().showCinematicIndicator).toBe(true);
  });

  it('toggleCinematicIndicator flips the flag', () => {
    useGameStore.getState().toggleCinematicIndicator();
    expect(useGameStore.getState().showCinematicIndicator).toBe(false);

    useGameStore.getState().toggleCinematicIndicator();
    expect(useGameStore.getState().showCinematicIndicator).toBe(true);
  });

  it('inCinematicTransition defaults to false', () => {
    expect(useGameStore.getState().inCinematicTransition).toBe(false);
  });

  it('setCinematicTransition updates the inCinematicTransition flag', () => {
    useGameStore.getState().setCinematicTransition(true);
    expect(useGameStore.getState().inCinematicTransition).toBe(true);

    useGameStore.getState().setCinematicTransition(false);
    expect(useGameStore.getState().inCinematicTransition).toBe(false);
  });

  it('showCinematicIndicator persists across game state changes', () => {
    useGameStore.getState().toggleCinematicIndicator();
    expect(useGameStore.getState().showCinematicIndicator).toBe(false);

    useGameStore.getState().startGame();
    expect(useGameStore.getState().showCinematicIndicator).toBe(false);
  });
});
