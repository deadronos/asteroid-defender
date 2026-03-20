import OverlayBackdrop from './OverlayBackdrop';
import { dialogCard, iconButton, primaryButton } from './hudStyles';

interface OnboardingDialogProps {
    canStartFromOverlay: boolean;
    onDismiss: () => void;
    onStart: () => void;
}

/** Help / mission-brief dialog shown on first load and via Help button. */
export default function OnboardingDialog({ canStartFromOverlay, onDismiss, onStart }: OnboardingDialogProps) {
    return (
        <OverlayBackdrop backgroundColor="rgba(2, 4, 12, 0.82)" zIndex={130} onClick={onDismiss}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="How to play"
                onClick={(event) => event.stopPropagation()}
                style={dialogCard}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Mission Brief</h2>
                    <button
                        onClick={onDismiss}
                        aria-label="Close help"
                        style={iconButton}
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
                        ...primaryButton,
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        fontSize: '1rem',
                    }}
                >
                    {canStartFromOverlay ? 'Start Defense (Enter)' : 'Close Help'}
                </button>
            </div>
        </OverlayBackdrop>
    );
}
