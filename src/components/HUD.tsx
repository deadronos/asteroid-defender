import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { getSecureItem, setSecureItem } from '../utils/storage';
import { useKeyboardShortcuts } from './hud/useKeyboardShortcuts';
import HUDStats from './hud/HUDStats';
import HUDControls from './hud/HUDControls';
import MenuOverlay from './hud/MenuOverlay';
import PauseOverlay from './hud/PauseOverlay';
import GameOverOverlay from './hud/GameOverOverlay';
import OnboardingDialog from './hud/OnboardingDialog';
import CinematicIndicator from './hud/CinematicIndicator';

const ONBOARDING_STORAGE_KEY = 'asteroid-defender:onboarding-seen-v1';

function getInitialOnboardingOpen() {
    try {
        return getSecureItem(ONBOARDING_STORAGE_KEY) !== 'true';
    } catch {
        // If storage is unavailable, default to showing onboarding for accessibility.
        return true;
    }
}

function formatDuration(milliseconds: number) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

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

    const [isOnboardingOpen, setIsOnboardingOpen] = useState(getInitialOnboardingOpen);

    const dismissOnboarding = useCallback(() => {
        setIsOnboardingOpen(false);
        try {
            setSecureItem(ONBOARDING_STORAGE_KEY, 'true');
        } catch {
            // Ignore storage failures; overlay can still be closed for the current session.
        }
    }, []);

    const startFromOnboarding = useCallback(() => {
        dismissOnboarding();
        startGame();
    }, [dismissOnboarding, startGame]);

    const openOnboarding = useCallback(() => {
        setIsOnboardingOpen(true);
    }, []);

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
