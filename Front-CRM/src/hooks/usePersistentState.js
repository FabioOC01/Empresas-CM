import { useEffect, useState } from 'react';

export default function usePersistentState(key, initialValue) {
    const [value, setValue] = useState(() => {
        const fallback = typeof initialValue === 'function' ? initialValue() : initialValue;
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                const parsed = JSON.parse(stored);
                if (
                    fallback
                    && parsed
                    && typeof fallback === 'object'
                    && typeof parsed === 'object'
                    && !Array.isArray(fallback)
                    && !Array.isArray(parsed)
                ) {
                    return { ...fallback, ...parsed };
                }
                return parsed;
            }
        } catch {
            // Ignore malformed or blocked storage and fall back to the default.
        }
        return fallback;
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Storage can be unavailable in private or restricted contexts.
        }
    }, [key, value]);

    return [value, setValue];
}
