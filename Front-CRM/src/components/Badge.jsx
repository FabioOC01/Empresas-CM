import { TYPE_COLOR, TYPE_ICON } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';

const ESTADO_COLOR = {
    'Pendiente':   '#e67e22',
    'En Progreso': '#10b981',
    'Completado':  '#27ae60',
    'Cancelado':   '#e74c3c',
};

const PRIO_COLOR = {
    'Alta':  '#e74c3c',
    'Media': '#e67e22',
    'Baja':  '#27ae60',
};

const ROL_COLOR = {
    'Gerencia':         '#3f51b5',
    'Marketing':        '#e91e63',
    'Ventas':           '#27ae60',
    'Retail':           '#f57f17',
    'Corporativo':      '#8e44ad',
    'Soporte Técnico':  '#16a085',
    'Logística':        '#1565c0',
    'Admin':            '#6b7a8d',
};

// En modo claro: alpha 18% (pastel suave). En modo oscuro: alpha 35% (tinte más visible).
function badgeBg(color, isDark) {
    return color + (isDark ? '38' : '1e');
}

export function TipoBadge({ tipo }) {
    const { isDark } = useTheme();
    const fg = TYPE_COLOR[tipo]?.color || '#8899aa';
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: badgeBg(fg, isDark), color: isDark ? '#cbd5e1' : fg, whiteSpace: 'nowrap',
        }}>
            {TYPE_ICON[tipo] || ''} {tipo}
        </span>
    );
}

export function EstadoBadge({ estado }) {
    const { isDark } = useTheme();
    const fg = ESTADO_COLOR[estado] || '#8899aa';
    return (
        <span style={{
            padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: badgeBg(fg, isDark), color: fg,
        }}>
            {estado}
        </span>
    );
}

export function PrioBadge({ prioridad }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: PRIO_COLOR[prioridad] || '#aaa', flexShrink: 0,
            }} />
            {prioridad}
        </span>
    );
}

export function RolBadge({ rol }) {
    const { isDark } = useTheme();
    const fg = ROL_COLOR[rol] || '#8899aa';
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: badgeBg(fg, isDark), color: fg,
        }}>
            {rol}
        </span>
    );
}
