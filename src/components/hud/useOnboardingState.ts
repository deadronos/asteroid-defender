import { useCallback, useState } from 'react';
import { getSecureItem, setSecureItem } from '../../utils/storage';

const ONBOARDING_STORAGE_KEY = 'asteroid-defender:onboarding-seen-v1';

function getInitialOnboardingOpen() {
    try {
        return getSecureItem(ONBOARDING_STORAGE_KEY) !== 'true';
    } catch {
        return true;
    }
}

export function useOnboardingState(startGame: () => void) {
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

    return {
        isOnboardingOpen,
        dismissOnboarding,
        startFromOnboarding,
        openOnboarding,
    };
}
