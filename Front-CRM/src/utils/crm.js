// Portado de crm-data.js — solo helpers puros (sin localStorage)

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const Q_MAP = { '1':[0,1,2], '2':[3,4,5], '3':[6,7,8], '4':[9,10,11] };

export const TIPOS = [
    'Homologación','Visita','Propuesta','Seguimiento','Administrativa',
    'Oportunidad','Cotización','Publicidad','Piezas gráficas',
    'Despacho','Inventario','Facturación','Redes','Soporte',
    'Video','P. Gráficas Externas','P. Gráficas Internas','Actividad','Evento',
];

export const ROLES = ['Admin','Gerencia','Marketing','Ventas','Corporativo','Soporte Técnico','Logística'];

// Tipos de actividad permitidos por rol
// Gerencia: solo visualización, no crea actividades
// Admin: acceso total a todos los tipos
export const ROL_TIPOS = {
    Admin:            null,   // null = todos los tipos, sin restricción
    Ventas:           ['Visita','Propuesta','Seguimiento','Oportunidad','Cotización','Administrativa'],
    Logística:        ['Despacho','Inventario','Facturación'],
    Marketing:        ['Publicidad','Redes','Video','P. Gráficas Externas','P. Gráficas Internas','Actividad','Evento'],
    Gerencia:         [],
    Corporativo:      ['Cotización','Oportunidad','Visita','Homologación'],
    'Soporte Técnico':['Visita','Cotización','Seguimiento','Soporte'],
};

export const ESTADOS = ['Pendiente','En Progreso','Completado','Cancelado'];
export const PRIORIDADES = ['Alta','Media','Baja'];

// Tipos que admiten resultado Ganada/Perdida (aparecen en Comisiones)
export const TIPOS_CON_RESULTADO = [
    'Cotización','Propuesta','Oportunidad','Visita','Homologación','Seguimiento',
];
// Todos los estados posibles (para filtros)
export const TODOS_ESTADOS = ['Pendiente','En Progreso','Completado','Ganada','Perdida','Cancelado'];

export const TYPE_COLOR = {
    'Venta':           { bg: '#d4edda', color: '#155724' },
    'Administrativa':  { bg: '#d1ecf1', color: '#0c5460' },
    'Homologación':    { bg: '#e2d9f3', color: '#5a2d82' },
    'Visita':          { bg: '#fff3cd', color: '#856404' },
    'Propuesta':       { bg: '#fde8d8', color: '#7d3c11' },
    'Seguimiento':     { bg: '#d1f0ec', color: '#0e5144' },
    'Oportunidad':     { bg: '#fce4ec', color: '#880e4f' },
    'Cotización':      { bg: '#e8f5e9', color: '#1b5e20' },
    'Publicidad':      { bg: '#fff8e1', color: '#f57f17' },
    'Piezas gráficas': { bg: '#ede7f6', color: '#4527a0' },
    'Despacho':        { bg: '#e3f2fd', color: '#1565c0' },
    'Inventario':      { bg: '#e8f5e9', color: '#2e7d32' },
    'Facturación':     { bg: '#fff3e0', color: '#e65100' },
    'Redes':           { bg: '#f3e5f5', color: '#6a1b9a' },
    'Soporte':         { bg: '#e8eaf6', color: '#283593' },
    'Video':                 { bg: '#ffebee', color: '#c62828' },
    'P. Gráficas Externas':  { bg: '#e0f2f1', color: '#00695c' },
    'P. Gráficas Internas':  { bg: '#ede7f6', color: '#4527a0' },
    'Actividad':             { bg: '#fff8e1', color: '#ef6c00' },
    'Evento':                { bg: '#fce4ec', color: '#ad1457' },
};

export const TYPE_ICON = {
    'Venta': '💰', 'Homologación': '🏆', 'Visita': '🤝',
    'Propuesta': '📄', 'Seguimiento': '🔄', 'Administrativa': '📋',
    'Oportunidad': '🎯', 'Cotización': '🧾', 'Publicidad': '📢', 'Piezas gráficas': '🎨',
    'Despacho': '📦', 'Inventario': '🗂️', 'Facturación': '💸', 'Redes': '📱', 'Soporte': '🔧',
    'Video': '🎬',
    'P. Gráficas Externas': '🖼️',
    'P. Gráficas Internas': '🎨',
    'Actividad': '🏃',
    'Evento': '🎉',
};

export function fmt(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
}

// Duración real entre ts_en_progreso (o ts_pendiente) y ts_completado (o now si sigue activa)
export function calcDuration(a, now = Date.now()) {
    const start = a.ts_en_progreso || a.ts_pendiente;
    const end   = a.ts_completado;
    if (!start) return 0;
    return Math.floor(((end ? new Date(end) : now) - new Date(start)) / 1000);
}

export function fmtUSD(n, moneda = 'USD') {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(n || 0);
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
        if (filters.vendedorId) {
            const cols = Array.isArray(a.colaboradores) ? a.colaboradores : [];
            const chk = Array.isArray(a.checklist)
                ? a.checklist
                : (typeof a.checklist === 'string' ? (() => { try { const p = JSON.parse(a.checklist); return Array.isArray(p) ? p : []; } catch { return []; } })() : []);
            const enChecklist = chk.some(it => it && it.vendedor_id === filters.vendedorId);
            if (a.vendedor_id !== filters.vendedorId && !cols.includes(filters.vendedorId) && !enChecklist) return false;
        }
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

// Normaliza gastos_operativos que puede llegar como array o como string JSON
export function parseGastos(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
}
