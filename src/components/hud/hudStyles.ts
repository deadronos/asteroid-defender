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
