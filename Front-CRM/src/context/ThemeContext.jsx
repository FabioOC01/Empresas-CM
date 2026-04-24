import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useActividadesContext } from './ActividadesContext';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

// Tokens apuntan a CSS vars. Se resuelven en paint-time al cambiar data-theme.
export function buildTokens(isDark) {
    return {
        isDark,
        bg:     'var(--bg-main)',
        card:   'var(--bg-card)',
        card2:  'var(--surface-2)',
        txt:    'var(--text-main)',
        txt2:   'var(--text-muted)',
        txt3:   'var(--text-dim)',
        bdr:    'var(--border)',
        inp:    'var(--input-bg)',
        inpBdr: 'var(--input-bdr)',
        shadow: 'var(--shadow-sm)',
        accent: 'var(--accent)',
        accentGlow:   'var(--accent-glow)',
        accentBorder: 'var(--accent-border)',
    };
}

export function ThemeProvider({ children }) {
    const { config } = useActividadesContext();
    const { user } = useAuth();
    const empresaDark = config?.branding?.dark_mode === true;

    const darkKey = user?.id ? `crm_dark_mode_${user.id}` : null;

    const [localDark, setLocalDark] = useState(() => {
        if (!darkKey) return null;
        const stored = localStorage.getItem(darkKey);
        return stored !== null ? stored === 'true' : null;
    });

    useEffect(() => {
        if (!darkKey) { setLocalDark(null); return; }
        const stored = localStorage.getItem(darkKey);
        setLocalDark(stored !== null ? stored === 'true' : null);
    }, [darkKey]);

    const isDark = localDark !== null ? localDark : empresaDark;

    useEffect(() => {
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleDark = useCallback(() => {
        setLocalDark(prev => {
            const current = prev !== null ? prev : empresaDark;
            const next = !current;
            if (darkKey) localStorage.setItem(darkKey, String(next));
            return next;
        });
    }, [empresaDark, darkKey]);

    const tk = { ...buildTokens(isDark), toggleDark };
    return <ThemeContext.Provider value={tk}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
