// Portado de crm-data.js — solo helpers puros (sin localStorage)

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const Q_MAP = { '1':[0,1,2], '2':[3,4,5], '3':[6,7,8], '4':[9,10,11] };

export const TIPOS = [
    'Venta','Homologación','Visita','Propuesta','Seguimiento','Administrativa',
    'Oportunidad','Cotización','Publicidad','Piezas gráficas',
];

export const ROLES = ['Gerencia','Marketing','Ventas','Retail'];

export const ESTADOS = ['Pendiente','En Progreso','Completado','Cancelado'];
export const PRIORIDADES = ['Alta','Media','Baja'];

export const TYPE_COLOR = {
    'Venta':          { bg: '#d4edda', color: '#155724' },
    'Administrativa': { bg: '#d1ecf1', color: '#0c5460' },
    'Homologación':   { bg: '#e2d9f3', color: '#5a2d82' },
    'Visita':         { bg: '#fff3cd', color: '#856404' },
    'Propuesta':      { bg: '#fde8d8', color: '#7d3c11' },
    'Seguimiento':    { bg: '#d1f0ec', color: '#0e5144' },
    'Oportunidad':    { bg: '#fce4ec', color: '#880e4f' },
    'Cotización':     { bg: '#e8f5e9', color: '#1b5e20' },
    'Publicidad':     { bg: '#fff8e1', color: '#f57f17' },
    'Piezas gráficas':{ bg: '#ede7f6', color: '#4527a0' },
};

export const TYPE_ICON = {
    'Venta': '💰', 'Homologación': '🏆', 'Visita': '🤝',
    'Propuesta': '📄', 'Seguimiento': '🔄', 'Administrativa': '📋',
    'Oportunidad': '🎯', 'Cotización': '🧾', 'Publicidad': '📢', 'Piezas gráficas': '🎨',
};

export function fmt(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
}

export function fmtUSD(n) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

export function mesIndex(mes) {
    return MESES.indexOf(mes);
}

export function getQ(mes) {
    const idx = mesIndex(mes);
    for (const [q, arr] of Object.entries(Q_MAP)) {
        if (arr.includes(idx)) return q;
    }
    return null;
}

export function filterActs(acts, filters = {}) {
    return acts.filter(a => {
        if (filters.vendedorId && a.vendedor_id !== filters.vendedorId) return false;
        if (filters.mes       && a.mes        !== filters.mes)       return false;
        if (filters.tipo      && a.tipo        !== filters.tipo)      return false;
        if (filters.estado    && a.estado      !== filters.estado)    return false;
        if (filters.prioridad && a.prioridad   !== filters.prioridad) return false;
        if (filters.cliente   && !a.cliente.toLowerCase().includes(filters.cliente.toLowerCase())) return false;
        if (filters.trimestre && Q_MAP[filters.trimestre]) {
            const mesesQ = Q_MAP[filters.trimestre].map(i => MESES[i]);
            if (!mesesQ.includes(a.mes)) return false;
        }
        return true;
    });
}
