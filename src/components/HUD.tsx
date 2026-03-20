import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { useKeyboardShortcuts } from './hud/useKeyboardShortcuts';
import { formatDuration } from './hud/formatDuration';
import HUDStats from './hud/HUDStats';
import HUDControls from './hud/HUDControls';
import MenuOverlay from './hud/MenuOverlay';
import PauseOverlay from './hud/PauseOverlay';
import GameOverOverlay from './hud/GameOverOverlay';
import OnboardingDialog from './hud/OnboardingDialog';
import CinematicIndicator from './hud/CinematicIndicator';
import { useOnboardingState } from './hud/useOnboardingState';

export default function HUD() {
    const {
        asteroidsDestroyed,
        activeAsteroids,
        health,
        maxHealth,
        gameState,
        runStartedAt,
        runEndedAt,
        startGame,
        togglePause,
        resumeGame,
        restartGame,
        cameraMode,
        reducedMotion,
        showCinematicIndicator,
        inCinematicTransition,
        toggleCameraMode,
        toggleReducedMotion,
        toggleCinematicIndicator,
    } = useGameStore(
        useShallow((state) => ({
            asteroidsDestroyed: state.asteroidsDestroyed,
            activeAsteroids: state.activeAsteroids,
            health: state.health,
            maxHealth: state.maxHealth,
            gameState: state.gameState,
            runStartedAt: state.runStartedAt,
            runEndedAt: state.runEndedAt,
            startGame: state.startGame,
            togglePause: state.togglePause,
            resumeGame: state.resumeGame,
            restartGame: state.restartGame,
            cameraMode: state.cameraMode,
            reducedMotion: state.reducedMotion,
            showCinematicIndicator: state.showCinematicIndicator,
            inCinematicTransition: state.inCinematicTransition,
            toggleCameraMode: state.toggleCameraMode,
            toggleReducedMotion: state.toggleReducedMotion,
            toggleCinematicIndicator: state.toggleCinematicIndicator,
        }))
    );

    const {
        isOnboardingOpen,
        dismissOnboarding,
        startFromOnboarding,
        openOnboarding,
    } = useOnboardingState(startGame);

    useKeyboardShortcuts({
        isOnboardingOpen,
        openOnboarding,
        dismissOnboarding,
        startFromOnboarding,
    });

    const runDuration = runStartedAt > 0 && runEndedAt !== null ? runEndedAt - runStartedAt : 0;

    return (
        <>
            <HUDStats
                asteroidsDestroyed={asteroidsDestroyed}
                activeAsteroids={activeAsteroids}
                health={health}
                maxHealth={maxHealth}
                gameState={gameState}
            />

            <HUDControls
                gameState={gameState}
                cameraMode={cameraMode}
                reducedMotion={reducedMotion}
                showCinematicIndicator={showCinematicIndicator}
                togglePause={togglePause}
                toggleCameraMode={toggleCameraMode}
                toggleReducedMotion={toggleReducedMotion}
                toggleCinematicIndicator={toggleCinematicIndicator}
                openOnboarding={openOnboarding}
            />

            {gameState === 'menu' && <MenuOverlay startGame={startGame} />}

            {gameState === 'paused' && <PauseOverlay resumeGame={resumeGame} restartGame={restartGame} />}

            {isOnboardingOpen && (
                <OnboardingDialog
                    canStartFromOverlay={gameState === 'menu'}
                    onDismiss={dismissOnboarding}
                    onStart={startFromOnboarding}
                />
            )}

            {gameState === 'gameover' && (
                <GameOverOverlay
                    asteroidsDestroyed={asteroidsDestroyed}
                    runDurationLabel={formatDuration(runDuration)}
                    restartGame={restartGame}
                />
            )}

            {cameraMode === 'cinematic' && inCinematicTransition && showCinematicIndicator && (
                <CinematicIndicator />
            )}
        </>
    );
}
