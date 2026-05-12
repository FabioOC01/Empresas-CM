import { getTypeColor } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';

const ESTADO_TONE = {
    'Pendiente':   { fg: '#5b5d57', bg: '#efeeea', dot: '#5b5d57' },
    'En Progreso': { fg: '#2862c8', bg: '#e8f0fc', dot: '#2862c8' },
    'Completado':  { fg: '#036b4c', bg: '#ecfdf5', dot: '#079669' },
    'Ganada':      { fg: '#036b4c', bg: '#ecfdf5', dot: '#079669', border: '#bfe9d6' },
    'Perdida':     { fg: '#c0392b', bg: '#fdecec', dot: '#c0392b' },
};

const PRIO_TONE = {
    'Alta':  { color: '#8a201a', dot: '#c0392b', halo: 'rgba(192,57,43,.12)' },
    'Media': { color: '#7a4d05', dot: '#b8740a', halo: 'rgba(184,116,10,.12)' },
    'Baja':  { color: '#1f6b3a', dot: '#079669', halo: 'rgba(7,150,105,.12)' },
};

const ROL_COLOR = {
    'Gerencia':         '#3f51b5',
    'Marketing':        '#e91e63',
    'Ventas':           '#27ae60',
    'Retail':           '#f57f17',
    'Corporativo':      '#8e44ad',
    'Soporte Técnico':  '#16a085',
    'Logística':        '#1565c0',
    'Finanzas':         '#0f766e',
    'Admin':            '#6b7a8d',
};

// En modo claro: alpha 18% (pastel suave). En modo oscuro: alpha 35% (tinte más visible).
function badgeBg(color, isDark) {
    return color + (isDark ? '38' : '1e');
}

export function TipoBadge({ tipo }) {
    const { isDark } = useTheme();
    const tc = getTypeColor(tipo);
    const bg = isDark ? badgeBg(tc.color, true) : tc.bg;
    const fg = isDark ? '#e3e7ee' : tc.color;
    const border = isDark ? 'transparent' : tc.color + '33';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 7px 2px 6px', height: 20, lineHeight: 1,
            fontSize: 11.5, fontWeight: 500,
            background: bg, color: fg,
            border: `1px solid ${border}`, borderRadius: 4,
            whiteSpace: 'nowrap', maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tipo}</span>
        </span>
    );
}

export function EstadoBadge({ estado }) {
    const t = ESTADO_TONE[estado] || ESTADO_TONE.Pendiente;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 22, padding: '0 8px',
            fontSize: 11.5, fontWeight: 500,
            borderRadius: 4,
            color: t.fg, background: t.bg,
            border: t.border ? `1px solid ${t.border}` : 'none',
            whiteSpace: 'nowrap',
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.dot, flex: 'none' }} />
            {estado}
        </span>
    );
}

export function PrioBadge({ prioridad }) {
    const t = PRIO_TONE[prioridad] || { color: '#5b5d57', dot: '#aaa', halo: 'rgba(0,0,0,.06)' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 500, color: t.color,
            whiteSpace: 'nowrap',
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: t.dot, boxShadow: `0 0 0 3px ${t.halo}`,
                flex: 'none', marginRight: 2,
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
