import { createTelemetryStore, type TelemetryMetadata, type TelemetryStore } from "./core";

const TELEMETRY_PARAM = "telemetry";
const ENABLED_STORAGE_KEY = "dev-telemetry-enabled";

let store: TelemetryStore | null = null;
let hotkeysBound = false;

function getWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function isDevTelemetryEnabledByDefault(win: Window): boolean {
  const params = new URLSearchParams(win.location.search);
  const override = params.get(TELEMETRY_PARAM);

  if (override === "off") {
    return false;
  }

  if (override === "on") {
    return true;
  }

  return win.localStorage.getItem(ENABLED_STORAGE_KEY) !== "0";
}

function persistEnabled(enabled: boolean) {
  const win = getWindow();
  if (!win) {
    return;
  }

  win.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "1" : "0");
}

function exportTelemetryJson(currentStore: TelemetryStore): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      snapshot: currentStore.getSnapshot(),
      events: currentStore.exportEvents(),
    },
    null,
    2,
  );
}

function downloadTelemetry(currentStore: TelemetryStore) {
  const win = getWindow();
  if (!win) {
    return;
  }

  const blob = new Blob([exportTelemetryJson(currentStore)], {
    type: "application/json",
  });
  const url = win.URL.createObjectURL(blob);
  const link = win.document.createElement("a");
  link.href = url;
  link.download = `dev-telemetry-${Date.now()}.json`;
  win.document.body.appendChild(link);
  link.click();
  link.remove();
  win.URL.revokeObjectURL(url);
}

function bindHotkeys(currentStore: TelemetryStore) {
  if (hotkeysBound) {
    return;
  }

  const win = getWindow();
  if (!win) {
    return;
  }

  hotkeysBound = true;
  win.addEventListener("keydown", (event) => {
    if (!event.altKey || !event.shiftKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "t") {
      event.preventDefault();
      currentStore.toggleOverlay();
    }

    if (key === "p") {
      event.preventDefault();
      currentStore.togglePaused();
    }
  });
}

function attachWindowApi(currentStore: TelemetryStore) {
  const win = getWindow();
  if (!win) {
    return;
  }

  win.__DEV_TELEMETRY__ = {
    getSnapshot: () => currentStore.getSnapshot(),
    exportJson: () => exportTelemetryJson(currentStore),
    download: () => downloadTelemetry(currentStore),
    clear: () => currentStore.clear(),
    pause: () => currentStore.setPaused(true),
    resume: () => currentStore.setPaused(false),
    showOverlay: () => currentStore.setOverlayVisible(true),
    hideOverlay: () => currentStore.setOverlayVisible(false),
    toggleOverlay: () => currentStore.toggleOverlay(),
    enable: () => {
      persistEnabled(true);
      currentStore.setEnabled(true);
      currentStore.mark("telemetry:enabled");
    },
    disable: () => {
      currentStore.mark("telemetry:disabled");
      persistEnabled(false);
      currentStore.setEnabled(false);
    },
    mark: (name: string, metadata?: TelemetryMetadata) => currentStore.mark(name, metadata),
  };
}

export function bootstrapDevTelemetry(): TelemetryStore | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  if (store) {
    return store;
  }

  const win = getWindow();
  if (!win) {
    return null;
  }

  store = createTelemetryStore({
    enabled: isDevTelemetryEnabledByDefault(win),
    overlayVisible: false,
    startedAt: Date.now(),
    clock: () => performance.now(),
  });

  attachWindowApi(store);
  bindHotkeys(store);
  store.mark("telemetry:bootstrap", {
    enabled: store.getSnapshot().enabled,
  });

  return store;
}

export function getDevTelemetryStore(): TelemetryStore | null {
  return store;
}

export function markTelemetry(name: string, metadata?: TelemetryMetadata) {
  store?.mark(name, metadata);
}

export function __devTelemetryEnter(name: string): number {
  return store?.enter(name) ?? 0;
}

export function __devTelemetryExit(callId: number) {
  store?.exit(callId);
}

export function __devTelemetryThrow(callId: number, error: unknown) {
  store?.fail(callId, error);
}