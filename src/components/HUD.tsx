import useGameStore from "../store/gameStore";
import { useKeyboardShortcuts } from "./hud/useKeyboardShortcuts";
import HUDStats from "./hud/HUDStats";
import HUDControls from "./hud/HUDControls";
import MenuOverlay from "./hud/MenuOverlay";
import PauseOverlay from "./hud/PauseOverlay";
import GameOverOverlay from "./hud/GameOverOverlay";
import OnboardingDialog from "./hud/OnboardingDialog";
import CinematicIndicator from "./hud/CinematicIndicator";
import { useOnboardingState } from "./hud/useOnboardingState";

export default function HUD() {
  const gameState = useGameStore((state) => state.gameState);
  const startGame = useGameStore((state) => state.startGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const restartGame = useGameStore((state) => state.restartGame);

  const { isOnboardingOpen, dismissOnboarding, startFromOnboarding, openOnboarding } =
    useOnboardingState(startGame);

  useKeyboardShortcuts({
    isOnboardingOpen,
    openOnboarding,
    dismissOnboarding,
    startFromOnboarding,
  });

  return (
    <>
      <HUDStats />
      <HUDControls openOnboarding={openOnboarding} />

      {gameState === "menu" && <MenuOverlay startGame={startGame} />}
      {gameState === "paused" && <PauseOverlay resumeGame={resumeGame} restartGame={restartGame} />}
      {gameState === "gameover" && <GameOverOverlay />}

      {isOnboardingOpen && (
        <OnboardingDialog
          canStartFromOverlay={gameState === "menu"}
          onDismiss={dismissOnboarding}
          onStart={startFromOnboarding}
        />
      )}

      <CinematicIndicator />
    </>
  );
}
