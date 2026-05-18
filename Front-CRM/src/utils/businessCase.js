export const BC_VERSION = 1;

export const BC_BLOCKS = [
    { key: 'plataforma', label: 'Plataforma SaaS', color: '#4472C4' },
    { key: 'licencias', label: 'Licencias', color: '#CC4125' },
    { key: 'servicios', label: 'Servicios profesionales', color: '#5C8B95' },
    { key: 'personal', label: 'Personal / Servicio', color: '#BF9000' },
];

export const emptyBusinessCase = () => ({
    version: BC_VERSION,
    meses: 12,
    activos: 0,
    descLic: 0,
    descSrv: 0,
    descLicAll: true,
    descSrvAll: true,
    bloques: {
        plataforma: [],
        licencias: [],
        servicios: [],
        personal: [],
    },
    snapshot: {
        costoTotal: 0,
        precioTotal: 0,
        profit: 0,
        margenEf: 0,
    },
});

export const sampleBusinessCase = () => ({
    ...emptyBusinessCase(),
    meses: 12,
    activos: 1000,
    descLic: 20,
    descSrv: 20,
    bloques: {
        plataforma: [],
        licencias: [
            newBusinessCaseLine({ nombre: 'Tecnicos SDesk Nominales', costo: 23, qty: 2, margen: 10, rec: true }),
            newBusinessCaseLine({ nombre: 'IA Generativa / Chatbot', costo: 0, qty: 1, margen: 40 }),
        ],
        servicios: [
            newBusinessCaseLine({ nombre: 'Despliegue de Agentes DISCOVERY', costo: 300, qty: 1, margen: 15 }),
            newBusinessCaseLine({ nombre: 'Parametrizacion de la herramienta', costo: 300, qty: 1, margen: 15 }),
            newBusinessCaseLine({ nombre: 'Capacitacion', costo: 200, qty: 1, margen: 20 }),
        ],
        personal: [
            newBusinessCaseLine({ nombre: 'Membresia', costo: 1405, qty: 1, margen: 0 }),
            newBusinessCaseLine({ nombre: 'Agente Mesa', costo: 150, qty: 12, margen: 10 }),
        ],
    },
});

export function newBusinessCaseLine(overrides = {}) {
    return {
        id: overrides.id || `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        nombre: overrides.nombre || '',
        costo: numberOrZero(overrides.costo),
        qty: numberOrDefault(overrides.qty, 1),
        margen: numberOrZero(overrides.margen),
        rec: !!overrides.rec,
        desc: overrides.desc !== false,
    };
}

export function normalizeBusinessCase(value) {
    const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const base = emptyBusinessCase();
    const bloques = {};
    BC_BLOCKS.forEach(({ key }) => {
        bloques[key] = Array.isArray(src.bloques?.[key])
            ? src.bloques[key].map(newBusinessCaseLine)
            : [];
    });
    return {
        ...base,
        ...src,
        version: BC_VERSION,
        meses: Math.max(1, parseInt(src.meses, 10) || base.meses),
        activos: Math.max(0, parseInt(src.activos, 10) || 0),
        descLic: clampPct(src.descLic),
        descSrv: clampPct(src.descSrv),
        descLicAll: src.descLicAll !== false,
        descSrvAll: src.descSrvAll !== false,
        bloques,
    };
}

export function calculateBusinessCase(input) {
    const state = normalizeBusinessCase(input);
    const meses = state.meses;
    const totals = {};
    BC_BLOCKS.forEach(({ key }) => {
        totals[key] = state.bloques[key].reduce((acc, line) => {
            acc.costo += lineCosto(line, meses);
            acc.precio += linePrecio(line, meses);
            return acc;
        }, { costo: 0, precio: 0 });
    });

    const baseLicDesc = discountableCost(state.bloques.plataforma, state.descLicAll, meses)
        + discountableCost(state.bloques.licencias, state.descLicAll, meses);
    const baseSrvDesc = discountableCost(state.bloques.servicios, state.descSrvAll, meses);
    const dLicMonto = baseLicDesc * (state.descLic / 100);
    const dSrvMonto = baseSrvDesc * (state.descSrv / 100);
    const descTotal = dLicMonto + dSrvMonto;

    const subGlpiCosto = totals.plataforma.costo + totals.licencias.costo + totals.servicios.costo;
    const subGlpiPrecio = totals.plataforma.precio + totals.licencias.precio + totals.servicios.precio;
    const totGlpiCosto = subGlpiCosto - descTotal;
    const totGlpiPrecio = subGlpiPrecio - descTotal;
    const totPersCosto = totals.personal.costo;
    const totPersPrecio = totals.personal.precio;
    const costoTotal = totGlpiCosto + totPersCosto;
    const precioTotal = totGlpiPrecio + totPersPrecio;
    const profit = precioTotal - costoTotal;
    const margenEf = precioTotal > 0 ? (profit / precioTotal) * 100 : 0;

    return {
        ...state,
        totals,
        baseLicDesc,
        baseSrvDesc,
        dLicMonto,
        dSrvMonto,
        descTotal,
        subGlpiCosto,
        subGlpiPrecio,
        totGlpiCosto,
        totGlpiPrecio,
        totPersCosto,
        totPersPrecio,
        snapshot: { costoTotal, precioTotal, profit, margenEf },
    };
}

export function toStoredBusinessCase(input) {
    const calc = calculateBusinessCase(input);
    return {
        version: BC_VERSION,
        meses: calc.meses,
        activos: calc.activos,
        descLic: calc.descLic,
        descSrv: calc.descSrv,
        descLicAll: calc.descLicAll,
        descSrvAll: calc.descSrvAll,
        bloques: calc.bloques,
        snapshot: calc.snapshot,
    };
}

export function isBusinessCaseTipo(tipo) {
    return String(tipo || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim() === 'propuesta';
}

export function lineCosto(line, meses) {
    return numberOrZero(line.costo) * numberOrDefault(line.qty, 1) * (line.rec ? meses : 1);
}

export function linePrecio(line, meses) {
    const costo = lineCosto(line, meses);
    const margen = Math.min(99, Math.max(0, numberOrZero(line.margen)));
    return margen >= 99 ? costo : costo / (1 - margen / 100);
}

export function linePrecioUnit(line) {
    const qty = numberOrDefault(line.qty, 1);
    const precio = linePrecio({ ...line, rec: false }, 1);
    return qty > 0 ? precio / qty : precio;
}

function discountableCost(lines, applyAll, meses) {
    return lines.reduce((total, line) => total + (applyAll || line.desc !== false ? lineCosto(line, meses) : 0), 0);
}

function numberOrZero(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

function numberOrDefault(value, fallback) {
    const n = parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clampPct(value) {
    return Math.min(100, Math.max(0, numberOrZero(value)));
}
