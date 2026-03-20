import { describe, expect, it } from 'vitest';
import {
    EFFECTS_OFF_MAX_DPR,
    FULL_EFFECTS_MAX_DPR,
    PERFORMANCE_FALLBACK_DPR,
    REDUCED_EFFECTS_MAX_DPR,
    REDUCED_MOTION_MAX_DPR,
    clampVisualProfile,
    degradeVisualProfile,
    fallbackVisualProfile,
    getInitialVisualProfile,
    improveVisualProfile,
} from './visualQuality';

describe('visualQuality', () => {
    it('starts with full effects on standard motion', () => {
        expect(getInitialVisualProfile(false)).toEqual({
            effectsQuality: 'full',
            dpr: FULL_EFFECTS_MAX_DPR,
        });
    });

    it('starts with reduced effects when reduced motion is enabled', () => {
        expect(getInitialVisualProfile(true)).toEqual({
            effectsQuality: 'reduced',
            dpr: REDUCED_MOTION_MAX_DPR,
        });
    });

    it('degrades quality before disabling effects entirely', () => {
        expect(degradeVisualProfile({ effectsQuality: 'full', dpr: FULL_EFFECTS_MAX_DPR }, false)).toEqual({
            effectsQuality: 'reduced',
            dpr: REDUCED_EFFECTS_MAX_DPR,
        });

        expect(degradeVisualProfile({ effectsQuality: 'reduced', dpr: REDUCED_EFFECTS_MAX_DPR }, false)).toEqual({
            effectsQuality: 'off',
            dpr: EFFECTS_OFF_MAX_DPR,
        });

        expect(degradeVisualProfile({ effectsQuality: 'off', dpr: PERFORMANCE_FALLBACK_DPR }, false)).toEqual({
            effectsQuality: 'off',
            dpr: PERFORMANCE_FALLBACK_DPR,
        });
    });

    it('improves quality conservatively based on motion settings', () => {
        expect(improveVisualProfile({ effectsQuality: 'off', dpr: PERFORMANCE_FALLBACK_DPR }, false)).toEqual({
            effectsQuality: 'reduced',
            dpr: REDUCED_EFFECTS_MAX_DPR,
        });

        expect(improveVisualProfile({ effectsQuality: 'reduced', dpr: REDUCED_EFFECTS_MAX_DPR }, false)).toEqual({
            effectsQuality: 'full',
            dpr: FULL_EFFECTS_MAX_DPR,
        });

        expect(improveVisualProfile({ effectsQuality: 'reduced', dpr: REDUCED_MOTION_MAX_DPR }, true)).toEqual({
            effectsQuality: 'reduced',
            dpr: REDUCED_MOTION_MAX_DPR,
        });
    });

    it('returns an aggressive fallback profile when performance collapses', () => {
        expect(fallbackVisualProfile()).toEqual({
            effectsQuality: 'off',
            dpr: PERFORMANCE_FALLBACK_DPR,
        });
    });

    it('clamps existing profiles to reduced-motion limits without increasing dpr', () => {
        expect(clampVisualProfile({ effectsQuality: 'full', dpr: FULL_EFFECTS_MAX_DPR }, true)).toEqual({
            effectsQuality: 'reduced',
            dpr: REDUCED_MOTION_MAX_DPR,
        });

        expect(clampVisualProfile({ effectsQuality: 'off', dpr: PERFORMANCE_FALLBACK_DPR }, true)).toEqual({
            effectsQuality: 'off',
            dpr: PERFORMANCE_FALLBACK_DPR,
        });
    });
});