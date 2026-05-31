/// <reference types="vite/client" />

import type { TelemetryMetadata, TelemetrySnapshot } from "./telemetry/core";

interface ImportMetaEnv {
  readonly VITE_STORAGE_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __DEV_TELEMETRY__?: {
    getSnapshot: () => TelemetrySnapshot;
    exportJson: () => string;
    download: () => void;
    clear: () => void;
    pause: () => void;
    resume: () => void;
    showOverlay: () => void;
    hideOverlay: () => void;
    toggleOverlay: () => boolean;
    enable: () => void;
    disable: () => void;
    mark: (name: string, metadata?: TelemetryMetadata) => void;
  };
}
