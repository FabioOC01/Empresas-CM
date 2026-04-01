import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getVendedores, updateRoles, createActividad } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, fmt, TIPOS, MESES, ROLES, TYPE_COLOR, TYPE_ICON } from '../utils/crm';
import ActividadModal from '../components/ActividadModal';
import { RolBadge } from '../components/Badge';

const ESTADO_COLOR = { 'Pendiente':'#e67e22','En Progreso':'#2f6fd4','Completado':'#27ae60','Cancelado':'#e74c3c' };
const TIPO_COLORS  = ['#2f6fd4','#27ae60','#e67e22','#8e44ad','#e74c3c','#1abc9c','#e91e63','#4caf50','#ff9800','#9c27b0'];
const GRUPOS_MATRIZ = [
    { label: 'VENTAS',    color: '#2f6fd4', tipos: ['Venta','Propuesta','Cotización','Oportunidad','Homologación','Visita','Seguimiento'] },
    { label: 'MARKETING', color: '#8e44ad', tipos: ['Publicidad','Piezas gráficas'] },
    { label: 'ADMIN',     color: '#6b7a8d', tipos: ['Administrativa'] },
];

const isMarketing = (v) => v?.roles?.includes('Marketing') && !v?.roles?.some(r => ['Ventas','Gerencia','Retail'].includes(r));

