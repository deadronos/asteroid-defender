import { useEffect } from "react";
import useGameStore from "../../store/gameStore";

interface UseKeyboardShortcutsOptions {
  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  dismissOnboarding: () => void;
  startFromOnboarding: () => void;
}

/**
 * Registers global keyboard shortcuts for HUD interactions and removes them
 * on cleanup.  Isolated here so the logic is easy to test independently.
 */
export function useKeyboardShortcuts({
  isOnboardingOpen,
  openOnboarding,
  dismissOnboarding,
  startFromOnboarding,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const state = useGameStore.getState();

      if (event.key === "Enter" && state.gameState === "menu") {
        event.preventDefault();
        startFromOnboarding();
        return;
      }

      if (
        (event.key === "?" || event.key === "h" || event.key === "H") &&
        state.gameState !== "gameover"
      ) {
        event.preventDefault();
        openOnboarding();
        return;
      }

      if (event.key === "Escape" && isOnboardingOpen && state.gameState !== "menu") {
        event.preventDefault();
        dismissOnboarding();
        return;
      }

      if (
        event.key === "Escape" &&
        (state.gameState === "playing" || state.gameState === "paused")
      ) {
        event.preventDefault();
        state.togglePause();
        return;
      }

      if (
        (event.key === "r" || event.key === "R") &&
        (state.gameState === "paused" || state.gameState === "gameover")
      ) {
        event.preventDefault();
        state.restartGame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissOnboarding, isOnboardingOpen, openOnboarding, startFromOnboarding]);
}
