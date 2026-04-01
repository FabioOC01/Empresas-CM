import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { getVendedores } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, MESES } from '../utils/crm';

const PIPELINE = [
    { label: 'PROSPECCIÓN', tipos: ['Visita'],                        bg: '#eaf4fb', accent: '#2980b9' },
    { label: 'CALIFICACIÓN', tipos: ['Seguimiento','Oportunidad'],    bg: '#eafaf1', accent: '#27ae60' },
    { label: 'PROPUESTA',    tipos: ['Propuesta','Cotización'],       bg: '#fef9e7', accent: '#d4ac0d' },
    { label: 'NEGOCIACIÓN',  tipos: ['Homologación'],                 bg: '#fef5e4', accent: '#ca6f1e' },
    { label: 'CIERRE',       tipos: ['Venta'],                        bg: '#eafaf1', accent: '#1e8449' },
];

const KPI_COLORS = ['#eaf4fb','#eafaf1','#fef5e4','#fef9e7','#f4ecf7','#eaf4fb'];
const KPI_ACCENTS = ['#2980b9','#27ae60','#ca6f1e','#d4ac0d','#8e44ad','#2980b9'];
const KPI_ICONS = ['📋','💰','✅','⏳','🏆','👥'];

const CHART_COLORS = ['#2f6fd4','#27ae60','#8e44ad','#e67e22','#e74c3c','#1abc9c'];

const ESTADO_COLOR = { 'Pendiente':'#e67e22','En Progreso':'#2f6fd4','Completado':'#27ae60','Cancelado':'#e74c3c' };

