import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getVendedores, createActividad, updateActividad, deleteActividad } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useRolFilter from '../hooks/useRolFilter';
import { filterActs, fmtUSD, fmt, calcDuration, parseGastos, TIPOS, ESTADOS, TODOS_ESTADOS, PRIORIDADES, TIPOS_CON_RESULTADO } from '../utils/crm';
import Avatar from '../components/Avatar';
import { TipoBadge, PrioBadge } from '../components/Badge';
import ActividadModal from '../components/ActividadModal';
import ComisionModal from '../components/ComisionModal';
import PeriodoPicker from '../components/PeriodoPicker';

const KANBAN_COLS = ['Pendiente','En Progreso','Completado','Cancelado'];
const COL_COLOR = { 'Pendiente':'#e67e22','En Progreso':'#10b981','Completado':'#27ae60','Cancelado':'#e74c3c' };

function parseArr(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
}

export default function Planificador() {
    const { actividades, config } = useActividades();
    const { user } = useAuth();
    const puedeEliminar = user?.is_superadmin || user?.roles?.some(r => ['Admin','Gerencia'].includes(r));
    const tk = useTheme();
    const sel    = { padding:'7px 10px', borderRadius:7, border:`1px solid ${tk.bdr}`, fontSize:13, background:tk.card, color:tk.txt };
    const td     = { padding:'10px 10px', color:tk.txt };
    const iconBtn = { padding:'4px 6px', border:`1px solid ${tk.bdr}`, borderRadius:6, background:tk.card, cursor:'pointer', fontSize:13 };
    const btnPri  = { padding:'9px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
    const btnSec  = { padding:'9px 20px', background:tk.card2, color:tk.txt, border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
    const moneda     = config?.moneda || 'USD';
    const tipos      = config?.tipos_actividad || TIPOS;
    const tasa_sunat = parseFloat(config?.tasa_sunat) || 0;

    const miniCalc = (a) => {
        const fact  = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
        const costo = (parseFloat(a.costo_base) || 0)
            + parseGastos(a.gastos_operativos).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)
            + fact * tasa_sunat;
        const util   = fact - costo;
        const margen = fact > 0 ? (util / fact) * 100 : 0;
        return { util, margen };
    };
    const vendedorForzado = useRolFilter(); // null = ve todo, string = solo su id
    const [searchParams] = useSearchParams();
    const [vendedores, setVendedores] = useState([]);
    const [view, setView] = useState(searchParams.get('view') === 'kanban' ? 'kanban' : 'tabla');
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [confirmId,  setConfirmId]  = useState(null);
    const [calcModal,  setCalcModal]  = useState({ open:false, actividad:null });
    const [filters, setFilters] = useState({ vendedorId:'', trimestre:'', mes:'', tipo:'', estado:'', prioridad:'', buscar:'' });
    const [now, setNow] = useState(Date.now());
    const [dragId, setDragId] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
    useEffect(() => { getVendedores().then(setVendedores); }, []);

    // Teclado: N = nueva actividad
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))
                setModal({ open: true, actividad: null });
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const filtered = filterActs(actividades, {
        vendedorId: vendedorForzado || filters.vendedorId || undefined,
        trimestre:  filters.trimestre  || undefined,
        mes:        filters.mes        || undefined,
        tipo:       filters.tipo       || undefined,
        estado:     filters.estado     || undefined,
        prioridad:  filters.prioridad  || undefined,
        cliente:    filters.buscar     || undefined,
    });

    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

    // No actualizamos estado manualmente — el socket broadcast lo hace para todos los clientes
    const handleSave = async (data) => {
        if (data.id && actividades.find(a => a.id === data.id)) {
            await updateActividad(data.id, data);
        } else {
            await createActividad(data);
        }
    };

    const handleDelete = async (id) => {
        await deleteActividad(id);
        setConfirmId(null);
    };

    const changeEstado = async (id, estado) => {
        await updateActividad(id, { estado });
    };

    const handleDrop = async (col) => {
        const id = dragId;
        setDragId(null);
        setDragOverCol(null);
        if (!id) return;
        const act = actividades.find(a => a.id === id);
        if (!act || act.estado === col) return;
        await updateActividad(id, { estado: col });
    };

    const totalMonto = filtered.reduce((s,a) => s + Number(a.monto), 0);

    return (
        <div>
            {/* Header + Mini stats en una sola fila */}
            <div style={{ display:'flex', alignItems:'center', marginBottom:20, gap:10 }}>
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
                <div style={{ display:'flex', gap:8, flex:1, justifyContent:'center', flexWrap:'wrap' }}>
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
                <button onClick={() => setModal({ open:true, actividad:null })} style={{ ...btnPri, flexShrink:0 }}>+ Nueva actividad</button>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                <input placeholder="Buscar cliente o actividad..." style={{ ...sel, minWidth:220 }}
                    value={filters.buscar} onChange={e => setF('buscar', e.target.value)} />
                <PeriodoPicker
                    trim={filters.trimestre} mes={filters.mes}
                    onTrim={t => setF('trimestre', t)} onMes={m => setF('mes', m)}
                />
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
                {Object.values(filters).some(Boolean) &&
                    <button onClick={() => setFilters({ vendedorId:'',trimestre:'',mes:'',tipo:'',estado:'',prioridad:'',buscar:'' })}
                        style={{ padding:'7px 12px', borderRadius:7, border:`1px solid ${tk.bdr}`, background:tk.card, cursor:'pointer', fontSize:12, color:'#e74c3c' }}>
                        Limpiar
                    </button>
                }
            </div>

            {/* Vista Tabla */}
            {view === 'tabla' && (
                <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                            <tr style={{ borderBottom:`2px solid ${tk.bdr}`, background:tk.card2 }}>
                                {['','Actividad','Tipo','Vendedor','Cliente','Monto','Prioridad','Estado','Mes','Tiempo',''].map((h,i) =>
                                    <th key={i} style={{ padding:'10px 10px', textAlign:'left', color:tk.txt2, fontWeight:600, fontSize:11 }}>{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const v = vendedores.find(x => x.id === a.vendedor_id);
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
                                        <td style={td}><div style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar vendedor={v} /><span>{v?.nombre}</span></div></td>
                                        <td style={td}>{a.cliente}</td>
                                        <td style={{ ...td, fontWeight:700, color:'#10b981' }}>{fmtUSD(a.monto, moneda)}</td>
                                        <td style={td}><PrioBadge prioridad={a.prioridad} /></td>
                                        <td style={td}>
                                            <select value={a.estado} onChange={e => changeEstado(a.id, e.target.value)}
                                                style={{ border:`1px solid ${tk.bdr}`, borderRadius:6, padding:'4px 8px', fontSize:12, background:tk.card, color:tk.txt, cursor:'pointer' }}>
                                                {(TIPOS_CON_RESULTADO.includes(a.tipo)
                                                    ? ['Pendiente','En Progreso','Completado','Ganada','Perdida','Cancelado']
                                                    : ESTADOS
                                                ).map(e => <option key={e}>{e}</option>)}
                                            </select>
                                        </td>
                                        <td style={td}>{a.mes}</td>
                                        <td style={td}><span style={{ fontFamily:'monospace', fontSize:12, color:'#6b7a8d' }}>{fmt(calcDuration(a, now))}</span></td>
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
                            {!filtered.length && <tr><td colSpan={11} style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin actividades</td></tr>}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop:`2px solid ${tk.bdr}`, background:tk.card2 }}>
                                <td colSpan={5} style={{ padding:'10px 10px', fontSize:12, color:tk.txt2, fontWeight:600 }}>{filtered.length} actividades · {filtered.filter(a=>a.estado==='Completado').length} completadas</td>
                                <td style={{ padding:'10px', fontWeight:700, color:'#10b981' }}>{fmtUSD(totalMonto, moneda)}</td>
                                <td colSpan={5} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Vista Kanban */}
            {view === 'kanban' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
                    {KANBAN_COLS.map(col => {
                        const colActs = filtered.filter(a => a.estado === col);
                        return (
                            <div key={col}>
                                <div style={{ padding:'8px 12px', borderRadius:'8px 8px 0 0', background: COL_COLOR[col], color:'#fff', fontWeight:700, fontSize:13, display:'flex', justifyContent:'space-between' }}>
                                    <span>{col}</span><span>{colActs.length}</span>
                                </div>
                                <div
                                    onDragOver={e => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                                    onDragLeave={e => { if (e.currentTarget === e.target) setDragOverCol(null); }}
                                    onDrop={e => { e.preventDefault(); handleDrop(col); }}
                                    style={{ background: dragOverCol === col ? `${COL_COLOR[col]}22` : tk.bg, borderRadius:'0 0 8px 8px', padding:8, minHeight:200, display:'flex', flexDirection:'column', gap:8, transition:'background 0.15s', outline: dragOverCol === col ? `2px dashed ${COL_COLOR[col]}` : 'none' }}>
                                    {colActs.map(a => {
                                        const v = vendedores.find(x => x.id === a.vendedor_id);
                                        const _chk = parseArr(a.checklist);
                                        const _cols = parseArr(a.colaboradores);
                                        const _chkIds = _chk.map(it => it && it.vendedor_id).filter(Boolean);
                                        const _colabIds = [...new Set([..._cols, ..._chkIds])].filter(id => id !== a.vendedor_id);
                                        const colabs = _colabIds.map(id => vendedores.find(x => x.id === id)).filter(Boolean);
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
                                                        <span style={{ fontFamily:'monospace', fontSize:11, color:tk.txt3 }}>{fmt(calcDuration(a, now))}</span>
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
                actividad={calcModal.actividad}
                vendedor={vendedores.find(v => v.id === calcModal.actividad?.vendedor_id)}
                moneda={moneda}
                onClose={() => setCalcModal({ open:false, actividad:null })}
                onSave={updated => setCalcModal(prev => ({ ...prev, actividad: { ...prev.actividad, ...updated } }))}
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

