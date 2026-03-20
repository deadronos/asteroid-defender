import type { CSSProperties } from 'react';

/** Base glass-panel button used in the top-right toolbar. */
export const toolbarButtonBase: CSSProperties = {
    height: 44,
    borderRadius: '10px',
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
    fontWeight: 700,
    border: '1px solid rgba(126, 200, 255, 0.45)',
    background: 'rgba(8, 12, 24, 0.86)',
    color: '#dbeafe',
};

/** Solid primary-action button (blue). */
export const primaryButton: CSSProperties = {
    cursor: 'pointer',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 700,
};

/** Solid danger-action button (red). */
export const dangerButton: CSSProperties = {
    cursor: 'pointer',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 700,
};

/** Full-screen backdrop shared by the menu, pause, and game-over overlays. */
export const fullscreenOverlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
    textAlign: 'center',
    padding: '24px',
};

/** Shared title styling for menu/pause/game-over overlays. */
export const overlayTitle: CSSProperties = {
    margin: '0 0 0.8rem 0',
    color: '#fff',
    fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
};

/** Shared supporting copy styling for overlays. */
export const overlayText: CSSProperties = {
    color: '#bfdbfe',
    fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
    margin: '0 0 1.8rem 0',
};

/** Frosted panel used by the onboarding dialog. */
export const dialogCard: CSSProperties = {
    width: 'min(560px, 100%)',
    background: 'linear-gradient(145deg, rgba(13,17,33,0.96), rgba(8,12,24,0.96))',
    border: '1px solid rgba(126, 200, 255, 0.35)',
    borderRadius: '14px',
    boxShadow: '0 16px 34px rgba(0,0,0,0.5)',
    padding: '20px 20px 18px',
    color: '#dbeafe',
    lineHeight: 1.45,
    textAlign: 'left',
};

/** Compact icon button used in dialog chrome. */
export const iconButton: CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    width: 36,
    height: 36,
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
};
