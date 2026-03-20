import type { EffectsQuality } from './visualQuality';

export interface BackgroundVisualProfile {
    starCount: number;
    starFactor: number;
    starSaturation: number;
    starSpeed: number;
    showNebula: boolean;
    dustCount: number;
    animateDust: boolean;
    showShootingStars: boolean;
}

const FULL_PROFILE: BackgroundVisualProfile = {
    starCount: 7000,
    starFactor: 5,
    starSaturation: 0.15,
    starSpeed: 0.5,
    showNebula: true,
    dustCount: 400,
    animateDust: true,
    showShootingStars: true,
};

const OFF_PROFILE: BackgroundVisualProfile = {
    starCount: 900,
    starFactor: 3.2,
    starSaturation: 0,
    starSpeed: 0,
    showNebula: false,
    dustCount: 0,
    animateDust: false,
    showShootingStars: false,
};

export function getBackgroundVisualProfile(quality: EffectsQuality, reducedMotion: boolean): BackgroundVisualProfile {
    if (quality === 'full' && !reducedMotion) {
        return FULL_PROFILE;
    }

    if (quality === 'off') {
        return OFF_PROFILE;
    }

    return {
        starCount: reducedMotion ? 1800 : 3200,
        starFactor: reducedMotion ? 3.5 : 4.2,
        starSaturation: reducedMotion ? 0.04 : 0.08,
        starSpeed: reducedMotion ? 0.2 : 0.35,
        showNebula: true,
        dustCount: reducedMotion ? 140 : 220,
        animateDust: false,
        showShootingStars: !reducedMotion,
    };
}