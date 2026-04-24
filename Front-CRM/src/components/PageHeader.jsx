import { useTheme } from '../context/ThemeContext';

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
                        style={{ fontSize: 16 }}
                    >
                        {tk.isDark ? '☀' : '☾'}
                    </button>
                )}
            </div>
        </div>
    );
}
