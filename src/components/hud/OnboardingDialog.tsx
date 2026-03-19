interface OnboardingDialogProps {
    canStartFromOverlay: boolean;
    onDismiss: () => void;
    onStart: () => void;
}

/** Help / mission-brief dialog shown on first load and via Help button. */
export default function OnboardingDialog({ canStartFromOverlay, onDismiss, onStart }: OnboardingDialogProps) {
    return (
        <div
            onClick={onDismiss}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 130,
                background: 'rgba(2, 4, 12, 0.82)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="How to play"
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: 'min(560px, 100%)',
                    background: 'linear-gradient(145deg, rgba(13,17,33,0.96), rgba(8,12,24,0.96))',
                    border: '1px solid rgba(126, 200, 255, 0.35)',
                    borderRadius: '14px',
                    boxShadow: '0 16px 34px rgba(0,0,0,0.5)',
                    padding: '20px 20px 18px',
                    color: '#dbeafe',
                    lineHeight: 1.45,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Mission Brief</h2>
                    <button
                        onClick={onDismiss}
                        aria-label="Close help"
                        style={{
                            border: 'none',
                            borderRadius: '8px',
                            width: 36,
                            height: 36,
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <p style={{ margin: '10px 0 12px', color: '#bfdbfe' }}>
                    Defend the base from incoming asteroids. Turrets auto-target and fire, so your job is to manage the defense view, monitor the swarm, and keep Base Integrity above zero.
                </p>

                <ul style={{ margin: '0 0 14px 18px', padding: 0, display: 'grid', gap: '6px' }}>
                    <li><strong>Base Integrity</strong>: your remaining health.</li>
                    <li><strong>Destroyed</strong>: asteroids eliminated by your defenses.</li>
                    <li><strong>Active Swarm</strong>: current asteroid pressure.</li>
                    <li><strong>Enter / Start Defense</strong>: launch the run from the briefing overlay.</li>
                    <li><strong>Esc</strong>: pause or resume the simulation.</li>
                    <li><strong>R</strong>: restart while paused or after game over.</li>
                    <li><strong>? / H</strong>: reopen this help overlay during play.</li>
                    <li><strong>🎬 Cinematic / 📷 Static</strong>: switch between sweeping showcase shots and a steady tactical view.</li>
                    <li><strong>♿ Reduced Motion</strong>: slow camera cuts and reduce movement intensity.</li>
                </ul>

                <p style={{ margin: '0 0 14px', color: '#cbd5f5' }}>
                    Cinematic mode performs short camera sweeps between dramatic angles. If you want a steadier view, switch to Static or enable Reduced Motion.
                </p>

                <button
                    onClick={canStartFromOverlay ? onStart : onDismiss}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        borderRadius: '10px',
                        background: '#3b82f6',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    {canStartFromOverlay ? 'Start Defense (Enter)' : 'Close Help'}
                </button>
            </div>
        </div>
    );
}
