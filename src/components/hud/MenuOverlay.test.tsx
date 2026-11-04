// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MenuOverlay from "./MenuOverlay";
import useGameStore from "../../store/gameStore";

const initialGameState = useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(initialGameState, true);
  localStorage.clear();
});

afterEach(cleanup);

describe("MenuOverlay", () => {
  it("starts a fresh run from the Start Defense button", () => {
    render(<MenuOverlay startGame={useGameStore.getState().startGame} />);

    expect(screen.getByRole("heading", { name: "Asteroid Defender" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start Defense" }));

    const state = useGameStore.getState();
    expect(state.gameState).toBe("playing");
    expect(state.sessionId).toBe(1);
    expect(state.health).toBe(state.maxHealth);
    expect(state.asteroidsDestroyed).toBe(0);
    expect(state.runStartedAt).toBeGreaterThan(0);
  });
});
