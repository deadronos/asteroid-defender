// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GameOverOverlay from "./GameOverOverlay";
import useGameStore from "../../store/gameStore";

const initialGameState = useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(initialGameState, true);
  localStorage.clear();
});

afterEach(cleanup);

describe("GameOverOverlay", () => {
  it("reports the destroyed count and the time survived", () => {
    useGameStore.setState({
      gameState: "gameover",
      asteroidsDestroyed: 12,
      health: 0,
      runStartedAt: 1_000,
      runEndedAt: 126_000,
    });
    render(<GameOverOverlay />);

    expect(screen.getByRole("heading", { name: "BASE DESTROYED" })).toBeTruthy();
    expect(screen.getByText("You destroyed 12 asteroids before falling.")).toBeTruthy();
    expect(screen.getByText("Time survived: 2:05")).toBeTruthy();
  });

  it("restarts the run from the Restart Protocol button", () => {
    useGameStore.setState({
      gameState: "gameover",
      sessionId: 4,
      asteroidsDestroyed: 12,
      health: 0,
      runStartedAt: 1_000,
      runEndedAt: 126_000,
    });
    render(<GameOverOverlay />);

    fireEvent.click(screen.getByRole("button", { name: "Restart Protocol (R)" }));

    const state = useGameStore.getState();
    expect(state.gameState).toBe("playing");
    expect(state.sessionId).toBe(5);
    expect(state.health).toBe(state.maxHealth);
    expect(state.asteroidsDestroyed).toBe(0);
    expect(state.runEndedAt).toBeNull();
  });
});
