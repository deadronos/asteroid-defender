// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import HUDStats from "./HUDStats";
import useGameStore from "../../store/gameStore";

// Per-file jsdom: the rest of the suite keeps the node environment.
const initialGameState = useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(initialGameState, true);
  localStorage.clear();
});

afterEach(cleanup);

const healthLabel = () => screen.getByText(/^\d+%$/);

/** The bar track follows the label's row, and its first child is the fill. */
const healthBarFill = () =>
  healthLabel().parentElement?.nextElementSibling?.firstElementChild as HTMLElement;

describe("HUDStats", () => {
  it("shows the health ratio and the critical colour with a non-100 maxHealth", () => {
    useGameStore.setState({ health: 40, maxHealth: 200 });
    render(<HUDStats />);

    const label = healthLabel();
    expect(label.textContent).toBe("20%");
    // jsdom normalizes the component's hex colours to rgb() in the style attribute.
    expect(label.style.color).toBe("rgb(239, 68, 68)");
    expect(healthBarFill().style.width).toBe("20%");
    expect(healthBarFill().style.backgroundColor).toBe("rgb(239, 68, 68)");
  });

  it("keeps healthy integrity green", () => {
    useGameStore.setState({ health: 160, maxHealth: 200 });
    render(<HUDStats />);

    expect(healthLabel().textContent).toBe("80%");
    expect(healthLabel().style.color).toBe("rgb(74, 222, 128)");
    expect(healthBarFill().style.width).toBe("80%");
  });

  it("shows the run counters", () => {
    useGameStore.setState({ asteroidsDestroyed: 7, activeAsteroids: 3 });
    render(<HUDStats />);

    expect(screen.getByText("Destroyed:").parentElement?.textContent).toBe("Destroyed: 7");
    expect(screen.getByText("Warning | Active Swarm:").parentElement?.textContent).toBe(
      "Warning | Active Swarm: 3",
    );
  });

  it("names the current game state", () => {
    useGameStore.setState({ gameState: "playing" });
    render(<HUDStats />);

    expect(screen.getByLabelText("Game state: PLAYING").textContent).toBe("PLAYING");
  });
});
