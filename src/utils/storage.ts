const SECRET_KEY = 'asteroid-defender-onboarding-salt';

/**
 * A simple XOR-based obfuscation to avoid storing data in plain text in localStorage.
 * While not cryptographically secure against a determined attacker with access to the source code,
 * it prevents casual inspection and improves the security posture for non-sensitive flags.
 */
const xorProcess = (text: string, key: string): string => {
    return Array.from(text)
        .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join('');
};

export const setSecureItem = (key: string, value: string): void => {
    try {
        const processed = xorProcess(value, SECRET_KEY);
        // Using btoa for a basic base64 encoding of the obfuscated string
        const encoded = btoa(processed);
        window.localStorage.setItem(key, encoded);
    } catch (error) {
        console.warn('Failed to save secure item to localStorage:', error);
    }
};

export const getSecureItem = (key: string): string | null => {
    try {
        const encoded = window.localStorage.getItem(key);
        if (encoded === null) return null;

        const processed = atob(encoded);
        return xorProcess(processed, SECRET_KEY);
    } catch (error) {
        console.warn('Failed to retrieve secure item from localStorage:', error);
        return null;
    }
};
