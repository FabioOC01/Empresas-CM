import { TYPE_COLOR, TYPE_ICON } from '../utils/crm';

const ESTADO_STYLE = {
    'Pendiente':   { bg: '#fff3cd', color: '#856404' },
    'En Progreso': { bg: '#cce5ff', color: '#004085' },
    'Completado':  { bg: '#d4edda', color: '#155724' },
    'Cancelado':   { bg: '#f8d7da', color: '#721c24' },
};

const PRIO_COLOR = {
    'Alta':  '#e74c3c',
    'Media': '#e67e22',
    'Baja':  '#27ae60',
};

const ROL_STYLE = {
    'Gerencia':  { bg: '#e8eaf6', color: '#283593' },
    'Marketing': { bg: '#fce4ec', color: '#880e4f' },
    'Ventas':    { bg: '#e8f5e9', color: '#1b5e20' },
    'Retail':    { bg: '#fff8e1', color: '#f57f17' },
};

export function TipoBadge({ tipo }) {
    const s = TYPE_COLOR[tipo] || { bg: '#eee', color: '#333' };
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: s.bg, color: s.color, whiteSpace: 'nowrap',
        }}>
            {TYPE_ICON[tipo] || ''} {tipo}
        </span>
    );
}

export function EstadoBadge({ estado }) {
    const s = ESTADO_STYLE[estado] || { bg: '#eee', color: '#333' };
    return (
        <span style={{
            padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: s.bg, color: s.color,
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
    const s = ROL_STYLE[rol] || { bg: '#eee', color: '#333' };
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
            background: s.bg, color: s.color,
        }}>
            {rol}
        </span>
    );
}
