// NOTE: This module is intended to prevent casual inspection of stored values,
// not to provide cryptographic security. The obfuscation strategy here is NOT
// encryption and should not be treated as a security boundary.

// Retrieve the secret key from environment variables (Vite-specific).
// If missing, generate a random session key for non-critical obfuscation.
const getSecretKey = (): string => {
  try {
    // Safely access import.meta.env to avoid crashes in non-Vite environments.
    const envSecret = import.meta.env?.VITE_STORAGE_SECRET;
    if (envSecret) return envSecret;
  } catch {
    // Fall back to random key if environment access fails
  }

  // Generate a random key for the current session to avoid hardcoded secrets.
  // Note: This means data will NOT persist across reloads if VITE_STORAGE_SECRET is missing.
  if (import.meta.env.DEV) {
    console.warn(
      "VITE_STORAGE_SECRET is missing. Using a random session key. " +
        "Data in localStorage will not persist across reloads.",
    );
  }

  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Basic fallback for environments without crypto.getRandomValues (e.g. some test runners)
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const SECRET_KEY = getSecretKey();

const getLocalStorage = (): Storage | null => {
  // In browser environments, localStorage is available on `window` (and `globalThis`).
  // In unit tests or certain runtimes (Node), it may be absent.
  return typeof globalThis !== "undefined"
    ? ((globalThis.localStorage as Storage | undefined) ?? null)
    : null;
};

type BufferLike = {
  from(
    input: string,
    encoding: BufferEncoding,
  ): {
    toString(encoding: BufferEncoding): string;
  };
};

type BufferEncoding = "utf-8" | "base64";

const getBuffer = (): BufferLike | null => {
  const buffer = (globalThis as typeof globalThis & { Buffer?: BufferLike }).Buffer;
  return buffer ?? null;
};

const toBase64 = (input: string): string => {
  if (typeof btoa === "function") {
    // btoa expects Latin1; encode to UTF-8 bytes first.
    const bytes = new TextEncoder().encode(input);
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    return btoa(binary);
  }

  const buffer = getBuffer();
  if (buffer) {
    return buffer.from(input, "utf-8").toString("base64");
  }

  throw new Error("No base64 encoder available in this environment");
};

const fromBase64 = (input: string): string => {
  if (typeof atob === "function") {
    const binary = atob(input);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const buffer = getBuffer();
  if (buffer) {
    return buffer.from(input, "base64").toString("utf-8");
  }

  throw new Error("No base64 decoder available in this environment");
};

const xorBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ key[i % key.length];
  }
  return output;
};

const bytesToBinaryString = (bytes: Uint8Array): string => {
  // Avoid call-argument limits by chunking.
  const chunkSize = 0x8000;
  let result = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode(...chunk);
  }
  return result;
};

export const setSecureItem = (key: string, value: string): void => {
  try {
    const storage = getLocalStorage();
    if (!storage) return;

    const secretBytes = new TextEncoder().encode(SECRET_KEY);
    const valueBytes = new TextEncoder().encode(value);
    const xored = xorBytes(valueBytes, secretBytes);
    const encoded = toBase64(bytesToBinaryString(xored));

    storage.setItem(key, encoded);
  } catch (error) {
    console.warn("Failed to save secure item to localStorage:", error);
  }
};

export const getSecureItem = (key: string): string | null => {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;

    const encoded = storage.getItem(key);
    if (encoded === null) return null;

    const binary = fromBase64(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const secretBytes = new TextEncoder().encode(SECRET_KEY);
    const decoded = xorBytes(bytes, secretBytes);

    return new TextDecoder().decode(decoded);
  } catch (error) {
    console.warn("Failed to retrieve secure item from localStorage:", error);
    return null;
  }
};
