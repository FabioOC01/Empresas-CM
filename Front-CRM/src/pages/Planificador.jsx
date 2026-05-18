import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getVendedores, createActividad, updateActividad, deleteActividad } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useRolFilter from '../hooks/useRolFilter';
import { filterActs, fmtUSD, totalGastosOperacion, TIPOS, ESTADOS, TODOS_ESTADOS, PRIORIDADES, TIPOS_CON_RESULTADO, MESES, getTypeColor } from '../utils/crm';
import { canViewAll, isAdminUser, isGerenciaOnly } from '../utils/roles';
import Avatar from '../components/Avatar';
import { TipoBadge, PrioBadge, EstadoBadge } from '../components/Badge';
import ActividadModal from '../components/ActividadModal';
import ComisionModal from '../components/ComisionModal';
import BusinessCaseModal from '../components/BusinessCaseModal';
import usePersistentState from '../hooks/usePersistentState';
import { isBusinessCaseTipo } from '../utils/businessCase';

const KANBAN_COLS = ['Pendiente','En Progreso','Completado','Ganada','Perdida'];
const COL_PIP    = { 'Pendiente':'#8a93a3','En Progreso':'#2862c8','Completado':'#079669','Ganada':'#036b4c','Perdida':'#c0392b' };
const MES_TO_Q   = { Enero:1,Febrero:1,Marzo:1,Abril:2,Mayo:2,Junio:2,Julio:3,Agosto:3,Septiembre:3,Octubre:4,Noviembre:4,Diciembre:4 };
const MES_SHORT  = { Enero:'Ene',Febrero:'Feb',Marzo:'Mar',Abril:'Abr',Mayo:'May',Junio:'Jun',Julio:'Jul',Agosto:'Ago',Septiembre:'Sep',Octubre:'Oct',Noviembre:'Nov',Diciembre:'Dic' };
const SORT_LABELS = {
    text: { asc: 'A → Z',        desc: 'Z → A' },
    num:  { asc: 'Menor a mayor', desc: 'Mayor a menor' },
    date: { asc: 'Más antiguo',   desc: 'Más reciente' },
};
const COL_DEFS = [
    { label: 'Actividad', key: 'actividad', type: 'text', width: 260 },
    { label: 'Tipo',      key: 'tipo',      type: 'text', width: 140 },
    { label: 'Vendedor',  key: 'vendedor',  type: 'text', width: 180 },
    { label: 'Cliente',   key: 'cliente',   type: 'text', width: 210 },
    { label: 'Monto',     key: 'monto',     type: 'num',  width: 130, align: 'right' },
    { label: 'Prioridad', key: 'prioridad', type: 'text', width: 115 },
    { label: 'Estado',    key: 'estado',    type: 'text', width: 150 },
    { label: 'Mes',       key: 'mes',       type: 'text', width: 90 },
    { label: 'Inicio',    key: 'fecha',     type: 'date', width: 120 },
    { label: 'Fin est.',  key: 'fecha_fin', type: 'date', width: 120 },
    { label: '',          key: null,        type: null,   width: 110 },
];

