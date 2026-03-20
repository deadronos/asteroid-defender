import { useMemo } from 'react';
import { Stars } from '@react-three/drei';
import type { EffectsQuality } from '../utils/visualQuality';
import { getBackgroundVisualProfile } from '../utils/backgroundVisualQuality';
import Nebula from './background/Nebula';
import SpaceDust from './background/SpaceDust';
import ShootingStars from './background/ShootingStars';

interface SpaceBackgroundProps {
    quality: EffectsQuality;
    reducedMotion: boolean;
}

export default function SpaceBackground({ quality, reducedMotion }: SpaceBackgroundProps) {
    const profile = useMemo(
        () => getBackgroundVisualProfile(quality, reducedMotion),
        [quality, reducedMotion],
    );

    return (
        <>
            <Stars
                radius={150}
                depth={80}
                count={profile.starCount}
                factor={profile.starFactor}
                saturation={profile.starSaturation}
                fade
                speed={profile.starSpeed}
            />
            {profile.showNebula && <Nebula />}
            <SpaceDust count={profile.dustCount} animate={profile.animateDust} />
            {profile.showShootingStars && <ShootingStars />}
        </>
    );
}
