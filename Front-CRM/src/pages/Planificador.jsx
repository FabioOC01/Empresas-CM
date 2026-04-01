import { useState, useEffect, useRef } from 'react';
import { getVendedores, createActividad, updateActividad, deleteActividad, updateElapsed } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, fmt, TIPOS, ESTADOS, PRIORIDADES, MESES } from '../utils/crm';
import Avatar from '../components/Avatar';
import { TipoBadge, EstadoBadge, PrioBadge } from '../components/Badge';
import ActividadModal from '../components/ActividadModal';

const KANBAN_COLS = ['Pendiente','En Progreso','Completado','Cancelado'];
const COL_COLOR = { 'Pendiente':'#e67e22','En Progreso':'#2f6fd4','Completado':'#27ae60','Cancelado':'#e74c3c' };

export default function Planificador() {
    const { actividades, setActividades } = useActividades();
    const [vendedores, setVendedores] = useState([]);
    const [view, setView] = useState('tabla');
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [confirmId, setConfirmId] = useState(null);
    const [filters, setFilters] = useState({ vendedorId:'', trimestre:'', mes:'', tipo:'', estado:'', prioridad:'', buscar:'' });
    const ticksRef = useRef(0);

    useEffect(() => { getVendedores().then(setVendedores); }, []);

    // Timer: tick en memoria, flush a DB cada 60s
    useEffect(() => {
        const t = setInterval(() => {
            ticksRef.current++;
            setActividades(prev => prev.map(a =>
                a.estado === 'En Progreso' ? { ...a, elapsed: (a.elapsed || 0) + 1 } : a
            ));
            if (ticksRef.current % 60 === 0) {
                actividades.filter(a => a.estado === 'En Progreso').forEach(a =>
                    updateElapsed(a.id, a.elapsed).catch(() => {})
                );
            }
        }, 1000);
        return () => clearInterval(t);
    }, [actividades, setActividades]);

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
        vendedorId: filters.vendedorId || undefined,
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

    const totalMonto = filtered.reduce((s,a) => s + Number(a.monto), 0);

    return (
        <div>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ display:'flex', gap:6 }}>
                    {['tabla','kanban'].map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                            padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                            background: view === v ? '#2f6fd4' : '#f0f2f5', color: view === v ? '#fff' : '#1e2a3b',
                        }}>{v === 'tabla' ? '📋 Tabla' : '🗂 Kanban'}</button>
                    ))}
                </div>
                <button onClick={() => setModal({ open:true, actividad:null })} style={btnPri}>+ Nueva actividad</button>
            </div>

            {/* Mini stats */}
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
                {[
                    ['Total', filtered.length, '#2f6fd4'],
                    ['Monto', fmtUSD(totalMonto), '#27ae60'],
                    ['Completadas', filtered.filter(a=>a.estado==='Completado').length, '#8e44ad'],
                    ['En Progreso', filtered.filter(a=>a.estado==='En Progreso').length, '#e67e22'],
                    ['Alta prioridad', filtered.filter(a=>a.prioridad==='Alta'&&a.estado!=='Completado').length, '#e74c3c'],
                ].map(([label, val, color]) => (
                    <div key={label} style={{ background:'#fff', borderRadius:8, padding:'10px 26px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderLeft:`3px solid ${color}` }}>
                        <div style={{ fontSize:11, color:'#6b7a8d', fontWeight:600 }}>{label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:'#1e2a3b' }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                <input placeholder="Buscar cliente o actividad..." style={{ ...sel, minWidth:220 }}
                    value={filters.buscar} onChange={e => setF('buscar', e.target.value)} />
                {[
                    ['vendedorId', [['','Vendedor'],...vendedores.map(v=>[v.id,v.nombre])]],
                    ['trimestre',  [['','Trimestre'],...['1','2','3','4'].map(q=>[q,`Q${q}`])]],
                    ['mes',        [['','Mes'],...MESES.map(m=>[m,m])]],
                    ['tipo',       [['','Tipo'],...TIPOS.map(t=>[t,t])]],
                    ['estado',     [['','Estado'],...ESTADOS.map(e=>[e,e])]],
                    ['prioridad',  [['','Prioridad'],...PRIORIDADES.map(p=>[p,p])]],
                ].map(([key, opts]) => (
                    <select key={key} style={sel} value={filters[key]} onChange={e => setF(key, e.target.value)}>
                        {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                ))}
                {Object.values(filters).some(Boolean) &&
                    <button onClick={() => setFilters({ vendedorId:'',trimestre:'',mes:'',tipo:'',estado:'',prioridad:'',buscar:'' })}
                        style={{ padding:'7px 12px', borderRadius:7, border:'1px solid #dde1e8', background:'#fff', cursor:'pointer', fontSize:12, color:'#e74c3c' }}>
                        Limpiar
                    </button>
                }
            </div>

            {/* Vista Tabla */}
            {view === 'tabla' && (
                <div style={{ background:'#fff', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                            <tr style={{ borderBottom:'2px solid #eee', background:'#f8f9fb' }}>
                                {['','Actividad','Tipo','Vendedor','Cliente','Monto','Prioridad','Estado','Mes','Tiempo',''].map((h,i) =>
                                    <th key={i} style={{ padding:'10px 10px', textAlign:'left', color:'#6b7a8d', fontWeight:600, fontSize:11 }}>{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const v = vendedores.find(x => x.id === a.vendedor_id);
                                return (
                                    <tr key={a.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                                        <td style={{ padding:'0 0 0 4px', width:4 }}>
                                            <div style={{ width:3, height:36, borderRadius:2, background: COL_COLOR[a.estado] || '#ccc' }} />
                                        </td>
                                        <td style={td}><div style={{ fontWeight:600 }}>{a.nombre}</div><div style={{ fontSize:11, color:'#aaa' }}>{a.notas}</div></td>
                                        <td style={td}><TipoBadge tipo={a.tipo} /></td>
                                        <td style={td}><div style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar vendedor={v} /><span>{v?.nombre}</span></div></td>
                                        <td style={td}>{a.cliente}</td>
                                        <td style={{ ...td, fontWeight:700, color:'#2f6fd4' }}>{fmtUSD(a.monto)}</td>
                                        <td style={td}><PrioBadge prioridad={a.prioridad} /></td>
                                        <td style={td}>
                                            <select value={a.estado} onChange={e => changeEstado(a.id, e.target.value)}
                                                style={{ border:'1px solid #dde1e8', borderRadius:6, padding:'4px 8px', fontSize:12, background:'#fff', cursor:'pointer' }}>
                                                {ESTADOS.map(e => <option key={e}>{e}</option>)}
                                            </select>
                                        </td>
                                        <td style={td}>{a.mes}</td>
                                        <td style={td}><span style={{ fontFamily:'monospace', fontSize:12, color:'#6b7a8d' }}>{fmt(a.elapsed||0)}</span></td>
                                        <td style={td}>
                                            <div style={{ display:'flex', gap:4 }}>
                                                <button onClick={() => setModal({ open:true, actividad:a })} style={iconBtn} title="Editar">✏️</button>
                                                <button onClick={() => setConfirmId(a.id)} style={iconBtn} title="Eliminar">🗑</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!filtered.length && <tr><td colSpan={11} style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin actividades</td></tr>}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop:'2px solid #eee', background:'#f8f9fb' }}>
                                <td colSpan={5} style={{ padding:'10px 10px', fontSize:12, color:'#6b7a8d', fontWeight:600 }}>{filtered.length} actividades · {filtered.filter(a=>a.estado==='Completado').length} completadas</td>
                                <td style={{ padding:'10px', fontWeight:700, color:'#2f6fd4' }}>{fmtUSD(totalMonto)}</td>
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
                                <div style={{ background:'#f0f2f5', borderRadius:'0 0 8px 8px', padding:8, minHeight:200, display:'flex', flexDirection:'column', gap:8 }}>
                                    {colActs.map(a => {
                                        const v = vendedores.find(x => x.id === a.vendedor_id);
                                        return (
                                            <div key={a.id} onClick={() => setModal({ open:true, actividad:a })}
                                                style={{ background:'#fff', borderRadius:8, padding:'12px 14px', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', borderLeft:`3px solid ${COL_COLOR[col]}` }}>
                                                <div style={{ fontWeight:600, fontSize:13, marginBottom:6 }}>{a.nombre}</div>
                                                <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                                                    <TipoBadge tipo={a.tipo} />
                                                    <PrioBadge prioridad={a.prioridad} />
                                                </div>
                                                <div style={{ fontSize:12, color:'#6b7a8d', marginBottom:6 }}>{a.cliente} · {fmtUSD(a.monto)}</div>
                                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar vendedor={v} /><span style={{ fontSize:11, color:'#8899aa' }}>{v?.nombre}</span></div>
                                                    <span style={{ fontFamily:'monospace', fontSize:11, color:'#8899aa' }}>{fmt(a.elapsed||0)}</span>
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

            {/* Modal confirmar eliminar */}
            {confirmId && (
                <div onClick={() => setConfirmId(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:24, maxWidth:320, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
                        <div style={{ fontWeight:700, marginBottom:10 }}>¿Eliminar actividad?</div>
                        <div style={{ fontSize:13, color:'#6b7a8d', marginBottom:18 }}>
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

const sel = { padding:'7px 10px', borderRadius:7, border:'1px solid #dde1e8', fontSize:13, background:'#fff' };
const td = { padding:'10px 10px', color:'#2d3d52' };
const iconBtn = { padding:'4px 6px', border:'1px solid #eee', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:13 };
const btnPri = { padding:'9px 20px', background:'#2f6fd4', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
const btnSec = { padding:'9px 20px', background:'#f0f2f5', color:'#1e2a3b', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
