// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HUDControls from "./HUDControls";
import useGameStore from "../../store/gameStore";

const initialGameState = useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(initialGameState, true);
  localStorage.clear();
});

afterEach(cleanup);

const renderControls = () => {
  const openOnboarding = vi.fn();
  render(<HUDControls openOnboarding={openOnboarding} />);
  return { openOnboarding };
};

const click = (label: string) => fireEvent.click(screen.getByLabelText(label));

describe("HUDControls", () => {
  it("pauses and resumes the run", () => {
    useGameStore.setState({ gameState: "playing" });
    renderControls();

    expect(screen.getByLabelText("Pause game").textContent).toBe("Pause (Esc)");
    click("Pause game");
    expect(useGameStore.getState().gameState).toBe("paused");
    expect(screen.getByLabelText("Resume game").textContent).toBe("Resume (Esc)");
    click("Resume game");
    expect(useGameStore.getState().gameState).toBe("playing");
  });

  it("offers no pause button outside a run", () => {
    useGameStore.setState({ gameState: "menu" });
    renderControls();

    expect(screen.queryByLabelText("Pause game")).toBeNull();
  });

  it("switches the camera mode and hides the sweep indicator toggle", () => {
    useGameStore.setState({ cameraMode: "cinematic" });
    renderControls();

    const cameraButton = screen.getByLabelText("Switch to static camera");
    expect(cameraButton.textContent).toBe("🎬 Cinematic");
    expect(cameraButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Hide cinematic sweep indicator")).toBeTruthy();

    click("Switch to static camera");

    expect(useGameStore.getState().cameraMode).toBe("static");
    expect(screen.getByLabelText("Switch to cinematic camera").textContent).toBe("📷 Static");
    expect(screen.queryByLabelText("Hide cinematic sweep indicator")).toBeNull();
    expect(screen.queryByLabelText("Show cinematic sweep indicator")).toBeNull();
  });

  it("hides the cinematic sweep indicator", () => {
    useGameStore.setState({ cameraMode: "cinematic", showCinematicIndicator: true });
    renderControls();

    click("Hide cinematic sweep indicator");

    expect(useGameStore.getState().showCinematicIndicator).toBe(false);
    expect(screen.getByLabelText("Show cinematic sweep indicator").textContent).toBe(
      "🚫 Indicator",
    );
  });

  it("toggles reduced motion", () => {
    renderControls();

    expect(screen.getByLabelText("Enable reduced motion").textContent).toBe("⚡ Motion: Full");
    click("Enable reduced motion");

    expect(useGameStore.getState().reducedMotion).toBe(true);
    expect(screen.getByLabelText("Disable reduced motion").textContent).toBe("♿ Motion: Calm");
    expect(screen.getByLabelText("Disable reduced motion").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("opens the help dialog", () => {
    const { openOnboarding } = renderControls();

    click("Open instructions and help");

    expect(openOnboarding).toHaveBeenCalledOnce();
  });
});
