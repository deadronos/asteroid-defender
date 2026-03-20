import { useCallback, useEffect, useRef, useState } from 'react';
import { nextId } from '../../utils/id';

const SHIELD_IMPACT_DURATION_MS = 900;

export interface ShieldImpactData {
    id: string;
    pos: [number, number, number];
}

export function useShieldImpacts() {
    const [shieldImpacts, setShieldImpacts] = useState<ShieldImpactData[]>([]);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        return () => {
            for (const timer of timersRef.current) {
                clearTimeout(timer);
            }
            timersRef.current = [];
        };
    }, []);

    const addShieldImpact = useCallback((pos: [number, number, number]) => {
        const impactId = nextId();
        setShieldImpacts((prev) => [...prev, { id: impactId, pos }]);

        const timer = setTimeout(() => {
            setShieldImpacts((prev) => prev.filter((impact) => impact.id !== impactId));
            timersRef.current = timersRef.current.filter((activeTimer) => activeTimer !== timer);
        }, SHIELD_IMPACT_DURATION_MS);

        timersRef.current.push(timer);
    }, []);

    return { shieldImpacts, addShieldImpact };
}