export default function Equipo() {
    const { actividades, setActividades } = useActividades();
    const [vendedores, setVendedores] = useState([]);
    const [trim, setTrim]     = useState('');
    const [mes, setMes]       = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fTipo, setFTipo]   = useState('');
    const [editRolId, setEditRolId] = useState(null);
    const [rolDraft, setRolDraft]   = useState([]);
    const [modal, setModal] = useState({ open: false, actividad: null });

    useEffect(() => { getVendedores().then(setVendedores); }, []);

    const filtered = filterActs(actividades, {
        trimestre: trim || undefined,
        mes:       mes  || undefined,
        estado:    fEstado || undefined,
        tipo:      fTipo   || undefined,
    });

    // Vendors rankeados por monto cerrado (ignorando Marketing-only)
    const vendRanked = [...vendedores].sort((a, b) => {
        const mA = actividades.filter(x => x.vendedor_id === a.id && x.estado === 'Completado').reduce((s,x) => s + Number(x.monto), 0);
        const mB = actividades.filter(x => x.vendedor_id === b.id && x.estado === 'Completado').reduce((s,x) => s + Number(x.monto), 0);
        return mB - mA;
    });

    // Avance general
    const totalActs = filtered.length;
    const pctGlobal = totalActs ? Math.round(filtered.filter(a => a.estado === 'Completado').length / totalActs * 100) : 0;
    const avanceData = ['Completado','En Progreso','Pendiente','Cancelado'].map(e => ({
        name: e, value: filtered.filter(a => a.estado === e).length,
    }));

    // Alta prioridad pendiente (top 5)
    const altasPendientes = [...filtered]
        .filter(a => a.prioridad === 'Alta' && ['Pendiente','En Progreso'].includes(a.estado))
        .sort((a,b) => b.monto - a.monto)
        .slice(0, 5);

    // Charts
    const byVendCerrado = vendedores
        .filter(v => !isMarketing(v))
        .map(v => ({
            name: v.nombre.split(' ')[0],
            color: v.color,
            Monto: filtered.filter(a => a.vendedor_id === v.id && a.estado === 'Completado').reduce((s,a) => s + Number(a.monto), 0),
        })).filter(x => x.Monto > 0);

    const byTipo = TIPOS.map(t => ({ name: t, value: filtered.filter(a => a.tipo === t).length })).filter(x => x.value > 0);

    const trend = MESES.map(m => {
        const entry = { name: m };
        vendedores.forEach(v => { entry[v.nombre.split(' ')[0]] = actividades.filter(a => a.vendedor_id === v.id && a.mes === m).length; });
        return entry;
    }).filter(row => vendedores.some(v => row[v.nombre.split(' ')[0]] > 0));


    // Edición de roles
    const openRolEdit = (v) => { setEditRolId(v.id); setRolDraft([...v.roles]); };
    const saveRoles = async (id) => {
        if (!rolDraft.length) return;
        const updated = await updateRoles(id, rolDraft);
        setVendedores(prev => prev.map(v => v.id === id ? { ...v, roles: updated.roles } : v));
        setEditRolId(null);
    };
    const toggleRol = (r) => setRolDraft(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

    // Nueva actividad
    const handleSave = async (data) => {
        await createActividad(data);
    };

    return (
        <div>
            {/* Topbar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select style={sel} value={trim} onChange={e => setTrim(e.target.value)}>
                        <option value="">Todos los períodos</option>
                        {['1','2','3','4'].map(q => <option key={q} value={q}>Q{q}</option>)}
                    </select>
                    <select style={sel} value={mes} onChange={e => setMes(e.target.value)}>
                        <option value="">Todos los meses</option>
                        {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => setModal({ open:true, actividad:null })} style={btnPri}>+ Nueva Actividad</button>
                </div>
            </div>

            {/* Hero cards */}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${vendRanked.length},1fr)`, gap:14, marginBottom:20 }}>
                {vendRanked.map((v, i) => {
                    const vActs  = filtered.filter(a => a.vendedor_id === v.id);
                    const cerr   = vActs.filter(a => a.estado === 'Completado');
                    const pct    = vActs.length ? Math.round(cerr.length / vActs.length * 100) : 0;
                    const montoC = cerr.reduce((s,a) => s + Number(a.monto), 0);
                    const montoT = vActs.reduce((s,a) => s + Number(a.monto), 0);
                    const mkt    = isMarketing(v);
                    return (
                        <div key={v.id} style={{ background:'#fff', borderRadius:10, padding:'16px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', textAlign:'center', position:'relative' }}>
                            {i < 2 && (
                                <div style={{ position:'absolute', top:10, right:10, fontSize:18 }}>
                                    {i === 0 ? '🥇' : '🥈'}<span style={{ fontSize:11, fontWeight:700, color:'#6b7a8d' }}>#{i+1}</span>
                                </div>
                            )}
                            {i >= 2 && <div style={{ position:'absolute', top:10, right:10, fontSize:11, color:'#8899aa', fontWeight:600 }}>#{i+1}</div>}

                            <div style={{ width:56, height:56, borderRadius:'50%', background:v.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, margin:'0 auto 8px' }}>
                                {v.iniciales}
                            </div>
                            <div style={{ fontWeight:700, fontSize:14, color:'#1e2a3b' }}>{v.nombre}</div>
                            <div style={{ fontSize:11, color:'#8899aa', marginBottom:8 }}>Ejecutivo de Ventas</div>

                            <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap', marginBottom:10 }}>
                                {v.roles?.map(r => <RolBadge key={r} rol={r} />)}
                                <button onClick={() => openRolEdit(v)} style={{ padding:'1px 6px', borderRadius:10, border:'1px dashed #ccc', background:'none', cursor:'pointer', fontSize:10, color:'#6b7a8d' }}>✏️</button>
                            </div>

                            <div style={{ height:4, background:'#eee', borderRadius:2, marginBottom:12 }}>
                                <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background:v.color, transition:'width 0.4s' }} />
                            </div>

                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:10 }}>
                                {[['TOTAL', vActs.length], ['CERRADO', cerr.length], ['AVANCE', `${pct}%`]].map(([l,val]) => (
                                    <div key={l}>
                                        <div style={{ fontSize:18, fontWeight:800, color:'#1e2a3b' }}>{val}</div>
                                        <div style={{ fontSize:9, color:'#8899aa', textTransform:'uppercase', letterSpacing:0.5 }}>{l}</div>
                                    </div>
                                ))}
                            </div>

                            {mkt ? (
                                <div style={{ fontSize:11, color:'#8899aa' }}>Sin manejo de montos</div>
                            ) : (
                                <>
                                    <div style={{ fontSize:16, fontWeight:800, color:'#2f6fd4' }}>{fmtUSD(montoC)}</div>
                                    <div style={{ fontSize:11, color:'#8899aa' }}>de {fmtUSD(montoT)}</div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Matriz + Avance general */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:20 }}>
                {/* Matriz */}
                <div style={card}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                        <div style={ct}>Matriz de Actividades por Vendedor</div>
                        <span style={{ fontSize:11, color:'#8899aa' }}>Cantidad · Monto USD</span>
                    </div>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                                <tr style={{ borderBottom:'2px solid #eee' }}>
                                    <th style={{ ...th, width:'30%' }}>VENDEDOR</th>
                                    {GRUPOS_MATRIZ.map(g => (
                                        <th key={g.label} style={{ ...th, textAlign:'center', color: g.color }}>
                                            {g.label}
                                            <div style={{ fontSize:9, color:'#aaa', fontWeight:400, marginTop:1 }}>
                                                {g.tipos.filter(t => filtered.some(a => a.tipo === t)).join(' · ') || g.tipos.slice(0,2).join(' · ')}
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ ...th, textAlign:'center' }}>TOTAL</th>
                                    <th style={{ ...th, textAlign:'center' }}>MONTO TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendedores.map(v => {
                                    const vActs = filtered.filter(a => a.vendedor_id === v.id);
                                    const mkt   = isMarketing(v);
                                    return (
                                        <tr key={v.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                                            <td style={{ padding:'10px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                    <div style={{ width:28, height:28, borderRadius:'50%', background:v.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{v.iniciales}</div>
                                                    <span style={{ fontWeight:600, color:'#1e2a3b' }}>{v.nombre}</span>
                                                </div>
                                            </td>
                                            {GRUPOS_MATRIZ.map(g => {
                                                const n = vActs.filter(a => g.tipos.includes(a.tipo)).length;
                                                const breakdown = g.tipos
                                                    .map(t => ({ t, n: vActs.filter(a => a.tipo === t).length }))
                                                    .filter(x => x.n > 0);
                                                return (
                                                    <td key={g.label} style={{ padding:'10px', textAlign:'center' }}>
                                                        {n > 0 ? (
                                                            <div>
                                                                <div style={{ fontWeight:800, fontSize:15, color: g.color }}>{n}</div>
                                                                <div style={{ fontSize:10, color:'#8899aa', marginTop:2 }}>
                                                                    {breakdown.map(x => `${x.t.split(' ')[0]} ${x.n}`).join(' · ')}
                                                                </div>
                                                            </div>
                                                        ) : <span style={{ color:'#ccc' }}>—</span>}
                                                    </td>
                                                );
                                            })}
                                            <td style={{ padding:'10px', textAlign:'center', fontWeight:800, color:'#1e2a3b' }}>{vActs.length}</td>
                                            <td style={{ padding:'10px', textAlign:'center', fontWeight:700, color: mkt ? '#8899aa' : '#2f6fd4' }}>
                                                {mkt ? '—' : fmtUSD(vActs.reduce((s,a) => s + Number(a.monto), 0))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop:'2px solid #eee', background:'#f8f9fb' }}>
                                    <td style={{ padding:'10px', fontWeight:700, color:'#1e2a3b' }}>TOTAL</td>
                                    {GRUPOS_MATRIZ.map(g => (
                                        <td key={g.label} style={{ padding:'10px', textAlign:'center', fontWeight:800, color: g.color }}>
                                            {filtered.filter(a => g.tipos.includes(a.tipo)).length || '—'}
                                        </td>
                                    ))}
                                    <td style={{ padding:'10px', textAlign:'center', fontWeight:800, color:'#1e2a3b' }}>{filtered.length}</td>
                                    <td style={{ padding:'10px', textAlign:'center', fontWeight:800, color:'#2f6fd4' }}>
                                        {fmtUSD(filtered.filter(a => !isMarketing(vendedores.find(x => x.id === a.vendedor_id))).reduce((s,a) => s + Number(a.monto), 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                </div>

                {/* Avance general + Alertas */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <div style={card}>
                        <div style={ct}>Avance General del Equipo</div>
                        <div style={{ position:'relative', height:160 }}>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={avanceData} cx="40%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value" startAngle={90} endAngle={-270}>
                                        {avanceData.map((e, i) => <Cell key={i} fill={ESTADO_COLOR[e.name] || '#eee'} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position:'absolute', top:'50%', left:'40%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                                <div style={{ fontSize:20, fontWeight:800, color:'#1e2a3b' }}>{pctGlobal}%</div>
                                <div style={{ fontSize:10, color:'#8899aa' }}>Completado</div>
                            </div>
                            <div style={{ position:'absolute', top:'50%', right:0, transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:6 }}>
                                {avanceData.map(e => (
                                    <div key={e.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                                        <div style={{ width:10, height:10, borderRadius:'50%', background:ESTADO_COLOR[e.name]||'#eee', flexShrink:0 }} />
                                        <span style={{ color:'#6b7a8d' }}>{e.name}</span>
                                        <span style={{ fontWeight:700, color:'#1e2a3b', marginLeft:'auto', paddingLeft:8 }}>{e.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={ct}>Prioridades Alta Pendientes</div>
                        {altasPendientes.length === 0 && <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'12px 0' }}>Sin alertas urgentes ✅</div>}
                        {altasPendientes.map(a => {
                            const v = vendedores.find(x => x.id === a.vendedor_id);
                            const mkt = isMarketing(v);
                            return (
                                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f5f5f5' }}>
                                    <span style={{ fontSize:16 }}>⚠️</span>
                                    <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:12, fontWeight:600, color:'#1e2a3b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.nombre}</div>
                                        <div style={{ fontSize:10, color:'#8899aa' }}>{v?.nombre.split(' ')[0]} · {a.mes}</div>
                                    </div>
                                    {!mkt && <div style={{ fontSize:12, fontWeight:700, color:'#2f6fd4', flexShrink:0 }}>{fmtUSD(a.monto)}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
                <div style={card}>
                    <div style={ct}>Montos Cerrados por Vendedor</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={byVendCerrado} margin={{ top:8, right:8, left:-10, bottom:0 }}>
                            <XAxis dataKey="name" tick={{ fontSize:11 }} />
                            <YAxis tick={{ fontSize:11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={v => fmtUSD(v)} />
                            <Bar dataKey="Monto" radius={[4,4,0,0]}>
                                {byVendCerrado.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Tipos de Actividad</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={byTipo} cx="50%" cy="55%" outerRadius={75} innerRadius={40} dataKey="value">
                                {byTipo.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize:10 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Tendencia Mensual</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={trend} margin={{ top:8, right:8, left:-10, bottom:0 }}>
                            <XAxis dataKey="name" tick={{ fontSize:11 }} />
                            <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize:10 }} />
                            {vendedores.map(v => (
                                <Line key={v.id} type="monotone" dataKey={v.nombre.split(' ')[0]} stroke={v.color} strokeWidth={2} dot={{ r:3 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tabla detalle */}
            <div style={card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <div style={ct}>Actividades del Equipo</div>
                    <div style={{ display:'flex', gap:8 }}>
                        <select style={sel} value={fEstado} onChange={e => setFEstado(e.target.value)}>
                            <option value="">Todos los estados</option>
                            {['Pendiente','En Progreso','Completado','Cancelado'].map(e => <option key={e}>{e}</option>)}
                        </select>
                        <select style={sel} value={fTipo} onChange={e => setFTipo(e.target.value)}>
                            <option value="">Todos los tipos</option>
                            {TIPOS.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                        <tr style={{ borderBottom:'2px solid #eee' }}>
                            {['VENDEDOR','ACTIVIDAD','TIPO','CLIENTE','PRIORIDAD','ESTADO','MES','MONTO','TIEMPO'].map(h =>
                                <th key={h} style={th}>{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(a => {
                            const v   = vendedores.find(x => x.id === a.vendedor_id);
                            const mkt = isMarketing(v);
                            const tc  = TYPE_COLOR[a.tipo] || { bg:'#eee', color:'#333' };
                            return (
                                <tr key={a.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                                    <td style={td}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                            <div style={{ width:28, height:28, borderRadius:'50%', background:v?.color||'#ccc', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{v?.iniciales}</div>
                                            <span style={{ fontSize:12 }}>{v?.nombre}</span>
                                        </div>
                                    </td>
                                    <td style={td}>
                                        <div style={{ fontWeight:600 }}>{a.nombre}</div>
                                        {a.notas && <div style={{ fontSize:11, color:'#8899aa' }}>{a.notas}</div>}
                                    </td>
                                    <td style={td}>
                                        <span style={{ padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:600, background:tc.bg, color:tc.color, whiteSpace:'nowrap' }}>
                                            {TYPE_ICON[a.tipo]} {a.tipo}
                                        </span>
                                    </td>
                                    <td style={td}>{a.cliente}</td>
                                    <td style={td}>
                                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12 }}>
                                            <span style={{ width:8, height:8, borderRadius:'50%', background: a.prioridad==='Alta'?'#e74c3c':a.prioridad==='Media'?'#e67e22':'#27ae60', flexShrink:0 }} />
                                            {a.prioridad}
                                        </span>
                                    </td>
                                    <td style={td}>
                                        <span style={{ padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:600, background: a.estado==='Completado'?'#d4edda':a.estado==='En Progreso'?'#cce5ff':a.estado==='Cancelado'?'#f8d7da':'#fff3cd', color: a.estado==='Completado'?'#155724':a.estado==='En Progreso'?'#004085':a.estado==='Cancelado'?'#721c24':'#856404' }}>
                                            {a.estado}
                                        </span>
                                    </td>
                                    <td style={td}>{a.mes}</td>
                                    <td style={{ ...td, fontWeight:700, color: mkt ? '#8899aa' : '#2f6fd4' }}>
                                        {mkt ? '—' : fmtUSD(a.monto)}
                                    </td>
                                    <td style={td}>
                                        <span style={{ fontFamily:'monospace', fontSize:12, color:'#6b7a8d' }}>{fmt(a.elapsed||0)}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!filtered.length && <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin actividades</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Modal edición roles */}
            {editRolId && (
                <div onClick={() => setEditRolId(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:24, minWidth:280, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
                        <div style={{ fontWeight:700, marginBottom:14, fontSize:14 }}>Editar roles</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
                            {ROLES.map(r => (
                                <label key={r} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                                    <input type="checkbox" checked={rolDraft.includes(r)} onChange={() => toggleRol(r)} />
                                    <RolBadge rol={r} />
                                </label>
                            ))}
                        </div>
                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                            <button onClick={() => setEditRolId(null)} style={btnSec}>Cancelar</button>
                            <button onClick={() => saveRoles(editRolId)} style={btnPri} disabled={!rolDraft.length}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal nueva actividad */}
            <ActividadModal
                open={modal.open}
                actividad={null}
                vendedores={vendedores}
                onClose={() => setModal({ open:false, actividad:null })}
                onSave={handleSave}
            />
        </div>
    );
}

const sel     = { padding:'7px 12px', borderRadius:7, border:'1px solid #dde1e8', fontSize:13, background:'#fff', color:'#2d3d52' };
const card    = { background:'#fff', borderRadius:10, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' };
const ct      = { fontSize:13, fontWeight:700, color:'#1e2a3b', marginBottom:0 };
const th      = { padding:'8px 10px', textAlign:'left', color:'#6b7a8d', fontWeight:700, fontSize:11 };
const td      = { padding:'10px 10px', color:'#2d3d52' };
const btnPri  = { padding:'9px 18px', background:'#2f6fd4', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
const btnSec  = { padding:'9px 18px', background:'#f0f2f5', color:'#1e2a3b', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 };
