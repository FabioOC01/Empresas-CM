import { useTheme } from '../context/ThemeContext';
import { MoonIcon, SunIcon } from './Icons';

export default function PageHeader({ title, subtitle, actions, showThemeToggle = true }) {
    const tk = useTheme();
    return (
        <div className="page-header">
            <div>
                <h1 className="page-title">{title}</h1>
                {subtitle && <div className="page-subtitle">{subtitle}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {actions}
                {showThemeToggle && (
                    <button
                        className="icon-btn"
                        onClick={tk.toggleDark}
                        title={tk.isDark ? 'Modo claro' : 'Modo oscuro'}
                    >
                        {tk.isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
}