function dateStr() {
    return new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

export default function Dashboard() {
    const { actividades } = useActividades();
    const [vendedores, setVendedores] = useState([]);
    const [trim, setTrim] = useState('');
    const [vend, setVend] = useState('');
    const [vendMetric, setVendMetric] = useState('monto');

    useEffect(() => { getVendedores().then(setVendedores); }, []);

    const data = filterActs(actividades, {
        trimestre:  trim || undefined,
        vendedorId: vend || undefined,
    });

    const completados  = data.filter(a => a.estado === 'Completado');
    const enProgreso   = data.filter(a => a.estado === 'En Progreso');
    const pendientes   = data.filter(a => a.estado === 'Pendiente');
    const homologaciones = data.filter(a => a.tipo === 'Homologación');
    const totalMonto   = data.reduce((s,a) => s + Number(a.monto), 0);
    const cerradoMonto = completados.reduce((s,a) => s + Number(a.monto), 0);
    const tasa         = data.length ? Math.round(completados.length / data.length * 100) : 0;

    const kpis = [
        { label: 'TOTAL ACTIVIDADES', value: data.length,              sub: `${enProgreso.length} en progreso` },
        { label: 'MONTO PIPELINE',    value: fmtUSD(totalMonto),       sub: `↑ ${fmtUSD(cerradoMonto)} cerrado` },
        { label: 'COMPLETADAS',       value: completados.length,        sub: `Tasa: ${tasa}%` },
        { label: 'PENDIENTES',        value: pendientes.length,         sub: `${enProgreso.length} en curso` },
        { label: 'HOMOLOGACIONES',    value: homologaciones.length,     sub: `${homologaciones.filter(a=>a.estado==='Completado').length} completadas` },
        { label: 'VENDEDORES',        value: vendedores.length,         sub: `de ${vendedores.length} totales` },
    ];

    const pipeline = PIPELINE.map(p => ({
        ...p,
        items: data.filter(a => p.tipos.includes(a.tipo)),
        monto: data.filter(a => p.tipos.includes(a.tipo)).reduce((s,a) => s + Number(a.monto), 0),
    }));

    // Charts
    const byVendedor = vendedores.map(v => ({
        name: v.nombre.split(' ')[0],
        color: v.color,
        Monto: data.filter(a => a.vendedor_id === v.id).reduce((s,a) => s + Number(a.monto), 0),
        Cantidad: data.filter(a => a.vendedor_id === v.id).length,
    }));

    const byEstado = ['Pendiente','En Progreso','Completado','Cancelado']
        .map(e => ({ name: e, value: data.filter(a => a.estado === e).length }))
        .filter(x => x.value > 0);

    const TIPOS_ALL = ['Venta','Homologación','Visita','Propuesta','Seguimiento','Administrativa','Oportunidad','Cotización','Publicidad','Piezas gráficas'];
    const byTipo = TIPOS_ALL.map(t => ({ name: t, value: data.filter(a => a.tipo === t).length })).filter(x => x.value > 0);
    const TIPO_COLORS = ['#2f6fd4','#27ae60','#e67e22','#8e44ad','#e74c3c','#1abc9c','#e91e63','#4caf50','#ff9800','#9c27b0'];

    const byMes = MESES.map(m => ({
        name: m, count: data.filter(a => a.mes === m).length,
    })).filter(x => x.count > 0);

    const byPrio = ['Alta','Media','Baja'].map(p => ({
        name: p,
        Completado:  data.filter(a => a.prioridad === p && a.estado === 'Completado').length,
        'En Progreso': data.filter(a => a.prioridad === p && a.estado === 'En Progreso').length,
        Pendiente:   data.filter(a => a.prioridad === p && a.estado === 'Pendiente').length,
    }));

    const topOps = [...data].sort((a,b) => b.monto - a.monto).slice(0,8);
    const recientes = [...data].sort((a,b) => b.id - a.id).slice(0,8);

    return (
        <div>
            {/* Topbar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
                
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select style={sel} value={trim} onChange={e => setTrim(e.target.value)}>
                        <option value="">Todos los períodos</option>
                        {['1','2','3','4'].map(q => <option key={q} value={q}>Q{q}</option>)}
                    </select>
                    <select style={sel} value={vend} onChange={e => setVend(e.target.value)}>
                        <option value="">Todos los vendedores</option>
                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                    <button onClick={() => { setTrim(''); setVend(''); }} style={btnRefresh}>↺ Actualizar</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:20 }}>
                {kpis.map((k, i) => (
                    <div key={k.label} style={{ background:'#fff', borderRadius:10, padding:'16px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', gap:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:36, height:36, borderRadius:8, background:KPI_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                                {KPI_ICONS[i]}
                            </div>
                            <div style={{ fontSize:10, fontWeight:700, color:'#6b7a8d', textTransform:'uppercase', letterSpacing:0.5, lineHeight:1.3 }}>{k.label}</div>
                        </div>
                        <div style={{ fontSize:24, fontWeight:800, color:'#1e2a3b', lineHeight:1 }}>{k.value}</div>
                        <div style={{ fontSize:11, color: i === 1 ? '#27ae60' : '#8899aa' }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Pipeline */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:0, marginBottom:20, borderRadius:10, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                {pipeline.map((p, i) => (
                    <div key={p.label} style={{ background:p.bg, padding:'18px 16px', borderRight: i < 4 ? '1px solid rgba(0,0,0,0.06)' : 'none', textAlign:'center' }}>
                        <div style={{ fontSize:11, fontWeight:800, color:p.accent, letterSpacing:1, marginBottom:8 }}>{p.label}</div>
                        <div style={{ fontSize:28, fontWeight:800, color:'#1e2a3b', lineHeight:1 }}>{p.items.length}</div>
                        <div style={{ fontSize:13, color: p.monto > 0 ? p.accent : '#bbb', fontWeight:600, marginTop:6 }}>
                            {p.monto > 0 ? fmtUSD(p.monto) : '—'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Vendor Cards */}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${vendedores.length},1fr)`, gap:14, marginBottom:20 }}>
                {vendedores.map(v => {
                    const vActs  = data.filter(a => a.vendedor_id === v.id);
                    const cerr   = vActs.filter(a => a.estado === 'Completado');
                    const pct    = vActs.length ? Math.round(cerr.length / vActs.length * 100) : 0;
                    const montoC = cerr.reduce((s,a) => s + Number(a.monto), 0);
                    const barColor = pct >= 70 ? '#27ae60' : pct >= 40 ? '#e67e22' : '#e74c3c';
                    return (
                        <div key={v.id} style={{ background:'#fff', borderRadius:10, padding:'16px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                                <div style={{ width:38, height:38, borderRadius:'50%', background:v.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, flexShrink:0 }}>
                                    {v.iniciales}
                                </div>
                                <div>
                                    <div style={{ fontWeight:700, fontSize:13, color:'#1e2a3b', lineHeight:1.2 }}>{v.nombre}</div>
                                    <div style={{ fontSize:11, color:'#8899aa', marginTop:2 }}>{vActs.length} actividades · {pct}% completado</div>
                                </div>
                            </div>
                            <div style={{ height:5, background:'#eee', borderRadius:3, marginBottom:8 }}>
                                <div style={{ height:'100%', borderRadius:3, width:`${pct}%`, background:barColor, transition:'width 0.4s' }} />
                            </div>
                            <div style={{ fontSize:15, fontWeight:800, color:'#2f6fd4' }}>{fmtUSD(montoC)}</div>
                        </div>
                    );
                })}
            </div>

            {/* Charts — fila 1: bar grande + donut estado */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>
                <div style={card}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                        <div style={ct}>Montos por Vendedor (USD)</div>
                        <select style={sel} value={vendMetric} onChange={e => setVendMetric(e.target.value)}>
                            <option value="monto">Monto USD</option>
                            <option value="cantidad">Cantidad</option>
                        </select>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={byVendedor} margin={{ top:16, right:10, left:10, bottom:0 }}>
                            <XAxis dataKey="name" tick={{ fontSize:12 }} />
                            <YAxis tick={{ fontSize:11 }} tickFormatter={v => vendMetric === 'monto' ? `${(v/1000).toFixed(0)}k` : v} />
                            <Tooltip formatter={v => vendMetric === 'monto' ? fmtUSD(v) : v} />
                            <Bar dataKey={vendMetric === 'monto' ? 'Monto' : 'Cantidad'} radius={[4,4,0,0]}>
                                {byVendedor.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={{ ...ct, marginBottom:14 }}>Estado de Actividades</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie data={byEstado} cx="50%" cy="55%" outerRadius={95} innerRadius={55} dataKey="value">
                                {byEstado.map((e, i) => <Cell key={i} fill={ESTADO_COLOR[e.name] || CHART_COLORS[i]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend iconSize={12} iconType="square" wrapperStyle={{ fontSize:12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts — fila 2: donut tipo + barras mes + barras apiladas prioridad */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
                <div style={card}>
                    <div style={ct}>Por Tipo</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={byTipo} cx="50%" cy="55%" outerRadius={85} innerRadius={45} dataKey="value">
                                {byTipo.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize:11 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Actividades por Mes</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={byMes} margin={{ top:16, right:10, left:-10, bottom:0 }}>
                            <XAxis dataKey="name" tick={{ fontSize:11 }} />
                            <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Actividades" fill="#5b8dee" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Prioridad vs Estado</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={byPrio} margin={{ top:16, right:10, left:-10, bottom:0 }}>
                            <XAxis dataKey="name" tick={{ fontSize:12 }} />
                            <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize:11 }} />
                            <Bar dataKey="Completado"   stackId="a" fill="#27ae60" />
                            <Bar dataKey="En Progreso"  stackId="a" fill="#2f6fd4" />
                            <Bar dataKey="Pendiente"    stackId="a" fill="#e67e22" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top oportunidades */}
            <div style={card}>
                <div style={ct}>Top oportunidades</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                        <tr style={{ borderBottom:'2px solid #eee' }}>
                            {['Actividad','Tipo','Vendedor','Cliente','Estado','Monto'].map(h =>
                                <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#6b7a8d', fontWeight:600, fontSize:11 }}>{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {topOps.map(a => {
                            const v = vendedores.find(x => x.id === a.vendedor_id);
                            return (
                                <tr key={a.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                                    <td style={td}>{a.nombre}</td>
                                    <td style={td}><span style={{ fontSize:11, background:'#f0f2f5', padding:'2px 8px', borderRadius:10, fontWeight:600 }}>{a.tipo}</span></td>
                                    <td style={td}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                            <div style={{ width:24, height:24, borderRadius:'50%', background:v?.color||'#ccc', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>{v?.iniciales}</div>
                                            <span>{v?.nombre}</span>
                                        </div>
                                    </td>
                                    <td style={td}>{a.cliente}</td>
                                    <td style={td}>
                                        <span style={{ padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background: a.estado==='Completado'?'#d4edda':a.estado==='En Progreso'?'#cce5ff':a.estado==='Cancelado'?'#f8d7da':'#fff3cd', color: a.estado==='Completado'?'#155724':a.estado==='En Progreso'?'#004085':a.estado==='Cancelado'?'#721c24':'#856404' }}>
                                            {a.estado}
                                        </span>
                                    </td>
                                    <td style={{ ...td, fontWeight:800, color:'#2f6fd4' }}>{fmtUSD(a.monto)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const sel = { padding:'7px 12px', borderRadius:7, border:'1px solid #dde1e8', fontSize:13, background:'#fff', color:'#2d3d52' };
const btnRefresh = { padding:'7px 14px', borderRadius:7, border:'1px solid #dde1e8', background:'#fff', fontSize:13, cursor:'pointer', color:'#2d3d52', fontWeight:600 };
const card = { background:'#fff', borderRadius:10, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' };
const ct   = { fontSize:13, fontWeight:700, color:'#1e2a3b', marginBottom:14 };
const td   = { padding:'10px 10px', color:'#2d3d52' };
