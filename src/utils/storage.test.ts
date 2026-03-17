import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSecureItem, getSecureItem } from './storage';

describe('storage utility', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('should obfuscate data when saving to localStorage', () => {
        const key = 'test-key';
        const value = 'true';

        setSecureItem(key, value);

        const storedValue = window.localStorage.getItem(key);
        expect(storedValue).not.toBe(value);
        expect(storedValue).not.toBeNull();
    });

    it('should correctly decrypt data when retrieving from localStorage', () => {
        const key = 'test-key';
        const value = 'true';

        setSecureItem(key, value);

        const retrievedValue = getSecureItem(key);
        expect(retrievedValue).toBe(value);
    });

    it('should return null for non-existent keys', () => {
        const retrievedValue = getSecureItem('non-existent');
        expect(retrievedValue).toBeNull();
    });

    it('should handle complex strings', () => {
        const key = 'complex-key';
        const value = '{"seen": true, "version": "1.0.0"}';

        setSecureItem(key, value);

        const retrievedValue = getSecureItem(key);
        expect(retrievedValue).toBe(value);
    });

    it('should handle storage failures gracefully', () => {
        const key = 'test-key';
        const value = 'true';

        // Mock setItem to throw
        const setItemMock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('Storage full');
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        setSecureItem(key, value);

        expect(consoleSpy).toHaveBeenCalled();
        expect(window.localStorage.getItem(key)).toBeNull();
    });
});
