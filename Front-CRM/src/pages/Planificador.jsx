import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getVendedores, createActividad, updateActividad, deleteActividad } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useRolFilter from '../hooks/useRolFilter';
import { filterActs, fmtUSD, totalGastosOperacion, TIPOS, ESTADOS, TODOS_ESTADOS, PRIORIDADES, TIPOS_CON_RESULTADO, MESES } from '../utils/crm';
import Avatar from '../components/Avatar';
import { TipoBadge, PrioBadge } from '../components/Badge';
import ActividadModal from '../components/ActividadModal';
import ComisionModal from '../components/ComisionModal';
import PeriodoPicker from '../components/PeriodoPicker';

const KANBAN_COLS = ['Pendiente','En Progreso','Completado','Ganada','Perdida'];
const COL_COLOR = { 'Pendiente':'#e67e22','En Progreso':'#10b981','Completado':'#27ae60','Ganada':'#2e7d32','Perdida':'#e74c3c' };

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
    return d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function dateOrderValue(value, fallback) {
    const raw = value || fallback;
    if (!raw) return 0;
    const d = new Date(String(raw).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function Planificador() {
    const { actividades, setActividades, config } = useActividades();
    const { user } = useAuth();
    const puedeEliminar = user?.is_superadmin || user?.roles?.some(r => ['Admin','Gerencia'].includes(r));
    const puedeFiltrar  = puedeEliminar;
    const tk = useTheme();
    const sel    = { padding:'7px 10px', borderRadius:7, border:`1px solid ${tk.bdr}`, fontSize:13, background:tk.card, color:tk.txt };
    const td     = { padding:'10px 10px', color:tk.txt };
    const th     = { padding:'8px 10px', textAlign:'left', color:tk.txt2, fontWeight:700, fontSize:11, whiteSpace:'nowrap' };
    const iconBtn = { padding:'4px 6px', border:`1px solid ${tk.bdr}`, borderRadius:6, background:tk.card, cursor:'pointer', fontSize:13 };
    const btnPri  = { padding:'9px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
    const btnSec  = { padding:'9px 20px', background:tk.card2, color:tk.txt, border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
    const moneda     = config?.moneda || 'USD';
    const tipos      = config?.tipos_actividad || TIPOS;
    const tasa_sunat = parseFloat(config?.tasa_sunat) || 0;
    const tableMinWidth = 1180;

    const miniCalc = (a) => {
        const fact = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
        const gastos = totalGastosOperacion(a);
        const rentabilidadBruta = fact - gastos;
        const sunat = rentabilidadBruta * tasa_sunat;
        const rentabilidad = rentabilidadBruta - sunat;
        const margen = fact > 0 ? (rentabilidad / fact) * 100 : 0;
        return { util: rentabilidad, margen };
    };
    const vendedorForzado = useRolFilter(); // null = ve todo, string = solo su id
    const [searchParams] = useSearchParams();
    const [vendedores, setVendedores] = useState([]);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
    const tableScrollRef = useRef(null);
    const topScrollRef = useRef(null);
    const syncingScroll = useRef(false);
    const [view, setView] = useState(searchParams.get('view') === 'kanban' ? 'kanban' : 'tabla');
    const [collapsedCols, setCollapsedCols] = useState(new Set(['Ganada','Perdida']));
    const toggleCol = (col) => setCollapsedCols(s => {
        const n = new Set(s);
        if (n.has(col)) n.delete(col); else n.add(col);
        return n;
    });
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [confirmId,  setConfirmId]  = useState(null);
    const [calcModal,  setCalcModal]  = useState({ open:false, actividad:null });
    const MES_ACTUAL = MESES[new Date().getMonth()];
    const Q_ACTUAL = String(Math.floor(new Date().getMonth() / 3) + 1);
    const DEFAULT_FILTERS = { vendedorId:'', trimestre: Q_ACTUAL, mes:'', tipo:'', estado:'', prioridad:'', buscar:'' };
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [sort, setSort] = useState({ key:'fecha', dir:'desc' });
    const [dragId, setDragId] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);
    useEffect(() => { getVendedores().then(setVendedores); }, []);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 760);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const syncHorizontalScroll = (source, target) => {
        if (!source || !target || syncingScroll.current) return;
        syncingScroll.current = true;
        target.scrollLeft = source.scrollLeft;
        requestAnimationFrame(() => { syncingScroll.current = false; });
    };

    // Teclado: N = nueva actividad
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))
                setModal({ open: true, actividad: null });
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const norm = (value) => String(value || '').toLowerCase();
    const vendedorNombre = (a) => vendedores.find(v => v.id === a.vendedor_id)?.nombre || '';
    const matchText = (value, query) => norm(value).includes(norm(query));

    const baseFiltered = filterActs(actividades, {
        vendedorId: vendedorForzado || filters.vendedorId || undefined,
        trimestre:  filters.trimestre  || undefined,
        mes:        filters.mes        || undefined,
        tipo:       filters.tipo       || undefined,
        estado:     filters.estado     || undefined,
        prioridad:  filters.prioridad  || undefined,
    });

    // Si el filtro de mes es el mes actual, también arrastrar actividades En Progreso de meses anteriores
    let filtered = baseFiltered;
    if (filters.mes === MES_ACTUAL) {
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
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        const cmp = typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), 'es', { sensitivity:'base' });
        return sort.dir === 'asc' ? cmp : -cmp;
    });

    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const toggleSort = (key) => {
        setSort(cur => {
            if (cur.key === key) return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
            const dir = ['monto','fecha','fecha_fin'].includes(key) ? 'desc' : 'asc';
            return { key, dir };
        });
    };
    const sortArrow = (key) => sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';

    // Refleja el guardado al instante; el socket mantiene sincronizados a los demas clientes.
    const handleSave = async (data) => {
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
        await deleteActividad(id);
        setConfirmId(null);
    };

    const changeEstado = async (id, estado) => {
        const updated = await updateActividad(id, { estado });
        setActividades(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    };

    const handleDrop = async (col) => {
        const id = dragId;
        setDragId(null);
        setDragOverCol(null);
        if (!id) return;
        const act = actividades.find(a => a.id === id);
        if (!act || act.estado === col) return;
        const updated = await updateActividad(id, { estado: col });
        setActividades(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    };

    const totalMonto = filtered.reduce((s,a) => s + Number(a.monto), 0);

    return (
        <div>
            {/* Header + Mini stats en una sola fila */}
            <div style={{ display:'flex', alignItems:isMobile ? 'stretch' : 'center', marginBottom:20, gap:10, flexDirection:isMobile ? 'column' : 'row' }}>
                {/* Vista */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {['tabla','kanban'].map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                            padding:'7px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                            background: view === v ? '#10b981' : tk.card2, color: view === v ? '#fff' : tk.txt,
                        }}>{v === 'tabla' ? '📋 Tabla' : '🗂 Kanban'}</button>
                    ))}
                </div>

                {/* Stats centrados */}
                <div style={{ display:'flex', gap:8, flex:1, justifyContent:isMobile ? 'flex-start' : 'center', flexWrap:'wrap' }}>
                    {[
                        ['Total', filtered.length, '#10b981'],
                        ['Monto', fmtUSD(totalMonto, moneda), '#27ae60'],
                        ['Completadas', filtered.filter(a=>a.estado==='Completado').length, '#8e44ad'],
                        ['En Progreso', filtered.filter(a=>a.estado==='En Progreso').length, '#e67e22'],
                        ['Alta prioridad', filtered.filter(a=>a.prioridad==='Alta'&&a.estado!=='Completado').length, '#e74c3c'],
                    ].map(([label, val, color]) => (
                        <div key={label} style={{ background:tk.card, borderRadius:8, padding:'8px 18px', boxShadow:tk.shadow, borderLeft:`3px solid ${color}` }}>
                            <div style={{ fontSize:10, color:tk.txt2, fontWeight:600 }}>{label}</div>
                            <div style={{ fontSize:16, fontWeight:700, color:tk.txt }}>{val}</div>
                        </div>
                    ))}
                </div>

                {/* Nueva actividad */}
                <button onClick={() => setModal({ open:true, actividad:null })} style={{ ...btnPri, flexShrink:0, width:isMobile ? '100%' : 'auto' }}>+ Nueva actividad</button>
            </div>

            {/* Filtros */}
            <style>{`@keyframes qPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0.55);} 70% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(16,185,129,0);} 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0);} }`}</style>
            <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                <PeriodoPicker
                    trim={filters.trimestre} mes={filters.mes}
                    onTrim={t => setF('trimestre', t)} onMes={m => setF('mes', m)}
                />
                <input placeholder="Buscar actividad, cliente, vendedor..." style={{ ...sel, minWidth:isMobile ? '100%' : 250, flex:isMobile ? '1 1 100%' : '0 1 auto' }}
                    value={filters.buscar} onChange={e => setF('buscar', e.target.value)} />
                <div style={{ flex:1, display:'flex', justifyContent:isMobile ? 'flex-start' : 'center', gap:5, transform:isMobile ? 'none' : 'translateX(-50px)', overflowX:'auto' }}>
                    {['1','2','3','4'].map(q => {
                        const activo = q === Q_ACTUAL;
                        return (
                            <span key={q} style={{
                                background: activo ? '#10b981' : tk.card2,
                                color: activo ? '#fff' : tk.txt2,
                                padding:'6px 14px', borderRadius:20,
                                fontWeight:800, fontSize: activo ? 14 : 12, letterSpacing:1,
                                opacity: activo ? 1 : 0.6,
                                animation: activo ? 'qPulse 1.8s ease-in-out infinite' : 'none',
                            }}>Q{q}</span>
                        );
                    })}
                </div>
                {puedeFiltrar && (
                    <>
                        {[
                            ...(!vendedorForzado ? [['vendedorId', [['','Vendedor'],...vendedores.map(v=>[v.id,v.nombre])]]] : []),
                            ['tipo',       [['','Tipo'],...tipos.map(t=>[t,t])]],
                            ['estado',     [['','Estado'],...TODOS_ESTADOS.map(e=>[e,e])]],
                            ['prioridad',  [['','Prioridad'],...PRIORIDADES.map(p=>[p,p])]],
                        ].map(([key, opts]) => (
                            <select key={key} style={sel} value={filters[key]} onChange={e => setF(key, e.target.value)}>
                                {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        ))}
                        {(filters.vendedorId || filters.tipo || filters.estado || filters.prioridad || filters.buscar || filters.trimestre !== Q_ACTUAL || filters.mes) &&
                            <button onClick={() => setFilters(DEFAULT_FILTERS)}
                                style={{ padding:'7px 12px', borderRadius:7, border:`1px solid ${tk.bdr}`, background:tk.card, cursor:'pointer', fontSize:12, color:'#e74c3c' }}>
                                Limpiar
                            </button>
                        }
                    </>
                )}
            </div>

            {/* Vista Tabla */}
            {view === 'tabla' && (
                <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflow:'hidden' }}>
                    <div
                        ref={topScrollRef}
                        onScroll={e => syncHorizontalScroll(e.currentTarget, tableScrollRef.current)}
                        style={{ overflowX:'auto', overflowY:'hidden', borderBottom:`1px solid ${tk.bdr}`, background:tk.card2 }}
                    >
                        <div style={{ width: Math.max(tableMinWidth, tableScrollRef.current?.scrollWidth || 0, tableScrollRef.current?.clientWidth || 0), height: 14 }} />
                    </div>
                    <div
                        ref={tableScrollRef}
                        onScroll={e => syncHorizontalScroll(e.currentTarget, topScrollRef.current)}
                        style={{ overflowX:'auto', overflowY:'hidden' }}
                    >
                    <table style={{ width:'100%', minWidth: tableMinWidth, borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                            <tr style={{ borderBottom:`2px solid ${tk.bdr}`, background:tk.card2 }}>
                                {[
                                    ['', null],
                                    ['Actividad', 'actividad'],
                                    ['Tipo', 'tipo'],
                                    ['Vendedor', 'vendedor'],
                                    ['Cliente', 'cliente'],
                                    ['Monto', 'monto'],
                                    ['Prioridad', 'prioridad'],
                                    ['Estado', 'estado'],
                                    ['Mes', 'mes'],
                                    ['Fecha de inicio', 'fecha'],
                                    ['Fin estimado', 'fecha_fin'],
                                    ['', null],
                                ].map(([h, key], i) =>
                                    <th key={i} style={th}>
                                        {key ? (
                                            <button type="button" onClick={() => toggleSort(key)}
                                                title="Ordenar"
                                                style={{ display:'inline-flex', alignItems:'center', gap:5, border:'none', background:'transparent', color:tk.txt2, fontWeight:700, fontSize:11, padding:0, cursor:'pointer' }}>
                                                <span>{h}</span>
                                                <span style={{ color:sort.key === key ? '#10b981' : tk.txt3, fontSize:11 }}>{sortArrow(key)}</span>
                                            </button>
                                        ) : h}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const v = vendedores.find(x => x.id === a.vendedor_id);
                                const _cols = parseArr(a.colaboradores).filter(id => id !== a.vendedor_id);
                                const colabsT = _cols.map(id => vendedores.find(x => x.id === id)).filter(Boolean);
                                const inicio = fmtDateShort(a.fecha);
                                const finEst = a.fecha_fin ? new Date(String(a.fecha_fin).slice(0,10) + 'T12:00:00') : null;
                                return (
                                    <tr key={a.id} style={{ borderBottom:`1px solid ${tk.bdr}` }}>
                                        <td style={{ padding:'0 0 0 4px', width:4 }}>
                                            <div style={{ width:3, height:36, borderRadius:2, background: COL_COLOR[a.estado] || '#ccc' }} />
                                        </td>
                                        <td style={td}>
                            <div style={{ fontWeight:600 }}>{a.nombre}</div>
                            {a.estado === 'Ganada' && (() => { const { util, margen } = miniCalc(a); return (
                                <div style={{ display:'flex', gap:6, marginTop:3 }}>
                                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, fontWeight:700, background:'#27ae6018', color:'#27ae60' }}>
                                        {fmtUSD(util, moneda)}
                                    </span>
                                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, fontWeight:700, background: margen >= 15 ? '#10b98118' : '#e74c3c18', color: margen >= 15 ? '#10b981' : '#e74c3c' }}>
                                        {margen.toFixed(1)}% margen
                                    </span>
                                </div>
                            ); })()}
                            <div style={{ fontSize:11, color:tk.txt3 }}>{a.notas}</div>
                        </td>
                                        <td style={td}><TipoBadge tipo={a.tipo} /></td>
                                        <td style={td}>
                                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                <div style={{ display:'flex' }}>
                                                    <div style={{ position:'relative', zIndex: colabsT.length + 1 }}><Avatar vendedor={v} /></div>
                                                    {colabsT.map((c, idx) => (
                                                        <div key={c.id} title={c.nombre} style={{ marginLeft:-8, position:'relative', zIndex: colabsT.length - idx, border:`2px solid ${tk.card}`, borderRadius:'50%' }}>
                                                            <Avatar vendedor={c} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <span>{v?.nombre}{colabsT.length ? ` +${colabsT.length}` : ''}</span>
                                            </div>
                                        </td>
                                        <td style={td}>
                                            <div>{a.cliente}</div>
                                            {a.cliente_registrado_por_nombre && (
                                                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3, fontSize:10, color:tk.txt3 }}>
                                                    {a.cliente_registrado_por_iniciales && (
                                                        <span style={{ width:16, height:16, borderRadius:'50%', background:a.cliente_registrado_por_color || '#10b981', color:'#fff', fontSize:8, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                                                            {a.cliente_registrado_por_iniciales}
                                                        </span>
                                                    )}
                                                    <span>Cliente de {a.cliente_registrado_por_nombre}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ ...td, fontWeight:700, color:'#10b981' }}>{fmtUSD(a.monto, moneda)}</td>
                                        <td style={td}><PrioBadge prioridad={a.prioridad} /></td>
                                        <td style={td}>
                                            <select value={a.estado} onChange={e => changeEstado(a.id, e.target.value)}
                                                style={{ border:`1px solid ${tk.bdr}`, borderRadius:6, padding:'4px 8px', fontSize:12, background:tk.card, color:tk.txt, cursor:'pointer' }}>
                                                {(TIPOS_CON_RESULTADO.includes(a.tipo)
                                                    ? ['Pendiente','En Progreso','Completado','Ganada','Perdida']
                                                    : ESTADOS
                                                ).map(e => <option key={e}>{e}</option>)}
                                            </select>
                                        </td>
                                        <td style={td}>{a.mes}</td>
                                        <td style={td}>
                                            {inicio ? (
                                                <span style={{ fontSize:12, color: tk.txt2 }}>{inicio}</span>
                                            ) : <span style={{ color: tk.txt3 }}>—</span>}
                                        </td>
                                        <td style={td}>
                                            {finEst ? (
                                                <span style={{ fontSize:12, color: finEst < new Date() && a.estado !== 'Completado' ? '#e74c3c' : tk.txt2 }}>
                                                    {finEst.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                                                </span>
                                            ) : <span style={{ color: tk.txt3 }}>—</span>}
                                        </td>
                                        <td style={td}>
                                            <div style={{ display:'flex', gap:4 }}>
                                                <button onClick={() => setModal({ open:true, actividad:a })} style={iconBtn} title="Editar">✏️</button>
                                                {puedeEliminar && (
                                                    <button onClick={() => setConfirmId(a.id)} style={iconBtn} title="Eliminar">🗑</button>
                                                )}
                                                {a.estado === 'Ganada' && (
                                                    <button onClick={() => setCalcModal({ open:true, actividad:a })} style={{ ...iconBtn, color:'#27ae60', borderColor:'#27ae6044' }} title="Ver comisión">🧮</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!filtered.length && <tr><td colSpan={12} style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin actividades</td></tr>}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop:`2px solid ${tk.bdr}`, background:tk.card2 }}>
                                <td colSpan={5} style={{ padding:'10px 10px', fontSize:12, color:tk.txt2, fontWeight:600 }}>{filtered.length} actividades · {filtered.filter(a=>a.estado==='Completado').length} completadas</td>
                                <td style={{ padding:'10px', fontWeight:700, color:'#10b981' }}>{fmtUSD(totalMonto, moneda)}</td>
                                <td colSpan={6} />
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                </div>
            )}

            {/* Vista Kanban */}
            {view === 'kanban' && (
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? KANBAN_COLS.map(c => collapsedCols.has(c) ? '40px' : '260px').join(' ') : KANBAN_COLS.map(c => collapsedCols.has(c) ? '40px' : '1fr').join(' '), gap:14, overflowX:isMobile ? 'auto' : 'visible', paddingBottom:isMobile ? 8 : 0 }}>
                    {KANBAN_COLS.map(col => {
                        const colActs = filtered.filter(a => a.estado === col);
                        const isCollapsed = collapsedCols.has(col);
                        if (isCollapsed) {
                            return (
                                <div key={col}
                                    onClick={() => toggleCol(col)}
                                    onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                                    onDragLeave={e => { if (e.currentTarget === e.target) setDragOverCol(null); }}
                                    onDrop={e => { e.preventDefault(); handleDrop(col); }}
                                    title={`Expandir ${col}`}
                                    style={{ background: dragOverCol === col ? `${COL_COLOR[col]}44` : COL_COLOR[col], borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0', gap:8, minHeight:200, outline: dragOverCol === col ? `2px dashed ${COL_COLOR[col]}` : 'none' }}>
                                    <span style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', letterSpacing:1 }}>{col}</span>
                                    <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:12, padding:'2px 8px', fontSize:11 }}>{colActs.length}</span>
                                </div>
                            );
                        }
                        return (
                            <div key={col}>
                                <div onClick={() => toggleCol(col)}
                                    title="Colapsar"
                                    style={{ padding:'8px 12px', borderRadius:'8px 8px 0 0', background: COL_COLOR[col], color:'#fff', fontWeight:700, fontSize:13, display:'flex', justifyContent:'space-between', cursor:'pointer' }}>
                                    <span>{col}</span><span>{colActs.length}</span>
                                </div>
                                <div
                                    onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                                    onDragLeave={e => { if (e.currentTarget === e.target) setDragOverCol(null); }}
                                    onDrop={e => { e.preventDefault(); handleDrop(col); }}
                                    style={{ background: dragOverCol === col ? `${COL_COLOR[col]}22` : tk.bg, borderRadius:'0 0 8px 8px', padding:8, minHeight:200, display:'flex', flexDirection:'column', gap:8, transition:'background 0.15s', outline: dragOverCol === col ? `2px dashed ${COL_COLOR[col]}` : 'none' }}>
                                    {colActs.map(a => {
                                        const v = vendedores.find(x => x.id === a.vendedor_id);
                                        const _cols = parseArr(a.colaboradores).filter(id => id !== a.vendedor_id);
                                        const colabs = _cols.map(id => vendedores.find(x => x.id === id)).filter(Boolean);
                                        return (
                                            <div key={a.id} onClick={() => setModal({ open:true, actividad:a })}
                                                draggable
                                                onDragStart={e => { setDragId(a.id); e.dataTransfer.effectAllowed = 'move'; }}
                                                onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                                                style={{ background:tk.card, borderRadius:8, padding:'12px 14px', cursor: dragId === a.id ? 'grabbing' : 'grab', boxShadow:tk.shadow, borderLeft:`3px solid ${COL_COLOR[col]}`, opacity: dragId === a.id ? 0.4 : 1 }}>
                                                <div style={{ fontWeight:600, fontSize:13, marginBottom:6, color:tk.txt }}>{a.nombre}</div>
                                                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                                                    <TipoBadge tipo={a.tipo} />
                                                    <PrioBadge prioridad={a.prioridad} />
                                                </div>
                                                <div style={{ fontSize:12, color:tk.txt2, marginBottom:6 }}>{a.cliente} · {fmtUSD(a.monto, moneda)}</div>
                                                {a.cliente_registrado_por_nombre && (
                                                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:tk.txt3, marginBottom:6 }}>
                                                        {a.cliente_registrado_por_iniciales && (
                                                            <span style={{ width:16, height:16, borderRadius:'50%', background:a.cliente_registrado_por_color || '#10b981', color:'#fff', fontSize:8, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                                                                {a.cliente_registrado_por_iniciales}
                                                            </span>
                                                        )}
                                                        <span>Cliente de {a.cliente_registrado_por_nombre}</span>
                                                    </div>
                                                )}
                                                {a.fecha && (
                                                    <div style={{ fontSize:11, color: tk.txt3, marginBottom:6 }}>
                                                        Inicio: {fmtDateShort(a.fecha)}
                                                    </div>
                                                )}
                                                {a.fecha_fin && (() => {
                                                    const fEst = new Date(String(a.fecha_fin).slice(0,10) + 'T12:00:00');
                                                    const vencida = fEst < new Date() && a.estado !== 'Completado';
                                                    return (
                                                        <div style={{ fontSize:11, color: vencida ? '#e74c3c' : tk.txt3, marginBottom:6 }}>
                                                            Fin estimado: {fEst.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                                                        </div>
                                                    );
                                                })()}
                                                {a.estado === 'Ganada' && (() => { const { util, margen } = miniCalc(a); return (
                                                    <div style={{ display:'flex', gap:5, marginBottom:7 }}>
                                                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:'#27ae6018', color:'#27ae60' }}>
                                                            {fmtUSD(util, moneda)}
                                                        </span>
                                                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background: margen >= 15 ? '#10b98118' : '#e74c3c18', color: margen >= 15 ? '#10b981' : '#e74c3c' }}>
                                                            {margen.toFixed(1)}% margen
                                                        </span>
                                                    </div>
                                                ); })()}
                                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                        <div style={{ display:'flex' }}>
                                                            <div style={{ position:'relative', zIndex: colabs.length + 1 }}><Avatar vendedor={v} /></div>
                                                            {colabs.map((c, idx) => (
                                                                <div key={c.id} title={c.nombre} style={{ marginLeft:-8, position:'relative', zIndex: colabs.length - idx, border:`2px solid ${tk.card}`, borderRadius:'50%' }}>
                                                                    <Avatar vendedor={c} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span style={{ fontSize:11, color:tk.txt3 }}>
                                                            {v?.nombre}{colabs.length ? ` +${colabs.length}` : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                        {a.estado === 'Ganada' && (
                                                            <button onClick={e => { e.stopPropagation(); setCalcModal({ open:true, actividad:a }); }}
                                                                style={{ background:'#27ae6018', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, padding:'2px 5px' }} title="Ver comisión">🧮</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal actividad */}
            <ActividadModal
                open={modal.open}
                actividad={modal.actividad}
                vendedores={vendedores}
                onClose={() => setModal({ open:false, actividad:null })}
                onSave={handleSave}
            />

            <ComisionModal
                open={calcModal.open}
                actividad={actividades.find(a => a.id === calcModal.actividad?.id) || calcModal.actividad}
                vendedor={vendedores.find(v => v.id === calcModal.actividad?.vendedor_id)}
                moneda={moneda}
                onClose={() => setCalcModal({ open:false, actividad:null })}
                onSave={async data => {
                    const updated = await handleSave(data);
                    setCalcModal(prev => ({ ...prev, actividad: { ...prev.actividad, ...updated } }));
                    return updated;
                }}
            />

            {/* Modal confirmar eliminar */}
            {confirmId && (
                <div onClick={() => setConfirmId(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background:tk.card, borderRadius:12, padding:24, maxWidth:320, boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
                        <div style={{ fontWeight:700, marginBottom:10, color:tk.txt }}>¿Eliminar actividad?</div>
                        <div style={{ fontSize:13, color:tk.txt2, marginBottom:18 }}>
                            {actividades.find(a => a.id === confirmId)?.nombre}
                        </div>
                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                            <button onClick={() => setConfirmId(null)} style={btnSec}>Cancelar</button>
                            <button onClick={() => handleDelete(confirmId)} style={{ ...btnPri, background:'#e74c3c' }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