const IcoSearch = (p) => (<svg viewBox="0 0 16 16" width="14" height="14" {...p}><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>);
const IcoX      = (p) => (<svg viewBox="0 0 10 10" width="9" height="9" {...p}><path d="M2 2l6 6M8 2l-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>);
const IcoCaret  = (p) => (<svg viewBox="0 0 10 10" width="9" height="9" {...p}><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoUp     = (p) => (<svg viewBox="0 0 10 10" width="9" height="9" {...p}><path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoDown   = (p) => (<svg viewBox="0 0 10 10" width="9" height="9" {...p}><path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCal    = (p) => (<svg viewBox="0 0 14 14" width="11" height="11" {...p}><rect x="2" y="3" width="10" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M2 6h10M5 2v2M9 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const IcoPlus   = (p) => (<svg viewBox="0 0 10 10" width="10" height="10" {...p}><path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>);
const IcoEdit   = (p) => (<svg viewBox="0 0 14 14" width="13" height="13" {...p}><path d="M10.3 2.4l1.3 1.3-7.6 7.6-2 .7.7-2z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>);
const IcoTrash  = (p) => (<svg viewBox="0 0 14 14" width="13" height="13" {...p}><path d="M3 4h8M5.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4 4l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L10 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCash   = (p) => (<svg viewBox="0 0 14 14" width="13" height="13" {...p}><rect x="1.5" y="3.5" width="11" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>);

function parseArr(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
}

function fmtDateShort(value) {
    if (!value) return null;
    const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear()).slice(2);
    return { dd, mm, yy, day: `${dd}/${mm}`, year: yy };
}

function dateOrderValue(value, fallback) {
    const raw = value || fallback;
    if (!raw) return 0;
    const d = new Date(String(raw).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isoDateOnly(value) {
    return value ? String(value).slice(0, 10) : '';
}

function parseLocalDate(value) {
    if (!value) return null;
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function toInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function weekRange(value) {
    const d = parseLocalDate(value);
    if (!d) return null;
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = addDays(d, diffToMonday);
    const end = addDays(start, 6);
    return { start: toInputDate(start), end: toInputDate(end) };
}

function SortMenu({ col, sort, onPick, onClose, align = 'left' }) {
    const ref = useRef(null);
    useEffect(() => {
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);
    const labels = SORT_LABELS[col.type] || SORT_LABELS.text;
    const active = sort.key === col.key ? sort.dir : null;
    return (
        <div ref={ref} role="menu" className="pln-menu" style={{ [align]: 8 }}>
            <button className={`pln-mi ${active === 'asc' ? 'is-on' : ''}`} onClick={() => { onPick('asc'); onClose(); }}>
                <IcoUp /><span>{labels.asc}</span>
            </button>
            <button className={`pln-mi ${active === 'desc' ? 'is-on' : ''}`} onClick={() => { onPick('desc'); onClose(); }}>
                <IcoDown /><span>{labels.desc}</span>
            </button>
            {active && (
                <>
                    <div className="pln-msep" />
                    <button className="pln-mi pln-mi-muted" onClick={() => { onPick(null); onClose(); }}>
                        <IcoX /><span>Quitar orden</span>
                    </button>
                </>
            )}
        </div>
    );
}

export default function Planificador() {
    const { actividades, setActividades, config } = useActividades();
    const { user } = useAuth();
    const soloLecturaGerencia = isGerenciaOnly(user);
    const puedeEditar = !soloLecturaGerencia;
    const puedeEliminar = isAdminUser(user);
    const puedeFiltrar  = canViewAll(user);
    const esActividadBloqueada = (actividad) => actividad?.estado === 'Ganada' && !isAdminUser(user);
    const tk = useTheme();
    const moneda     = config?.moneda || 'USD';
    const tipos      = config?.tipos_actividad || TIPOS;
    const tasa_sunat = parseFloat(config?.tasa_sunat) || 0;

    const miniCalc = (a) => {
        const fact = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
        const gastos = totalGastosOperacion(a);
        const rentabilidadBruta = fact - gastos;
        const sunat = rentabilidadBruta * tasa_sunat;
        const rentabilidad = rentabilidadBruta - sunat;
        const margen = fact > 0 ? (rentabilidad / fact) * 100 : 0;
        return { util: rentabilidad, margen };
    };

    const vendedorForzado = useRolFilter();
    const [searchParams] = useSearchParams();
    const [vendedores, setVendedores] = useState([]);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
    const [view, setView] = usePersistentState('crm_planificador_view', searchParams.get('view') === 'kanban' ? 'kanban' : 'tabla');
    const [collapsedCols, setCollapsedCols] = useState(new Set(['Ganada','Perdida']));
    const toggleCol = (col) => setCollapsedCols(s => {
        const n = new Set(s);
        if (n.has(col)) n.delete(col); else n.add(col);
        return n;
    });
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [confirmId, setConfirmId] = useState(null);
    const [calcModal, setCalcModal] = useState({ open:false, actividad:null });
    const [bcModal, setBcModal] = useState({ open:false, actividad:null });
    const MES_ACTUAL = MESES[new Date().getMonth()];
    const Q_ACTUAL = String(Math.floor(new Date().getMonth() / 3) + 1);
    const DEFAULT_FILTERS = { vendedorId:'', trimestre: Q_ACTUAL, mes:'', dia:'', semana:'', tipo:'', estado:'', prioridad:'', buscar:'' };
    const [filters, setFilters] = usePersistentState('crm_planificador_filters', DEFAULT_FILTERS);
    const [sort, setSort] = usePersistentState('crm_planificador_sort', { key:'fecha', dir:'desc' });
    const [dragId, setDragId] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);

    useEffect(() => { getVendedores().then(setVendedores); }, []);
    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'kanban' || viewParam === 'tabla') setView(viewParam);
    }, [searchParams, setView]);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 760);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    useEffect(() => {
        const handler = (e) => {
            if (puedeEditar && e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))
                setModal({ open: true, actividad: null });
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [puedeEditar]);

    const norm = (value) => String(value || '').toLowerCase();
    const vendedorNombre = (a) => vendedores.find(v => v.id === a.vendedor_id)?.nombre || '';
    const matchText = (value, query) => norm(value).includes(norm(query));

    const dateFilterActive = !!(filters.dia || filters.semana);
    const baseFiltered = filterActs(actividades, {
        vendedorId: vendedorForzado || filters.vendedorId || undefined,
        trimestre:  dateFilterActive ? undefined : filters.trimestre  || undefined,
        mes:        dateFilterActive ? undefined : filters.mes        || undefined,
        tipo:       filters.tipo       || undefined,
        estado:     filters.estado     || undefined,
        prioridad:  filters.prioridad  || undefined,
    });

    let filtered = baseFiltered;
    if (filters.dia) {
        filtered = filtered.filter(a => isoDateOnly(a.fecha) === filters.dia);
    } else if (filters.semana) {
        const range = weekRange(filters.semana);
        if (range) {
            filtered = filtered.filter(a => {
                const fecha = isoDateOnly(a.fecha);
                return fecha && fecha >= range.start && fecha <= range.end;
            });
        }
    }
    if (!dateFilterActive && filters.mes === MES_ACTUAL) {
        const idxActual = MESES.indexOf(MES_ACTUAL);
        const arrastradas = filterActs(actividades, {
            vendedorId: vendedorForzado || filters.vendedorId || undefined,
            tipo:       filters.tipo       || undefined,
            prioridad:  filters.prioridad  || undefined,
        }).filter(a => a.estado === 'En Progreso' && MESES.indexOf(a.mes) < idxActual && MESES.indexOf(a.mes) >= 0);
        const ids = new Set(baseFiltered.map(a => a.id));
        filtered = [...baseFiltered, ...arrastradas.filter(a => !ids.has(a.id))];
    }
    if (filters.buscar) {
        filtered = filtered.filter(a => {
            const vendedor = vendedorNombre(a);
            return [a.nombre, a.cliente, a.notas, a.tipo, a.estado, a.prioridad, a.mes, vendedor]
                .some(value => matchText(value, filters.buscar));
        });
    }
    const sortValue = (a, key) => {
        if (key === 'actividad') return norm(a.nombre);
        if (key === 'tipo') return norm(a.tipo);
        if (key === 'vendedor') return norm(vendedorNombre(a));
        if (key === 'cliente') return norm(a.cliente);
        if (key === 'monto') return Number(a.monto) || 0;
        if (key === 'prioridad') return norm(a.prioridad);
        if (key === 'estado') return norm(a.estado);
        if (key === 'mes') return MESES.indexOf(a.mes);
        if (key === 'fecha_fin') return dateOrderValue(a.fecha_fin, null);
        return dateOrderValue(a.fecha, a.created_at);
    };
    filtered = [...filtered].sort((a, b) => {
        if (!sort.key) return 0;
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        const cmp = typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), 'es', { sensitivity:'base' });
        return sort.dir === 'asc' ? cmp : -cmp;
    });
    const setF = (k, v) => setFilters(f => {
        const next = { ...f, [k]: v };
        if ((k === 'dia' || k === 'semana') && v) {
            next.mes = '';
            next.trimestre = '';
            if (k === 'dia') next.semana = '';
            if (k === 'semana') next.dia = '';
        }
        if ((k === 'mes' || k === 'trimestre') && v) {
            next.dia = '';
            next.semana = '';
        }
        return next;
    });
    const toggleSort = (col) => {
        setSort((current) => {
            if (current.key === col.key) {
                return { key: col.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
            }
            return { key: col.key, dir: col.type === 'text' ? 'asc' : 'desc' };
        });
    };

    const handleSave = async (data) => {
        if (!puedeEditar) return null;
        const current = data.id ? actividades.find(a => a.id === data.id) : null;
        if (esActividadBloqueada(current)) return null;
        if (data.id && actividades.find(a => a.id === data.id)) {
            const updated = await updateActividad(data.id, data);
            setActividades(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
            return updated;
        } else {
            const created = await createActividad(data);
            setActividades(prev => prev.some(a => a.id === created.id) ? prev.map(a => a.id === created.id ? { ...a, ...created } : a) : [created, ...prev]);
            return created;
        }
    };

    const handleDelete = async (id) => {
        if (!puedeEliminar) return;
        await deleteActividad(id);
        setConfirmId(null);
    };

    const changeEstado = async (id, estado) => {
        if (!puedeEditar) return;
        const act = actividades.find(a => a.id === id);
        if (esActividadBloqueada(act)) return;
        const updated = await updateActividad(id, { estado });
        setActividades(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    };

    const handleDrop = async (col) => {
        const id = dragId;
        setDragId(null);
        setDragOverCol(null);
        if (!puedeEditar) return;
        if (!id) return;
        const act = actividades.find(a => a.id === id);
        if (!act || esActividadBloqueada(act) || act.estado === col) return;
        const updated = await updateActividad(id, { estado: col });
        setActividades(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    };

    const newWithEstado = (estado) => {
        if (!puedeEditar) return;
        setModal({ open:true, actividad: { estado } });
    };

    const totalMonto = filtered.reduce((s,a) => s + Number(a.monto || 0), 0);
    const completedCount = filtered.filter(a => a.estado === 'Completado' || a.estado === 'Ganada').length;
    const progressCount  = filtered.filter(a => a.estado === 'En Progreso').length;
    const pendingCount   = filtered.filter(a => a.estado === 'Pendiente').length;
    const highPriorityCount = filtered.filter(a => a.prioridad === 'Alta' && a.estado !== 'Completado' && a.estado !== 'Ganada').length;
    const hasActiveFilters = filters.vendedorId || filters.tipo || filters.estado || filters.prioridad || filters.buscar || filters.trimestre !== Q_ACTUAL || filters.mes || filters.dia || filters.semana;
    const sortedColLabel = sort.key ? (COL_DEFS.find(c => c.key === sort.key)?.label || sort.key) : '';
    const calcActividadActual = actividades.find(a => a.id === calcModal.actividad?.id) || calcModal.actividad;
    const bcActividadActual = actividades.find(a => a.id === bcModal.actividad?.id) || bcModal.actividad;

    return (
        <div className="pln-root">
            <style>{`
                .pln-root {
                    --pln-bg:       #f7f7f5;
                    --pln-surface:  #ffffff;
                    --pln-surface-2:#fbfbf8;
                    --pln-line:     #ebebe7;
                    --pln-line-2:   #f1f1ed;
                    --pln-line-3:   #e3e3df;
                    --pln-ink:      #161614;
                    --pln-ink-2:    #4a4a45;
                    --pln-ink-3:    #8a8a82;
                    --pln-ink-4:    #b6b6ad;
                    --pln-hover:    #f6f6f3;
                    --pln-green:    #079669;
                    --pln-green-2:  #036b4c;
                    --pln-green-bg: #ecfdf5;
                    --pln-green-line:#bfe9d6;
                    --pln-red:      #c0392b;
                    --pln-red-bg:   #fdecec;
                    --pln-amber:    #b8740a;
                    --pln-amber-bg: #fdf3e0;
                    --pln-blue:     #2862c8;
                    --pln-blue-bg:  #e8f0fc;
                    --pln-row-h:    40px;
                    --pln-radius:   10px;
                    color: var(--pln-ink);
                    font-family: Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
                    font-size: 13px;
                    line-height: 1.4;
                    min-width: 0;
                }
                [data-theme="dark"] .pln-root {
                    --pln-bg: ${tk.bg};
                    --pln-surface: ${tk.card};
                    --pln-surface-2: ${tk.card2};
                    --pln-line: ${tk.bdr};
                    --pln-line-2: ${tk.bdr};
                    --pln-line-3: ${tk.bdr};
                    --pln-ink: ${tk.txt};
                    --pln-ink-2: ${tk.txt2};
                    --pln-ink-3: ${tk.txt3};
                    --pln-ink-4: ${tk.txt3};
                    --pln-hover: ${tk.card2};
                    --pln-surface-2: ${tk.card2};
                    --pln-green-bg: rgba(16,185,129,.13);
                    --pln-green-line: rgba(16,185,129,.38);
                    --pln-green-2: #34d399;
                    --pln-amber: #f6ad55;
                    --pln-blue: #7aa2ff;
                }
                .pln-root *, .pln-root *::before, .pln-root *::after { box-sizing: border-box; }

                /* ============ TOP ============ */
                .pln-top {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 18px;
                    align-items: center;
                    margin-bottom: 14px;
                }
                .pln-tabs {
                    display: inline-flex;
                    padding: 3px;
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line);
                    border-radius: 8px;
                    gap: 2px;
                }
                .pln-tab {
                    appearance: none; border: none; background: transparent;
                    font: inherit; font-size: 12.5px; font-weight: 500;
                    color: var(--pln-ink-2);
                    height: 28px; padding: 0 12px;
                    display: inline-flex; align-items: center; gap: 6px;
                    border-radius: 6px; cursor: pointer;
                    transition: background .12s, color .12s;
                }
                .pln-tab:hover { color: var(--pln-ink); }
                .pln-tab.is-on { background: var(--pln-ink); color: #fff; }
                .pln-tab.is-on .pln-tab-dot { background: var(--pln-green); }
                .pln-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pln-ink-4); }
                .pln-view-anim {
                    animation: plnViewIn .24s cubic-bezier(.22,1,.36,1);
                    transform-origin: top center;
                }
                @keyframes plnViewIn {
                    from { opacity: 0; transform: translateY(8px) scale(.992); filter: blur(1px); }
                    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                }
                [data-theme="dark"] .pln-tabs {
                    background: rgba(15, 23, 42, .72);
                    border-color: rgba(92, 115, 146, .32);
                }
                [data-theme="dark"] .pln-tab {
                    color: #a9b8ce;
                }
                [data-theme="dark"] .pln-tab:hover {
                    background: rgba(148, 163, 184, .10);
                    color: #e5edf8;
                }
                [data-theme="dark"] .pln-tab.is-on {
                    background: rgba(16, 185, 129, .18);
                    color: #ecfdf5;
                    box-shadow: 0 0 0 1px rgba(52, 211, 153, .42) inset;
                }
                [data-theme="dark"] .pln-tab-dot {
                    background: #71829a;
                    box-shadow: 0 0 0 2px rgba(148, 163, 184, .10);
                }
                [data-theme="dark"] .pln-tab.is-on .pln-tab-dot {
                    background: #34d399;
                    box-shadow: 0 0 0 2px rgba(52, 211, 153, .18);
                }

                /* ============ KPIs ============ */
                .pln-kpis {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 10px;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    overflow: visible;
                }
                .pln-kpi {
                    --kpi-accent: var(--pln-green);
                    --kpi-bg: rgba(7, 150, 105, .08);
                    padding: 12px 14px 11px;
                    display: flex; flex-direction: column; gap: 2px;
                    position: relative; min-width: 0;
                    background: linear-gradient(155deg, var(--kpi-bg) 0%, var(--pln-surface) 42%, var(--pln-surface) 100%);
                    border: 1px solid color-mix(in srgb, var(--kpi-accent) 24%, var(--pln-line));
                    border-radius: 9px;
                    box-shadow: 0 10px 24px -20px rgba(15, 23, 42, .6), 0 1px 0 rgba(255,255,255,.8) inset;
                    overflow: hidden;
                }
                .pln-kpi[data-tone="green"] { --kpi-accent: var(--pln-green); --kpi-bg: rgba(7,150,105,.10); }
                .pln-kpi[data-tone="blue"]  { --kpi-accent: var(--pln-blue);  --kpi-bg: rgba(40,98,200,.10); }
                .pln-kpi[data-tone="red"]   { --kpi-accent: var(--pln-red);   --kpi-bg: rgba(192,57,43,.10); }
                .pln-kpi[data-tone="amber"] { --kpi-accent: var(--pln-amber); --kpi-bg: rgba(184,120,0,.12); }
                .pln-kpi-label {
                    font-size: 10.5px; font-weight: 800;
                    color: var(--pln-ink-2);
                    text-transform: uppercase; letter-spacing: .05em;
                    display: flex; align-items: center; gap: 9px;
                    padding-top: 2px;
                    white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;
                }
                .pln-kpi-label::before {
                    content: ""; width: 7px; height: 7px; border-radius: 50%;
                    background: var(--pln-ink-4); flex: none;
                    margin-left: 4px;
                    box-shadow: 0 0 0 2px color-mix(in srgb, var(--kpi-accent) 16%, transparent);
                    animation: plnDotPulse 2.4s ease-in-out infinite;
                }
                @keyframes plnDotPulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 0 2px color-mix(in srgb, var(--kpi-accent) 16%, transparent);
                    }
                    50% {
                        transform: scale(1.18);
                        box-shadow: 0 0 0 5px color-mix(in srgb, var(--kpi-accent) 8%, transparent);
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .pln-kpi-label::before,
                    .pln-view-anim,
                    .pln-qpill.is-on { animation: none; }
                    .pln-qpill { transition: none; }
                }
                .pln-kpi[data-tone="green"] .pln-kpi-label::before { background: var(--pln-green); }
                .pln-kpi[data-tone="blue"]  .pln-kpi-label::before { background: var(--pln-blue); }
                .pln-kpi[data-tone="red"]   .pln-kpi-label::before { background: var(--pln-red); }
                .pln-kpi[data-tone="amber"] .pln-kpi-label::before { background: var(--pln-amber); }
                .pln-kpi-val {
                    font-size: 21px; font-weight: 850;
                    color: var(--pln-ink); letter-spacing: -.01em;
                    font-variant-numeric: tabular-nums;
                    line-height: 1.2; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;
                }
                .pln-kpi-val .unit {
                    font-size: 11px; font-weight: 500;
                    color: var(--pln-ink-3); margin-right: 3px;
                    letter-spacing: .02em;
                }
                .pln-kpi-sub { font-size: 11.5px; color: var(--kpi-accent); font-weight: 800; font-variant-numeric: tabular-nums; }
                [data-theme="dark"] .pln-kpi {
                    background: linear-gradient(155deg, color-mix(in srgb, var(--kpi-accent) 20%, transparent) 0%, #121f33 45%, #111c2d 100%);
                    border-color: color-mix(in srgb, var(--kpi-accent) 36%, rgba(148,163,184,.28));
                    box-shadow: 0 14px 30px -20px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.06) inset;
                }
                [data-theme="dark"] .pln-kpi-label { color: #d4e0ef; }
                [data-theme="dark"] .pln-kpi-val { color: #f3f8ff; }

                /* ============ PRIMARY ============ */
                .pln-primary {
                    appearance: none;
                    position: relative;
                    border: 1px solid #036445;
                    background: linear-gradient(180deg, #0aaa78 0%, #058256 100%);
                    color: #fff;
                    font: inherit; font-size: 13px; font-weight: 600;
                    letter-spacing: -.005em;
                    height: 38px; padding: 0 16px 0 14px;
                    border-radius: 9px;
                    cursor: pointer;
                    display: inline-flex; align-items: center; gap: 8px;
                    box-shadow:
                      0 1px 0 rgba(255,255,255,.18) inset,
                      0 -1px 0 rgba(0,0,0,.12) inset,
                      0 1px 2px rgba(3,107,76,.25),
                      0 6px 14px -4px rgba(7,150,105,.45);
                    transition: transform .08s, box-shadow .15s, filter .15s;
                    overflow: hidden; white-space: nowrap; flex-shrink: 0;
                }
                .pln-primary::before {
                    content: "";
                    position: absolute; inset: 0;
                    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%);
                    transform: translateX(-130%);
                    transition: transform .55s ease;
                    pointer-events: none;
                }
                .pln-primary:hover { filter: brightness(1.04); box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 -1px 0 rgba(0,0,0,.12) inset, 0 1px 2px rgba(3,107,76,.3), 0 10px 20px -4px rgba(7,150,105,.55); }
                .pln-primary:hover::before { transform: translateX(130%); }
                .pln-primary:active { transform: translateY(1px); }
                .pln-primary .pln-pico {
                    width: 18px; height: 18px;
                    display: inline-grid; place-items: center;
                    background: rgba(255,255,255,.16);
                    border-radius: 5px;
                    box-shadow: 0 0 0 1px rgba(255,255,255,.22) inset;
                }
                .pln-primary .pln-kbd {
                    display: inline-grid; place-items: center;
                    margin-left: 4px;
                    height: 18px; min-width: 18px; padding: 0 4px;
                    font-size: 10.5px; font-weight: 600;
                    color: rgba(255,255,255,.78);
                    background: rgba(0,0,0,.18);
                    border: 1px solid rgba(255,255,255,.18);
                    border-radius: 4px;
                    letter-spacing: .02em;
                }

                /* ============ FILTERS ============ */
                .pln-filters {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 12px;
                    min-height: 56px;
                    background: linear-gradient(180deg, #ffffff 0%, #f4f6f3 100%);
                    border: 1px solid var(--pln-line-2);
                    border-radius: 12px 12px 0 0;
                    border-bottom-color: var(--pln-line-3);
                    box-shadow: 0 10px 24px -20px rgba(15, 23, 42, .45), 0 1px 0 rgba(255,255,255,.8) inset;
                    flex-wrap: wrap;
                    position: relative;
                    z-index: 4;
                }
                .pln-qpills {
                    display: inline-flex;
                    background: #eef1ed;
                    border: 1px solid #d8ded6;
                    border-radius: 9px;
                    padding: 3px;
                    box-shadow: inset 0 1px 2px rgba(15,23,42,.05);
                }
                .pln-qpill {
                    appearance: none; border: none; background: transparent;
                    font: inherit; font-size: 12px; font-weight: 500;
                    color: var(--pln-ink-3);
                    height: 28px; min-width: 34px; padding: 0 9px;
                    border-radius: 7px; cursor: pointer;
                    transition: transform .16s ease, background .16s ease, color .16s ease, box-shadow .16s ease;
                }
                .pln-qpill:hover { color: var(--pln-ink); transform: translateY(-1px); }
                .pln-qpill.is-on {
                    background: #ffffff;
                    color: var(--pln-green-2);
                    box-shadow: 0 0 0 1px rgba(7,150,105,.35), 0 2px 6px rgba(7,150,105,.14);
                    font-weight: 800;
                    animation: plnQuarterPop .26s cubic-bezier(.22,1,.36,1);
                }
                @keyframes plnQuarterPop {
                    0% { transform: scale(.94); }
                    60% { transform: scale(1.06); }
                    100% { transform: scale(1); }
                }
                [data-theme="dark"] .pln-filters {
                    background: linear-gradient(180deg, #1c2c46 0%, #132238 100%);
                    border-color: rgba(148, 163, 184, .46);
                    border-bottom-color: rgba(148, 163, 184, .58);
                    box-shadow: 0 14px 32px -18px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.08) inset;
                }
                [data-theme="dark"] .pln-qpills {
                    background: rgba(2, 8, 23, .72);
                    border-color: rgba(148, 163, 184, .34);
                    box-shadow: inset 0 1px 3px rgba(0,0,0,.32);
                }
                [data-theme="dark"] .pln-qpill {
                    color: #b8c7dc;
                    font-weight: 700;
                }
                [data-theme="dark"] .pln-qpill:hover {
                    background: rgba(148, 163, 184, .14);
                    color: #e5edf8;
                }
                [data-theme="dark"] .pln-qpill.is-on {
                    background: rgba(16, 185, 129, .24);
                    color: #8ff4c9;
                    box-shadow: 0 0 0 1px rgba(52, 211, 153, .62), 0 4px 12px rgba(16,185,129,.16);
                }
                .pln-search {
                    position: relative;
                    flex: 0 1 260px;
                    max-width: 185px;
                    min-width: 180px;
                }
                .pln-search input {
                    width: 100%; height: 36px;
                    padding: 0 28px 0 30px;
                    font: inherit; font-size: 13px;
                    color: var(--pln-ink);
                    background: #ffffff;
                    border: 1px solid #d8ded6;
                    border-radius: 9px;
                    outline: none;
                    transition: border-color .12s, box-shadow .12s, background .12s;
                    box-shadow: 0 1px 2px rgba(15,23,42,.04);
                }
                .pln-search input::placeholder { color: var(--pln-ink-3); }
                .pln-search input:focus {
                    background: var(--pln-surface);
                    border-color: var(--pln-green);
                    box-shadow: 0 0 0 3px rgba(7,150,105,.12);
                }
                [data-theme="dark"] .pln-search input {
                    background: #0b1628;
                    border-color: rgba(148, 163, 184, .38);
                    color: #eef5ff;
                    box-shadow: 0 1px 0 rgba(255,255,255,.04), 0 2px 8px rgba(0,0,0,.16);
                }
                [data-theme="dark"] .pln-search input::placeholder {
                    color: #a4b4ca;
                    opacity: 1;
                }
                [data-theme="dark"] .pln-search input:focus {
                    background: #10203a;
                    border-color: rgba(52, 211, 153, .78);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, .22), 0 4px 14px rgba(0,0,0,.24);
                }
                .pln-search .pln-si {
                    position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
                    color: var(--pln-ink-3); pointer-events: none;
                }
                [data-theme="dark"] .pln-search .pln-si {
                    color: #6f83a0;
                }
                .pln-search .pln-sx {
                    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
                    width: 18px; height: 18px;
                    border: none; background: transparent;
                    color: var(--pln-ink-3); border-radius: 4px;
                    display: grid; place-items: center; cursor: pointer;
                }
                .pln-search .pln-sx:hover { background: var(--pln-hover); color: var(--pln-ink); }
                .pln-filt-group {
                    margin-left: auto;
                    display: inline-flex; gap: 6px; align-items: center;
                    flex-wrap: wrap;
                }
                .pln-sel { position: relative; }
                .pln-sel select,
                .pln-sel input {
                    appearance: none;
                    height: 36px; padding: 0 30px 0 12px;
                    font: inherit; font-size: 13px; font-weight: 700;
                    color: var(--pln-ink-2);
                    background: #ffffff;
                    border: 1px solid #cfd7cd;
                    border-radius: 9px;
                    cursor: pointer; outline: none;
                    box-shadow: 0 1px 2px rgba(15,23,42,.04);
                }
                .pln-sel input { min-width: 140px; padding-right: 10px; }
                .pln-date {
                    height: 36px;
                    min-width: 168px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 9px 0 11px;
                    background: #ffffff;
                    border: 1px solid #cfd7cd;
                    border-radius: 9px;
                    box-shadow: 0 1px 2px rgba(15,23,42,.04);
                }
                .pln-date .pln-date-lbl {
                    font-size: 11px;
                    line-height: 1;
                    font-weight: 800;
                    color: var(--pln-ink-3);
                    text-transform: uppercase;
                }
                .pln-date input {
                    min-width: 0;
                    width: 118px;
                    height: 32px;
                    padding: 0;
                    border: none;
                    background: transparent;
                    box-shadow: none;
                }
                .pln-date:hover { border-color: var(--pln-line-3); }
                .pln-date.has-val {
                    background: #f7fffb;
                    border-color: rgba(7,150,105,.45);
                    box-shadow: 0 0 0 1px rgba(7,150,105,.12), 0 2px 8px rgba(7,150,105,.10);
                }
                .pln-date.has-val .pln-date-lbl { color: var(--pln-green-2); }
                .pln-date:focus-within {
                    border-color: var(--pln-green);
                    box-shadow: 0 0 0 3px rgba(7,150,105,.12);
                }
                .pln-date input:focus { box-shadow: none; }
                .pln-sel select:hover,
                .pln-sel input:hover { border-color: var(--pln-line-3); }
                .pln-sel.has-val select,
                .pln-sel.has-val input {
                    color: var(--pln-ink);
                    background: #f7fffb;
                    border-color: rgba(7,150,105,.45);
                    box-shadow: 0 0 0 1px rgba(7,150,105,.12), 0 2px 8px rgba(7,150,105,.10);
                }
                .pln-sel select:focus,
                .pln-sel input:focus { border-color: var(--pln-green); box-shadow: 0 0 0 3px rgba(7,150,105,.12); }
                .pln-sel .pln-car {
                    position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
                    color: var(--pln-ink-3); pointer-events: none;
                }
                [data-theme="dark"] .pln-sel select,
                [data-theme="dark"] .pln-sel input {
                    background: #0b1628;
                    border-color: rgba(148, 163, 184, .38);
                    color: #d4e0ef;
                    box-shadow: 0 1px 0 rgba(255,255,255,.04), 0 2px 8px rgba(0,0,0,.16);
                }
                [data-theme="dark"] .pln-sel select:hover,
                [data-theme="dark"] .pln-sel input:hover {
                    background: #10203a;
                    border-color: rgba(181, 198, 221, .56);
                    color: #f3f8ff;
                }
                [data-theme="dark"] .pln-sel.has-val select,
                [data-theme="dark"] .pln-sel.has-val input {
                    background: rgba(16, 185, 129, .13);
                    border-color: rgba(52, 211, 153, .62);
                    color: #eafff7;
                    box-shadow: 0 0 0 1px rgba(52,211,153,.16), 0 4px 12px rgba(16,185,129,.10);
                }
                [data-theme="dark"] .pln-sel select:focus,
                [data-theme="dark"] .pln-sel input:focus {
                    border-color: rgba(52, 211, 153, .62);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, .16);
                }
                [data-theme="dark"] .pln-date {
                    background: #0b1628;
                    border-color: rgba(148, 163, 184, .38);
                    box-shadow: 0 1px 0 rgba(255,255,255,.04), 0 2px 8px rgba(0,0,0,.16);
                }
                [data-theme="dark"] .pln-date:hover {
                    background: #10203a;
                    border-color: rgba(181, 198, 221, .56);
                }
                [data-theme="dark"] .pln-date.has-val {
                    background: rgba(16, 185, 129, .13);
                    border-color: rgba(52, 211, 153, .62);
                    box-shadow: 0 0 0 1px rgba(52,211,153,.16), 0 4px 12px rgba(16,185,129,.10);
                }
                [data-theme="dark"] .pln-date:focus-within {
                    border-color: rgba(52, 211, 153, .62);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, .16);
                }
                [data-theme="dark"] .pln-date input {
                    color: #d4e0ef;
                }
                [data-theme="dark"] .pln-sel .pln-car {
                    color: #8296b0;
                }
                .pln-clear {
                    appearance: none;
                    width: 36px; height: 36px; padding: 0;
                    display: inline-grid; place-items: center;
                    color: var(--pln-ink-2);
                    background: rgba(15,23,42,.035);
                    border: 1px solid var(--pln-line-2);
                    border-radius: 9px;
                    cursor: pointer;
                }
                .pln-clear:hover { color: var(--pln-ink); background: #fff; border-color: var(--pln-line-3); }
                [data-theme="dark"] .pln-clear {
                    color: #d8e4f4;
                    background: rgba(148, 163, 184, .11);
                    border-color: rgba(148, 163, 184, .22);
                }
                [data-theme="dark"] .pln-clear:hover {
                    background: rgba(148, 163, 184, .18);
                    color: #eef5ff;
                    border-color: rgba(181, 198, 221, .36);
                }

                /* ============ TABLE ============ */
                .pln-twrap {
                    overflow-x: auto;
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line);
                    border-radius: 0;
                }
                .pln-twrap.has-meta { border-bottom: none; }
                table.pln-t {
                    width: 100%;
                    min-width: 1320px;
                    table-layout: fixed;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-variant-numeric: tabular-nums;
                }
                th.pln-h {
                    position: sticky; top: 0; z-index: 3;
                    background: #f7f8f5;
                    border-bottom: 1px solid #d7ded4;
                    text-align: left;
                    padding: 0;
                    height: 38px;
                    font-weight: 800;
                    font-size: 11.5px;
                    letter-spacing: .035em;
                    color: var(--pln-ink-2);
                    text-transform: uppercase;
                }
                th.pln-h + th.pln-h { border-left: 1px solid var(--pln-line-2); }
                th.pln-h.sorted { background: var(--pln-green-bg); color: var(--pln-green-2); }
                th.pln-h-right { text-align: right; }
                [data-theme="dark"] th.pln-h {
                    background: #1a2a43;
                    color: #d2deee;
                    font-weight: 800;
                    border-bottom-color: rgba(148, 163, 184, .46);
                }
                [data-theme="dark"] th.pln-h + th.pln-h {
                    border-left-color: rgba(92, 115, 146, .24);
                }
                [data-theme="dark"] th.pln-h.sorted {
                    background: rgba(16, 185, 129, .13);
                    color: #6ee7b7;
                }

                .pln-hbtn {
                    display: flex; align-items: center; justify-content: space-between; gap: 6px;
                    position: relative;
                    width: 100%; height: 100%;
                    padding: 0 10px;
                    font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit;
                    background: transparent; border: none; cursor: pointer;
                }
                .pln-hbtn:hover { background: #eef2ed; color: var(--pln-ink); }
                th.pln-h.sorted .pln-hbtn:hover { background: #def4e8; }
                [data-theme="dark"] .pln-hbtn:hover {
                    background: rgba(148, 163, 184, .10);
                }
                [data-theme="dark"] th.pln-h.sorted .pln-hbtn:hover {
                    background: rgba(16, 185, 129, .18);
                }
                .pln-hbtn .lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pln-hbtn .ind {
                    opacity: 0; color: var(--pln-ink-3);
                    transition: opacity .12s; display: grid; place-items: center;
                }
                th.pln-h:hover .ind, th.pln-h.sorted .ind { opacity: 1; }
                th.pln-h.sorted .ind { color: var(--pln-green-2); }
                th.pln-h-right .pln-hbtn { flex-direction: row-reverse; }

                /* sort menu */
                .pln-menu {
                    position: absolute; top: 100%;
                    margin-top: 2px;
                    min-width: 180px;
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line-3);
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(20,20,18,.10), 0 1px 2px rgba(20,20,18,.06);
                    padding: 4px;
                    z-index: 30;
                }
                .pln-mi {
                    display: flex; align-items: center; gap: 8px;
                    width: 100%;
                    padding: 7px 9px;
                    background: transparent; border: none;
                    font: inherit; font-size: 12.5px; color: var(--pln-ink);
                    text-align: left; text-transform: none; letter-spacing: 0;
                    border-radius: 5px; cursor: pointer;
                }
                .pln-mi:hover { background: var(--pln-hover); }
                .pln-mi svg { color: var(--pln-ink-3); }
                .pln-mi.is-on { background: var(--pln-green-bg); color: var(--pln-green-2); }
                .pln-mi.is-on svg { color: var(--pln-green-2); }
                .pln-mi-muted { color: var(--pln-ink-3); }
                .pln-msep { height: 1px; background: var(--pln-line-2); margin: 4px 2px; }

                /* rows */
                tr.pln-r { transition: background .08s; cursor: pointer; }
                tr.pln-r:hover { background: var(--pln-hover); }
                tr.pln-r:hover .pln-acts { opacity: 1; }
                td.pln-c {
                    padding: 0 12px;
                    height: var(--pln-row-h);
                    border-bottom: 1px solid var(--pln-line-2);
                    vertical-align: middle;
                    color: var(--pln-ink);
                    font-size: 12.5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    position: relative;
                }
                td.pln-c.right { text-align: right; }
                td.pln-c.first { padding-left: 18px; }
                td.pln-c.first::before {
                    content: "";
                    position: absolute; left: 0; top: 5px; bottom: 5px;
                    width: 3px; border-radius: 0 2px 2px 0;
                    background: var(--pln-ink-4);
                }
                tr[data-pr="Alta"]  td.pln-c.first::before { background: var(--pln-red); }
                tr[data-pr="Media"] td.pln-c.first::before { background: var(--pln-amber); }
                tr[data-pr="Baja"]  td.pln-c.first::before { background: var(--pln-green); }
                .pln-act { display: flex; flex-direction: column; gap: 1px; min-width: 0; max-width: 100%; line-height: 1.1; }
                .pln-act-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    max-width: 100%;
                }
                .pln-act .t1 {
                    font-weight: 600; color: var(--pln-ink);
                    display: block; min-width: 0; max-width: 100%;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .pln-act .t2 {
                    display: block; min-width: 0; max-width: 100%;
                    font-size: 10.5px; line-height: 1.05; color: var(--pln-ink-2);
                    font-weight: 400;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                [data-theme="dark"] .pln-act .t1 { color: #d8e0ea; font-weight: 600; }
                [data-theme="dark"] .pln-act .t2 { color: #8da0ba; }
                [data-theme="dark"] .pln-ven .name { color: #c7d2e2; }
                [data-theme="dark"] .pln-mon.pos { color: #10b981; }

                .pln-ven { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
                .pln-ven .name {
                    font-size: 12.5px; color: var(--pln-ink);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .pln-stack { display: inline-flex; align-items: center; flex: none; }
                .pln-stack > * { margin-left: -7px; box-shadow: 0 0 0 1.5px var(--pln-surface), 0 0 0 2px var(--pln-line-3); border-radius: 50%; }
                .pln-stack > *:first-child { margin-left: 0; }

                .pln-mon {
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                    color: var(--pln-ink);
                    font-size: 12.5px;
                    letter-spacing: -.005em;
                }
                .pln-mon.zero { color: var(--pln-ink-3); font-weight: 500; }
                .pln-mon.pos  { color: var(--pln-green-2); }
                .pln-mon .cur { color: var(--pln-ink-3); font-weight: 500; font-size: 11px; margin-right: 3px; }

                .pln-mes { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--pln-ink-2); font-weight: 500; }
                .pln-mes .q {
                    font-size: 10px; font-weight: 600; color: var(--pln-ink-3);
                    padding: 1px 4px; background: var(--pln-line-2);
                    border-radius: 3px; letter-spacing: .04em;
                }
                .pln-dt { display: inline-flex; align-items: center; gap: 5px; color: var(--pln-ink-2); font-variant-numeric: tabular-nums; font-size: 12px; }
                .pln-dt svg { color: var(--pln-ink-4); }
                .pln-dt .day { color: var(--pln-ink); font-weight: 500; }
                .pln-dt .y { color: var(--pln-ink-3); }
                .pln-dt.overdue { color: var(--pln-red); }
                .pln-dt.overdue .day { color: var(--pln-red); }
                .pln-dt.overdue svg { color: var(--pln-red); }
                td.pln-c.dash { color: var(--pln-ink-4); }

                .pln-acts {
                    display: inline-flex; gap: 2px;
                    opacity: 1; transition: opacity .12s;
                    justify-content: flex-end; width: 100%;
                }
                .pln-ra {
                    width: 26px; height: 26px;
                    display: inline-grid; place-items: center;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 6px;
                    color: var(--pln-ink-3);
                    cursor: pointer;
                }
                .pln-ra:hover { background: var(--pln-surface); border-color: var(--pln-line-3); color: var(--pln-ink); }
                .pln-ra.danger:hover { color: var(--pln-red); border-color: #f0c6c1; background: #fdf3f2; }
                .pln-ra.win {
                    width: auto;
                    padding: 0 8px;
                    gap: 5px;
                    display: inline-flex;
                    background: var(--pln-green-bg);
                    border-color: var(--pln-green-line);
                    color: var(--pln-green-2);
                    font-size: 11px;
                    font-weight: 700;
                }
                .pln-ra.win:hover { color: #fff; border-color: var(--pln-green-2); background: var(--pln-green-2); }
                .pln-calc-left {
                    height: 22px;
                    padding: 0 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border: 1px solid var(--pln-green-line);
                    border-radius: 999px;
                    background: var(--pln-green-bg);
                    color: var(--pln-green-2);
                    cursor: pointer;
                    font-size: 11.5px;
                    font-weight: 800;
                    white-space: nowrap;
                    box-shadow: 0 0 0 1px rgba(7,150,105,.06), 0 1px 2px rgba(7,150,105,.10);
                }
                [data-theme="dark"] .pln-calc-left {
                    background: rgba(16,185,129,.14);
                    border-color: rgba(52,211,153,.45);
                    color: #6ee7b7;
                    box-shadow: none;
                }
                .pln-calc-left:hover {
                    background: var(--pln-green-2);
                    border-color: var(--pln-green-2);
                    color: #fff;
                }
                [data-theme="dark"] .pln-calc-left:hover {
                    background: #059669;
                    border-color: #10b981;
                    color: #ecfdf5;
                }
                .pln-calc-left svg { width: 12px; height: 12px; }

                .pln-estado-wrap {
                    display: inline-flex; align-items: center; gap: 5px;
                    height: 22px; padding: 0 8px 0 8px;
                    border-radius: 4px;
                    font-size: 11.5px; font-weight: 500;
                    cursor: pointer; position: relative;
                }
                [data-theme="dark"] .pln-estado-wrap {
                    filter: saturate(.9) brightness(.92);
                }
                .pln-estado-wrap .pln-estado-dot { width: 5px; height: 5px; border-radius: 50%; flex: none; }
                .pln-estado-wrap select {
                    appearance: none; background: transparent; border: 0; outline: 0;
                    font: inherit; font-size: 11.5px; font-weight: 500;
                    color: inherit; cursor: pointer; padding: 0 14px 0 0;
                    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
                    background-position: calc(100% - 8px) 50%, calc(100% - 4px) 50%;
                    background-size: 4px 4px;
                    background-repeat: no-repeat;
                    opacity: .85;
                }

                .pln-meta {
                    display: flex; align-items: center; gap: 10px;
                    padding: 8px 12px;
                    font-size: 12px;
                    color: var(--pln-ink-3);
                    background: var(--pln-surface-2);
                    border-left: 1px solid var(--pln-line);
                    border-right: 1px solid var(--pln-line);
                    border-bottom: 1px solid var(--pln-line);
                    border-radius: 0 0 var(--pln-radius) var(--pln-radius);
                    flex-wrap: wrap;
                }
                .pln-meta b { color: var(--pln-ink); font-weight: 600; }
                .pln-meta .dot { width: 3px; height: 3px; background: var(--pln-ink-4); border-radius: 50%; flex: none; }
                .pln-meta-tag {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 2px 8px;
                    background: var(--pln-green-bg);
                    color: var(--pln-green-2);
                    border-radius: 4px;
                    font-weight: 500;
                }
                .pln-meta-tag button {
                    border: none; background: transparent; color: inherit;
                    width: 14px; height: 14px; cursor: pointer; border-radius: 2px;
                    display: grid; place-items: center;
                }
                .pln-meta-tag button:hover { background: rgba(3,107,76,.12); }

                .pln-empty {
                    text-align: center;
                    padding: 38px 12px;
                    color: var(--pln-ink-4);
                    font-size: 12.5px;
                }

                /* ============ KANBAN ============ */
                .pln-kbn-wrap {
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line);
                    border-radius: 0 0 var(--pln-radius) var(--pln-radius);
                    overflow-x: auto;
                }
                .pln-kbn {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: minmax(260px, 1fr);
                    gap: 12px;
                    padding: 14px;
                    min-height: 480px;
                }
                .pln-kcol {
                    display: flex; flex-direction: column;
                    background: var(--pln-surface-2);
                    border: 1px solid var(--pln-line);
                    border-radius: 10px;
                    min-height: 200px;
                    max-height: calc(100vh - 280px);
                }
                .pln-kcol.over {
                    border-color: var(--pln-green-line);
                    box-shadow: 0 0 0 3px rgba(7,150,105,.10);
                }
                .pln-kcol.collapsed {
                    grid-auto-columns: 44px;
                    min-width: 44px;
                    max-width: 44px;
                    cursor: pointer;
                }
                .pln-kcol-h {
                    display: flex; align-items: center; gap: 8px;
                    padding: 11px 12px 10px;
                    border-bottom: 1px solid var(--pln-line);
                    background: var(--pln-surface-2);
                    border-radius: 10px 10px 0 0;
                    position: sticky; top: 0; z-index: 1;
                }
                .pln-kcol.collapsed .pln-kcol-h {
                    flex-direction: column;
                    gap: 10px;
                    padding: 12px 0;
                    border-bottom: none;
                    border-radius: 10px;
                    height: 100%;
                }
                .pln-kcol-pip {
                    width: 8px; height: 8px; border-radius: 50%; flex: none;
                    box-shadow: 0 0 0 3px rgba(0,0,0,.04);
                }
                .pln-kcol-title {
                    font-size: 12.5px; font-weight: 600;
                    color: var(--pln-ink); letter-spacing: -.005em;
                }
                .pln-kcol.collapsed .pln-kcol-title {
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    letter-spacing: 0.5px;
                }
                .pln-kcol-count {
                    font-size: 11px; font-weight: 600;
                    color: var(--pln-ink-3);
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line-3);
                    border-radius: 10px;
                    padding: 1px 7px;
                    min-width: 20px; text-align: center;
                    font-variant-numeric: tabular-nums;
                }
                .pln-kcol-sum {
                    margin-left: auto;
                    font-size: 11px;
                    color: var(--pln-ink-3);
                    font-variant-numeric: tabular-nums;
                    font-weight: 500;
                }
                .pln-kcol-sum b { color: var(--pln-ink-2); font-weight: 600; }
                .pln-kcol-add {
                    appearance: none; border: none; background: transparent;
                    width: 22px; height: 22px;
                    border-radius: 5px;
                    color: var(--pln-ink-3);
                    display: grid; place-items: center;
                    cursor: pointer;
                }
                .pln-kcol-add:hover { background: rgba(0,0,0,.06); color: var(--pln-ink); }
                .pln-kcol-list {
                    display: flex; flex-direction: column; gap: 8px;
                    padding: 10px;
                    overflow-y: auto;
                    flex: 1;
                }
                .pln-kcol-list::-webkit-scrollbar { width: 6px; }
                .pln-kcol-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 3px; }
                .pln-kcard {
                    background: var(--pln-surface);
                    border: 1px solid var(--pln-line);
                    border-radius: 8px;
                    padding: 10px 11px 11px;
                    display: flex; flex-direction: column; gap: 8px;
                    box-shadow: 0 1px 0 rgba(0,0,0,.02);
                    cursor: grab;
                    transition: box-shadow .12s, transform .08s, border-color .12s;
                    position: relative;
                }
                .pln-kcard::before {
                    content: "";
                    position: absolute; left: 0; top: 10px; bottom: 10px;
                    width: 3px; border-radius: 0 2px 2px 0;
                    background: var(--type-color, var(--pln-ink-4));
                }
                .pln-kcard:hover {
                    border-color: var(--pln-line-3);
                    box-shadow: 0 4px 14px -2px rgba(20,20,18,.08), 0 1px 2px rgba(20,20,18,.05);
                    transform: translateY(-1px);
                }
                .pln-kcard:hover .pln-kcard-acts { opacity: 1; }
                .pln-kcard.dragging { opacity: .4; }
                .pln-kcard-top {
                    display: flex; align-items: flex-start; justify-content: space-between;
                    gap: 8px;
                }
                .pln-kcard-acts {
                    display: inline-flex; gap: 1px;
                    opacity: 0; transition: opacity .12s;
                }
                .pln-kcard-acts .pln-ra { width: 22px; height: 22px; padding: 0; }
                .pln-kcard-acts .pln-ra svg { width: 11px; height: 11px; }
                .pln-kcard-acts .pln-ra.win span { display: none; }
                .pln-kcard-title {
                    font-size: 13px; font-weight: 600;
                    color: var(--pln-ink); letter-spacing: -.005em;
                    line-height: 1.35;
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    word-break: break-word;
                }
                .pln-kcard-cli {
                    font-size: 11.5px;
                    color: var(--pln-ink-3);
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                    display: flex; align-items: center; gap: 5px;
                }
                .pln-kcard-cli .cli-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--pln-ink-4); flex: none; }
                .pln-kcard-mid { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .pln-kcard-monto {
                    font-size: 12.5px; font-weight: 700;
                    color: var(--pln-ink); font-variant-numeric: tabular-nums;
                    letter-spacing: -.005em;
                }
                .pln-kcard-monto.zero { color: var(--pln-ink-3); font-weight: 500; }
                .pln-kcard-monto.pos { color: var(--pln-green-2); }
                .pln-kcard-monto .cur { color: var(--pln-ink-3); font-size: 10.5px; font-weight: 500; margin-right: 2px; }
                .pln-kcard-margin {
                    font-size: 10.5px;
                    background: var(--pln-green-bg);
                    color: var(--pln-green-2);
                    padding: 1px 5px;
                    border-radius: 3px;
                    font-weight: 600;
                }
                .pln-kcard-bot {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 8px;
                    border-top: 1px dashed var(--pln-line-2);
                    padding-top: 8px;
                }
                .pln-kcard-when {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 11px;
                    color: var(--pln-ink-3);
                    font-variant-numeric: tabular-nums;
                }
                .pln-kcard-when svg { color: var(--pln-ink-4); }
                .pln-kcard-when.overdue { color: var(--pln-red); }
                .pln-kcard-when.overdue svg { color: var(--pln-red); }
                .pln-kbn-empty {
                    padding: 24px 10px;
                    text-align: center;
                    font-size: 11.5px;
                    color: var(--pln-ink-4);
                    border: 1px dashed var(--pln-line-3);
                    border-radius: 7px;
                    background: rgba(255,255,255,.5);
                }

                /* responsive */
                @media (max-width: 1100px) {
                    .pln-top { grid-template-columns: 1fr; }
                    .pln-tabs { width: 100%; }
                    .pln-tab { flex: 1; justify-content: center; }
                    .pln-kpis { grid-template-columns: repeat(2, 1fr); }
                    .pln-primary { width: 100%; justify-content: center; }
                }
                @media (max-width: 720px) {
                    .pln-filt-group { width: 100%; margin-left: 0; }
                    .pln-search { max-width: none; }
                }
            `}</style>

            <div className="pln-top">
                <div className="pln-tabs" role="tablist" aria-label="Vista del planificador">
                    {[['tabla', 'Tabla'], ['kanban', 'Kanban']].map(([v, label]) => (
                        <button key={v} type="button" role="tab" aria-selected={view === v}
                                className={`pln-tab ${view === v ? 'is-on' : ''}`}
                                onClick={() => setView(v)}>
                            <span className="pln-tab-dot" />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                <div className="pln-kpis">
                    {[
                        { label: 'Total',         val: filtered.length,        tone: 'green' },
                        { label: 'En progreso',   val: progressCount,          tone: 'blue'  },
                        { label: 'Pendientes',    val: pendingCount,           tone: 'amber' },
                        { label: 'Completadas',   val: completedCount,         tone: 'green' },
                        { label: 'Alta prio',     val: highPriorityCount,      tone: 'red'  },
                    ].map(k => (
                        <div key={k.label} className="pln-kpi" data-tone={k.tone}>
                            <div className="pln-kpi-label">{k.label}</div>
                            <div className="pln-kpi-val">{k.val}</div>
                            {k.sub && <div className="pln-kpi-sub">{k.sub}</div>}
                        </div>
                    ))}
                </div>

                {puedeEditar && (
                    <button type="button" onClick={() => setModal({ open:true, actividad:null })} className="pln-primary">
                        <span className="pln-pico"><IcoPlus /></span>
                        <span>Nueva actividad</span>
                        <span className="pln-kbd">N</span>
                    </button>
                )}
            </div>

            <div className="pln-filters">
                <div className="pln-qpills" aria-label="Trimestre">
                    {['1','2','3','4'].map(q => (
                        <button key={q} type="button"
                                className={`pln-qpill ${filters.trimestre === q ? 'is-on' : ''}`}
                                onClick={() => setF('trimestre', q)}>Q{q}</button>
                    ))}
                </div>
                <div className="pln-search">
                    <span className="pln-si"><IcoSearch /></span>
                    <input placeholder="Buscar…"
                           value={filters.buscar}
                           onChange={e => setF('buscar', e.target.value)} />
                    {filters.buscar && (
                        <button className="pln-sx" onClick={() => setF('buscar', '')} aria-label="Limpiar"><IcoX /></button>
                    )}
                </div>
                <div className="pln-filt-group">
                    <div className={`pln-sel ${filters.mes ? 'has-val' : ''}`}>
                        <select value={filters.mes} onChange={e => setF('mes', e.target.value)}>
                            {[['','Mes'], ...MESES.map(m => [m, m])].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <span className="pln-car"><IcoCaret /></span>
                    </div>
                    <label className={`pln-date ${filters.dia ? 'has-val' : ''}`} title="Filtrar por dia exacto">
                        <span className="pln-date-lbl">Dia</span>
                        <input type="date" aria-label="Dia" value={filters.dia || ''} onChange={e => setF('dia', e.target.value)} />
                    </label>
                    <label className={`pln-date ${filters.semana ? 'has-val' : ''}`} title="Filtrar por semana">
                        <span className="pln-date-lbl">Semana</span>
                        <input type="date" aria-label="Semana" value={filters.semana || ''} onChange={e => setF('semana', e.target.value)} />
                    </label>
                    {puedeFiltrar && (<>
                        {!vendedorForzado && (
                            <div className={`pln-sel ${filters.vendedorId ? 'has-val' : ''}`}>
                                <select value={filters.vendedorId} onChange={e => setF('vendedorId', e.target.value)}>
                                    <option value="">Vendedor</option>
                                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                </select>
                                <span className="pln-car"><IcoCaret /></span>
                            </div>
                        )}
                        <div className={`pln-sel ${filters.tipo ? 'has-val' : ''}`}>
                            <select value={filters.tipo} onChange={e => setF('tipo', e.target.value)}>
                                <option value="">Tipo</option>
                                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span className="pln-car"><IcoCaret /></span>
                        </div>
                        <div className={`pln-sel ${filters.estado ? 'has-val' : ''}`}>
                            <select value={filters.estado} onChange={e => setF('estado', e.target.value)}>
                                <option value="">Estado</option>
                                {TODOS_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="pln-car"><IcoCaret /></span>
                        </div>
                        <div className={`pln-sel ${filters.prioridad ? 'has-val' : ''}`}>
                            <select value={filters.prioridad} onChange={e => setF('prioridad', e.target.value)}>
                                <option value="">Prioridad</option>
                                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <span className="pln-car"><IcoCaret /></span>
                        </div>
                    </>)}
                    {hasActiveFilters && (
                        <button type="button"
                                className="pln-clear"
                                onClick={() => setFilters(DEFAULT_FILTERS)}
                                aria-label="Limpiar filtros"
                                title="Limpiar filtros">
                            <IcoX />
                        </button>
                    )}
                </div>
            </div>

            {view === 'tabla' && (<div className="pln-view-anim">
                <div className="pln-twrap has-meta" style={{ height: isMobile ? 'calc(100vh - 300px)' : 'calc(100vh - 260px)', minHeight: 438, overflowY: 'auto' }}>
                    <table className="pln-t">
                        <colgroup>
                            {COL_DEFS.map(c => <col key={c.label || 'acts'} style={{ width: c.width }} />)}
                        </colgroup>
                        <thead>
                            <tr>
                                {COL_DEFS.map(col => {
                                    if (!col.key) return <th key="acts" className="pln-h pln-h-right" style={{ padding:'0 12px' }}>{col.label}</th>;
                                    const isSorted = sort.key === col.key;
                                    const align = col.align === 'right';
                                    return (
                                        <th key={col.key} className={`pln-h ${isSorted ? 'sorted' : ''} ${align ? 'pln-h-right' : ''}`}>
                                            <button className="pln-hbtn" onClick={() => toggleSort(col)} title={`Ordenar por ${col.label}`}>
                                                <span className="lbl">{col.label}</span>
                                                <span className="ind">{isSorted ? (sort.dir === 'asc' ? <IcoUp /> : <IcoDown />) : <IcoCaret />}</span>
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const v = vendedores.find(x => x.id === a.vendedor_id);
                                const _cols = parseArr(a.colaboradores).filter(id => id !== a.vendedor_id);
                                const colabsT = _cols.map(id => vendedores.find(x => x.id === id)).filter(Boolean);
                                const inicio = fmtDateShort(a.fecha);
                                const finObj = fmtDateShort(a.fecha_fin);
                                const finDate = a.fecha_fin ? new Date(String(a.fecha_fin).slice(0,10) + 'T12:00:00') : null;
                                const vencida = finDate && finDate < new Date() && a.estado !== 'Completado' && a.estado !== 'Ganada';
                                const ganadaCalc = a.estado === 'Ganada' ? miniCalc(a) : null;
                                const montoNum = Number(a.monto) || 0;
                                const estTones = tk.isDark ? {
                                    'Pendiente':   { fg:'#cbd5e1', bg:'rgba(148,163,184,.15)', dot:'#94a3b8' },
                                    'En Progreso': { fg:'#93c5fd', bg:'rgba(37,99,235,.18)', dot:'#60a5fa' },
                                    'Completado':  { fg:'#86efac', bg:'rgba(16,185,129,.16)', dot:'#34d399' },
                                    'Ganada':      { fg:'#86efac', bg:'rgba(16,185,129,.16)', dot:'#34d399' },
                                    'Perdida':     { fg:'#fca5a5', bg:'rgba(239,68,68,.16)', dot:'#f87171' },
                                } : {
                                    'Pendiente':   { fg:'#5b5d57', bg:'#efeeea', dot:'#5b5d57' },
                                    'En Progreso': { fg:'#2862c8', bg:'#e8f0fc', dot:'#2862c8' },
                                    'Completado':  { fg:'#036b4c', bg:'#ecfdf5', dot:'#079669' },
                                    'Ganada':      { fg:'#036b4c', bg:'#ecfdf5', dot:'#079669' },
                                    'Perdida':     { fg:'#c0392b', bg:'#fdecec', dot:'#c0392b' },
                                };
                                const estTone = estTones[a.estado] || estTones.Pendiente;
                                const estadoOpts = TIPOS_CON_RESULTADO.includes(a.tipo)
                                    ? ['Pendiente','En Progreso','Completado','Ganada','Perdida']
                                    : ESTADOS;
                                const bloqueada = esActividadBloqueada(a);
                                return (
                                    <tr
                                        key={a.id}
                                        className="pln-r"
                                        data-pr={a.prioridad}
                                        onClick={() => puedeEditar && !bloqueada && setModal({ open:true, actividad:a })}
                                        title={puedeEditar && !bloqueada ? 'Click para editar' : 'Solo lectura'}
                                    >
                                        <td className="pln-c first">
                                            <div className="pln-act">
                                                <span className="pln-act-row">
                                                    <span className="t1" title={a.nombre}>{a.nombre}</span>
                                                    {ganadaCalc && (
                                                        <button
                                                            type="button"
                                                            className="pln-calc-left"
                                                            onClick={e => { e.stopPropagation(); setCalcModal({ open:true, actividad:a }); }}
                                                            title="Ver comisión">
                                                            <IcoCash />
                                                        </button>
                                                    )}
                                                    {isBusinessCaseTipo(a.tipo) && (
                                                        <button
                                                            type="button"
                                                            className="pln-calc-left"
                                                            onClick={e => { e.stopPropagation(); setBcModal({ open:true, actividad:a }); }}
                                                            title="Business Case">
                                                            BC
                                                        </button>
                                                    )}
                                                </span>
                                                {a.notas && <span className="t2" title={a.notas}>{a.notas}</span>}
                                            </div>
                                        </td>
                                        <td className="pln-c"><TipoBadge tipo={a.tipo} /></td>
                                        <td className="pln-c">
                                            <div className="pln-ven">
                                                <span className="pln-stack">
                                                    {v && <Avatar vendedor={v} />}
                                                    {colabsT.map(c => <span key={c.id} title={c.nombre}><Avatar vendedor={c} /></span>)}
                                                </span>
                                                <span className="name">{v?.nombre || 'Sin vendedor'}{colabsT.length ? ` +${colabsT.length}` : ''}</span>
                                            </div>
                                        </td>
                                        <td className="pln-c" title={a.cliente || ''}>
                                            {a.cliente
                                                ? <div className="pln-act"><span className="t1">{a.cliente}</span>{a.cliente_registrado_por_nombre && <span className="t2">de {a.cliente_registrado_por_nombre}</span>}</div>
                                                : <span style={{ color: 'var(--pln-ink-4)' }}>—</span>}
                                        </td>
                                        <td className="pln-c right">
                                            <span className={`pln-mon ${montoNum > 0 ? 'pos' : 'zero'}`}>
                                                <span className="cur">{moneda}</span>{fmtUSD(montoNum, moneda).replace(/^[^\d-]+/, '')}
                                            </span>
                                        </td>
                                        <td className="pln-c"><PrioBadge prioridad={a.prioridad} /></td>
                                        <td className="pln-c">
                                            <span className="pln-estado-wrap" style={{ background: estTone.bg, color: estTone.fg }} onClick={e => e.stopPropagation()}>
                                                <span className="pln-estado-dot" style={{ background: estTone.dot }} />
                                                <select value={a.estado} disabled={!puedeEditar || bloqueada} onChange={e => changeEstado(a.id, e.target.value)}>
                                                    {estadoOpts.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </span>
                                        </td>
                                        <td className="pln-c">
                                            {a.mes ? (
                                                <span className="pln-mes">
                                                    {MES_SHORT[a.mes] || a.mes}
                                                    <span className="q">Q{MES_TO_Q[a.mes] || '·'}</span>
                                                </span>
                                            ) : <span style={{ color: 'var(--pln-ink-4)' }}>—</span>}
                                        </td>
                                        <td className={`pln-c ${!inicio ? 'dash' : ''}`}>
                                            {inicio ? (
                                                <span className="pln-dt"><IcoCal /><span className="day">{inicio.day}</span><span className="y">/{inicio.year}</span></span>
                                            ) : '—'}
                                        </td>
                                        <td className={`pln-c ${!finObj ? 'dash' : ''}`}>
                                            {finObj ? (
                                                <span className={`pln-dt ${vencida ? 'overdue' : ''}`}><IcoCal /><span className="day">{finObj.day}</span><span className="y">/{finObj.year}</span></span>
                                            ) : '—'}
                                        </td>
                                        <td className="pln-c" style={{ textAlign:'right' }}>
                                            <div className="pln-acts" onClick={e => e.stopPropagation()}>
                                                {puedeEditar && !bloqueada && <button className="pln-ra" onClick={() => setModal({ open:true, actividad:a })} title="Editar"><IcoEdit /></button>}
                                                {puedeEliminar && <button className="pln-ra danger" onClick={() => setConfirmId(a.id)} title="Eliminar"><IcoTrash /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!filtered.length && (
                                <tr><td colSpan={COL_DEFS.length} className="pln-empty">Sin resultados con los filtros aplicados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="pln-meta">
                    <span><b>{filtered.length}</b> {filtered.length === 1 ? 'actividad' : 'actividades'}</span>
                    <span className="dot" />
                    <span>Total <b>{fmtUSD(totalMonto, moneda)}</b></span>
                    {sort.key && (<>
                        <span className="dot" />
                        <span className="pln-meta-tag">
                            Ordenado por {sortedColLabel} {sort.dir === 'asc' ? '↑' : '↓'}
                            <button onClick={() => setSort({ key:null, dir:null })} aria-label="Quitar orden"><IcoX /></button>
                        </span>
                    </>)}
                </div>
            </div>)}

            {view === 'kanban' && (
                <div className="pln-kbn-wrap pln-view-anim">
                    <div className="pln-kbn" style={isMobile ? { gridAutoColumns: '240px' } : undefined}>
                        {KANBAN_COLS.map(col => {
                            const colActs = filtered.filter(a => a.estado === col);
                            const colSum  = colActs.reduce((s,a) => s + (Number(a.monto) || 0), 0);
                            const isCollapsed = collapsedCols.has(col);
                            const isOver = dragOverCol === col;
                            return (
                                <div key={col}
                                     className={`pln-kcol ${isCollapsed ? 'collapsed' : ''} ${isOver ? 'over' : ''}`}
                                     onClick={isCollapsed ? () => toggleCol(col) : undefined}
                                     onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                                     onDragLeave={e => { if (e.currentTarget === e.target) setDragOverCol(null); }}
                                     onDrop={e => { e.preventDefault(); handleDrop(col); }}>
                                    <div className="pln-kcol-h" onClick={!isCollapsed ? () => toggleCol(col) : undefined} style={!isCollapsed ? { cursor: 'pointer' } : undefined}>
                                        <span className="pln-kcol-pip" style={{ background: COL_PIP[col] }} />
                                        <span className="pln-kcol-title">{col}</span>
                                        {!isCollapsed && (<>
                                            <span className="pln-kcol-count">{colActs.length}</span>
                                            {colSum > 0 && <span className="pln-kcol-sum"><b>{fmtUSD(colSum, moneda)}</b></span>}
                                            {puedeEditar && <button className="pln-kcol-add" title="Nueva actividad" onClick={(e) => { e.stopPropagation(); newWithEstado(col); }}><IcoPlus /></button>}
                                        </>)}
                                        {isCollapsed && <span className="pln-kcol-count">{colActs.length}</span>}
                                    </div>
                                    {!isCollapsed && (
                                        <div className="pln-kcol-list">
                                            {colActs.map(a => {
                                                const v = vendedores.find(x => x.id === a.vendedor_id);
                                                const _cols = parseArr(a.colaboradores).filter(id => id !== a.vendedor_id);
                                                const colabs = _cols.map(id => vendedores.find(x => x.id === id)).filter(Boolean);
                                                const finObj = fmtDateShort(a.fecha_fin);
                                                const finDate = a.fecha_fin ? new Date(String(a.fecha_fin).slice(0,10) + 'T12:00:00') : null;
                                                const vencida = finDate && finDate < new Date() && a.estado !== 'Completado' && a.estado !== 'Ganada';
                                                const ganadaCalc = a.estado === 'Ganada' ? miniCalc(a) : null;
                                                const montoNum = Number(a.monto) || 0;
                                                const typeColor = getTypeColor(a.tipo);
                                                const bloqueada = esActividadBloqueada(a);
                                                return (
                                                    <div key={a.id} className={`pln-kcard ${dragId === a.id ? 'dragging' : ''}`}
                                                         data-pr={a.prioridad}
                                                         style={{ '--type-color': typeColor.color }}
                                                         draggable={puedeEditar && !bloqueada}
                                                         onClick={() => puedeEditar && !bloqueada && setModal({ open:true, actividad:a })}
                                                        onDragStart={e => { if (!puedeEditar || bloqueada) return; setDragId(a.id); e.dataTransfer.effectAllowed = 'move'; }}
                                                        onDragEnd={() => { setDragId(null); setDragOverCol(null); }}>
                                                        <div className="pln-kcard-top">
                                                            {ganadaCalc && (
                                                                <button
                                                                    type="button"
                                                                    className="pln-calc-left"
                                                                    onClick={e => { e.stopPropagation(); setCalcModal({ open:true, actividad:a }); }}
                                                                    title="Ver comisión">
                                                                       <IcoCash/>
                                                                </button>
                                                            )}
                                                            {isBusinessCaseTipo(a.tipo) && (
                                                                <button
                                                                    type="button"
                                                                    className="pln-calc-left"
                                                                    onClick={e => { e.stopPropagation(); setBcModal({ open:true, actividad:a }); }}
                                                                    title="Business Case">
                                                                    BC
                                                                </button>
                                                            )}
                                                            <TipoBadge tipo={a.tipo} />
                                                            <div className="pln-kcard-acts" onClick={e => e.stopPropagation()}>
                                                                {puedeEditar && !bloqueada && <button className="pln-ra" onClick={() => setModal({ open:true, actividad:a })} title="Editar"><IcoEdit /></button>}
                                                                {puedeEliminar && <button className="pln-ra danger" onClick={() => setConfirmId(a.id)} title="Eliminar"><IcoTrash /></button>}
                                                            </div>
                                                        </div>
                                                        <div className="pln-kcard-title">{a.nombre}</div>
                                                        {a.cliente && (
                                                            <div className="pln-kcard-cli"><span className="cli-dot" />{a.cliente}</div>
                                                        )}
                                                        <div className="pln-kcard-mid">
                                                            <span className={`pln-kcard-monto ${montoNum > 0 ? 'pos' : 'zero'}`}>
                                                                <span className="cur">{moneda}</span>{fmtUSD(montoNum, moneda).replace(/^[^\d-]+/, '')}
                                                            </span>
                                                            <PrioBadge prioridad={a.prioridad} />
                                                            {ganadaCalc && <span className="pln-kcard-margin">{ganadaCalc.margen.toFixed(1)}%</span>}
                                                        </div>
                                                        <div className="pln-kcard-bot">
                                                            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                                                                <span className="pln-stack">
                                                                    {v && <Avatar vendedor={v} />}
                                                                    {colabs.map(c => <span key={c.id} title={c.nombre}><Avatar vendedor={c} /></span>)}
                                                                </span>
                                                                <span style={{ fontSize: 11, color: 'var(--pln-ink-3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v?.nombre?.split(' ').slice(0,2).join(' ') || '—'}</span>
                                                            </div>
                                                            {finObj && (
                                                                <span className={`pln-kcard-when ${vencida ? 'overdue' : ''}`}><IcoCal />{finObj.day}/{finObj.year}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {!colActs.length && <div className="pln-kbn-empty">Sin actividades</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <ActividadModal
                open={modal.open}
                actividad={modal.actividad}
                vendedores={vendedores}
                onClose={() => setModal({ open:false, actividad:null })}
                onSave={handleSave}
            />

            <ComisionModal
                open={calcModal.open}
                actividad={calcActividadActual}
                vendedor={vendedores.find(v => v.id === calcModal.actividad?.vendedor_id)}
                moneda={moneda}
                onClose={() => setCalcModal({ open:false, actividad:null })}
                readOnly={soloLecturaGerencia || esActividadBloqueada(calcActividadActual)}
                onSave={async data => {
                    if (soloLecturaGerencia || esActividadBloqueada(calcActividadActual)) return null;
                    const updated = await handleSave(data);
                    if (updated) setCalcModal(prev => ({ ...prev, actividad: { ...prev.actividad, ...updated } }));
                    return updated;
                }}
            />

            <BusinessCaseModal
                open={bcModal.open}
                actividad={bcActividadActual}
                vendedor={vendedores.find(v => v.id === bcModal.actividad?.vendedor_id)}
                moneda={moneda}
                onClose={() => setBcModal({ open:false, actividad:null })}
                readOnly={soloLecturaGerencia || esActividadBloqueada(bcActividadActual)}
                onSave={async data => {
                    if (soloLecturaGerencia || esActividadBloqueada(bcActividadActual)) return null;
                    const updated = await handleSave(data);
                    if (updated) setBcModal(prev => ({ ...prev, actividad: { ...prev.actividad, ...updated } }));
                    return updated;
                }}
            />

            {confirmId && (
                <div onClick={() => setConfirmId(null)} style={{ position:'fixed', inset:0, background:'rgba(20,20,18,0.42)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:24 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background:tk.card, borderRadius:12, padding:'18px 20px', maxWidth:340, width:'100%', boxShadow:'0 24px 64px -12px rgba(20,20,18,.28), 0 4px 12px rgba(20,20,18,.08)', border:`1px solid ${tk.bdr}` }}>
                        <div style={{ fontWeight:600, marginBottom:6, color:tk.txt, fontSize:15, letterSpacing:'-.01em' }}>¿Eliminar actividad?</div>
                        <div style={{ fontSize:13, color:tk.txt2, marginBottom:18 }}>
                            {actividades.find(a => a.id === confirmId)?.nombre}
                        </div>
                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                            <button onClick={() => setConfirmId(null)} style={{ height:34, padding:'0 14px', background:tk.card2, color:tk.txt, border:`1px solid ${tk.bdr}`, borderRadius:7, fontWeight:500, cursor:'pointer', fontSize:13 }}>Cancelar</button>
                            <button onClick={() => handleDelete(confirmId)} style={{ height:34, padding:'0 14px', background:'#c0392b', color:'#fff', border:'none', borderRadius:7, fontWeight:600, cursor:'pointer', fontSize:13 }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
