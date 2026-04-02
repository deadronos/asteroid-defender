import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setSecureItem, getSecureItem } from "./storage";

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe("storage utility", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("should obfuscate data when saving to localStorage", () => {
    const key = "test-key";
    const value = "true";
    setSecureItem(key, value);
    const storedValue = globalThis.localStorage.getItem(key);
    expect(storedValue).not.toBe(value);
    expect(storedValue).not.toBeNull();
  });

  it("should correctly decrypt data when retrieving from localStorage", () => {
    const key = "test-key";
    const value = "true";
    setSecureItem(key, value);
    const retrievedValue = getSecureItem(key);
    expect(retrievedValue).toBe(value);
  });

  it("should return null for non-existent keys", () => {
    const retrievedValue = getSecureItem("non-existent");
    expect(retrievedValue).toBeNull();
  });

  it("should handle complex strings", () => {
    const key = "complex-key";
    const value = '{"seen": true, "version": "1.0.0"}';

    setSecureItem(key, value);

    const retrievedValue = getSecureItem(key);
    expect(retrievedValue).toBe(value);
  });

  it("should handle unicode strings", () => {
    const key = "unicode-key";
    const value = "こんにちは世界 🌍";

    setSecureItem(key, value);

    const retrievedValue = getSecureItem(key);
    expect(retrievedValue).toBe(value);
  });

  it("should handle storage failures gracefully", () => {
    const key = "test-key";
    const value = "true";

    // Mock setItem to throw
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    setSecureItem(key, value);

    expect(consoleSpy).toHaveBeenCalled();
    expect(globalThis.localStorage.getItem(key)).toBeNull();
  });
});
