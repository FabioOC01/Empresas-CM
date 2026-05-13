import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Sector, LabelList } from 'recharts';

const renderActivePie = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.95} />
);
import { getVendedores } from '../api/actividades';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, fmt, calcDuration, totalGastosOperacion, MESES } from '../utils/crm';
import PeriodoPicker from '../components/PeriodoPicker';
import Avatar from '../components/Avatar';
import { useTheme } from '../context/ThemeContext';
import { getDisplayRoles } from '../utils/roles';

export default function Dashboard() {
    const { actividades, config } = useActividades();
    const tk     = useTheme();
    const { sel, card, ct, td } = useDashStyles();
    const moneda = config?.moneda || 'USD';
    const [vendedores, setVendedores] = useState([]);
    const [trim, setTrim] = useState('');
    const [mes, setMes]   = useState(MESES[new Date().getMonth()]);
    const [anio, setAnio] = useState('');
    const [vend, setVend] = useState('');
    const [rol, setRol] = useState('');
    const [activePieIdx, setActivePieIdx] = useState(null);
    const [activeVendorSlide, setActiveVendorSlide] = useState(0);
    const [fsvend, setFsvend] = useState(null);
    const [isFs, setIsFs] = useState(false);

    useEffect(() => {
        const h = () => setIsFs(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    const toggleFs = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    };

    useEffect(() => {
        if (!fsvend) return;
        const h = (e) => { if (e.key === 'Escape') setFsvend(null); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [fsvend]);

    useEffect(() => {
        getVendedores().then(setVendedores);
    }, []);

    const rolesDisponibles = [...new Set(vendedores.flatMap(v => getDisplayRoles(v)))].sort();
    const vendedoresFiltrados = vendedores.filter(v => {
        if (vend) return v.id === vend;
        if (rol) return getDisplayRoles(v).includes(rol);
        return true;
    });
    const vendedorIdsVisibles = new Set(vendedoresFiltrados.map(v => v.id));
    const baseData = filterActs(actividades, {
        trimestre:  trim || undefined,
        mes:        mes  || undefined,
        año:        anio || undefined,
    });
    const data = baseData.filter(a => vendedorIdsVisibles.has(a.vendedor_id));

    const periodo = mes ? 'mensual' : trim ? 'trimestral' : anio ? 'anual' : 'mensual';

    const ttStyle = {
        contentStyle: { background: tk.card, border: `1px solid ${tk.bdr}`, borderRadius: 8, fontSize: 12, color: tk.txt },
        itemStyle:    { color: tk.txt2 },
        labelStyle:   { color: tk.txt, fontWeight: 600 },
        cursor:       { fill: tk.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
    };
    const axisProps = { tick: { fill: tk.txt2, fontSize: 11 } };
    const ESTADO_COLOR = { 'Completado':'#27ae60','Ganada':'#1e8449','En Progreso':'#10b981','Pendiente':'#e67e22','Perdida':'#e74c3c' };


    // Charts
    const byVendedorEstado = vendedoresFiltrados.map(v => ({
        name: v.nombre.split(' ')[0],
        Ganada:        data.filter(a => a.vendedor_id === v.id && a.estado === 'Ganada').length,
        Completado:    data.filter(a => a.vendedor_id === v.id && a.estado === 'Completado').length,
        'En Progreso': data.filter(a => a.vendedor_id === v.id && a.estado === 'En Progreso').length,
        Pendiente:     data.filter(a => a.vendedor_id === v.id && a.estado === 'Pendiente').length,
        Perdida:       data.filter(a => a.vendedor_id === v.id && a.estado === 'Perdida').length,
    }));

    const TIPOS_ALL = ['Venta','Homologación','Visita','Propuesta','Seguimiento','Administrativa','Oportunidad','Cotización','Publicidad','Piezas gráficas'];
    const byTipo = TIPOS_ALL.map(t => ({ name: t, value: data.filter(a => a.tipo === t).length })).filter(x => x.value > 0);
    const TIPO_COLORS = ['#10b981','#27ae60','#e67e22','#8e44ad','#e74c3c','#1abc9c','#e91e63','#4caf50','#ff9800','#9c27b0'];

    const tasaSunatGlobal = parseFloat(config?.tasa_sunat) || 0;
    const ventasGanadas   = data.filter(a => a.estado === 'Ganada');
    const facturacionGlobal = ventasGanadas.reduce((s,a) => s + (parseFloat(a.precio_venta) || parseFloat(a.monto) || 0), 0);
    const rentabilidadGlobal = ventasGanadas.reduce((s,a) => {
        const fact     = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
        const gastos   = totalGastosOperacion(a);
        const rentBruta = fact - gastos;
        const sunat    = rentBruta * tasaSunatGlobal;
        return s + (rentBruta - sunat);
    }, 0);
    const metaGlobalRent = parseFloat(
        periodo === 'anual'      ? config?.meta_global_rentabilidad :
        periodo === 'trimestral' ? config?.meta_global_rentabilidad_trim :
                                   config?.meta_global_rentabilidad_mes
    ) || 0;
    const metaGlobalFact = parseFloat(
        periodo === 'anual'      ? config?.meta_global_facturacion :
        periodo === 'trimestral' ? config?.meta_global_facturacion_trim :
                                   config?.meta_global_facturacion_mes
    ) || 0;
    const pctMetaRent = metaGlobalRent > 0 ? Math.min((rentabilidadGlobal / metaGlobalRent) * 100, 100) : 0;
    const pctMetaFact = metaGlobalFact > 0 ? Math.min((facturacionGlobal  / metaGlobalFact) * 100, 100) : 0;
    const metaRentHit = metaGlobalRent > 0 && rentabilidadGlobal >= metaGlobalRent;
    const metaFactHit = metaGlobalFact > 0 && facturacionGlobal  >= metaGlobalFact;

    const actividadReciente = vendedoresFiltrados
        .map(v => {
            const ultima = [...data]
                .filter(a => a.vendedor_id === v.id)
                .sort((a, b) => b.id - a.id)[0];
            return { ...v, ultima };
        })
        .filter(v => v.ultima)
        .sort((a, b) => b.ultima.id - a.ultima.id)
        .slice(0, 3);

    const topOps = [...data].sort((a,b) => b.monto - a.monto).slice(0,8);

    // Avance por vendedor según el periodo seleccionado
    const avanceMensual = vendedoresFiltrados.map(v => {
        const vVentas = ventasGanadas.filter(a => a.vendedor_id === v.id);
        const fact = vVentas.reduce((s,a) => s + (parseFloat(a.precio_venta) || parseFloat(a.monto) || 0), 0);
        const rent = vVentas.reduce((s,a) => {
            const f = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
            const c = totalGastosOperacion(a);
            return s + (f - c);
        }, 0);
        const metaFact = parseFloat(
            periodo === 'anual'      ? v.meta_facturacion_anual :
            periodo === 'trimestral' ? v.meta_facturacion_trimestral :
                                       v.meta_facturacion_mensual
        ) || 0;
        const metaRent = parseFloat(
            periodo === 'anual'      ? v.meta_rentabilidad_anual :
            periodo === 'trimestral' ? v.meta_rentabilidad_trimestral :
                                       v.meta_mensual
        ) || 0;
        return {
            ...v,
            fact, rent, metaFact, metaRent,
            pctFact: metaFact > 0 ? Math.min((fact / metaFact) * 100, 100) : 0,
            pctRent: metaRent > 0 ? Math.min((rent / metaRent) * 100, 100) : 0,
        };
    });
    const vendorSlideSize = 4;
    const vendorSlides = [];
    for (let i = 0; i < vendedoresFiltrados.length; i += vendorSlideSize) {
        vendorSlides.push(vendedoresFiltrados.slice(i, i + vendorSlideSize));
    }

    useEffect(() => {
        if (vendorSlides.length <= 1) return undefined;
        const t = setInterval(() => {
            setActiveVendorSlide((idx) => (idx + 1) % vendorSlides.length);
        }, 5600);
        return () => clearInterval(t);
    }, [vendorSlides.length]);

    const visibleVendorSlide = vendorSlides.length ? Math.min(activeVendorSlide, vendorSlides.length - 1) : 0;
    const showLegacyDashboardCards = false;

    return (
        <div>
            {/* Meta Global */}
            <div style={{ ...card, marginBottom:20 }}>
                <div style={ct}>Meta Global ({periodo})</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <MetaGlobalBox tk={tk} titulo="Rentabilidad" logrado={rentabilidadGlobal} meta={metaGlobalRent} pct={pctMetaRent} hit={metaRentHit} moneda={moneda} />
                    <MetaGlobalBox tk={tk} titulo="Facturación"  logrado={facturacionGlobal}  meta={metaGlobalFact} pct={pctMetaFact} hit={metaFactHit} moneda={moneda} />
                </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', marginBottom:24 }}>
                
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <PeriodoPicker trim={trim} mes={mes} año={anio} onTrim={setTrim} onMes={setMes} onAño={setAnio} showAño />
                    <select
                        style={sel}
                        value={rol}
                        onChange={e => {
                            setRol(e.target.value);
                            setVend('');
                            setActiveVendorSlide(0);
                        }}
                    >
                        <option value="">Todos los roles</option>
                        {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select
                        style={sel}
                        value={vend}
                        onChange={e => {
                            setVend(e.target.value);
                            setRol('');
                            setActiveVendorSlide(0);
                        }}
                    >
                        <option value="">Todos los vendedores</option>
                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                    <button onClick={toggleFs} title={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        style={{ padding:'7px 10px', borderRadius:7, border:`1px solid ${tk.bdr}`, background:tk.card, color:tk.txt2, cursor:'pointer', display:'flex', alignItems:'center' }}>
                        {isFs
                            ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="5,1 1,1 1,5"/><polyline points="10,1 14,1 14,5"/><polyline points="1,10 1,14 5,14"/><polyline points="14,10 14,14 10,14"/></svg>
                            : <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="1,5 1,1 5,1"/><polyline points="10,1 14,1 14,5"/><polyline points="1,10 1,14 5,14"/><polyline points="10,14 14,14 14,10"/></svg>
                        }
                    </button>
                </div>
            </div>

            <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:10 }}>
                    <div>
                        <div style={ct}>Resumen por vendedor</div>
                        <div style={{ fontSize:11, color:tk.txt3, marginTop:-8 }}>{vendedoresFiltrados.length} vendedores · {periodo}</div>
                    </div>
                    {vendorSlides.length > 1 && (
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                            {vendorSlides.map((_, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveVendorSlide(idx)}
                                    aria-label={`Ver grupo ${idx + 1}`}
                                    style={{
                                        width: idx === visibleVendorSlide ? 22 : 7,
                                        height: 7,
                                        borderRadius: 999,
                                        border: 'none',
                                        background: idx === visibleVendorSlide ? tk.accent : tk.bdr,
                                        cursor: 'pointer',
                                        padding: 0,
                                        transition: 'width 0.2s ease, background 0.2s ease',
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {vendorSlides.length === 0 ? (
                    <div style={{ color:tk.txt3, fontSize:12, textAlign:'center', padding:14 }}>Sin vendedores</div>
                ) : (
                    <div style={{ overflow:'hidden', minWidth:0 }}>
                        <div style={{
                            display:'flex',
                            width:'100%',
                            transform:`translateX(-${visibleVendorSlide * 100}%)`,
                            transition:'transform 0.62s cubic-bezier(.22,1,.36,1)',
                        }}>
                            {vendorSlides.map((slide, slideIdx) => (
                                <div key={slideIdx} style={{ flex:'0 0 100%', minWidth:0 }}>
                                    <div className="dashboard-vendor-row" style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:14 }}>
                                        {slide.map(v => {
                                            const vAv = avanceMensual.find(x => x.id === v.id) || { fact:0, rent:0, metaFact:0, metaRent:0, pctFact:0, pctRent:0 };
                                            const vActsCount = data.filter(a => a.vendedor_id === v.id).length;
                                            const factColor = vAv.pctFact >= 100 ? '#10b981' : '#5b8dee';
                                            const rentColor = vAv.pctRent >= 100 ? '#10b981' : '#27ae60';
                                            return (
                                                <div key={v.id} className="card dashboard-vendor-card" style={{ padding:'15px 14px', position:'relative', minWidth:0 }}>
                                                    <button onClick={() => setFsvend(v)} title="Pantalla completa"
                                                        style={{ position:'absolute', top:10, right:10, background:'transparent', border:'none', cursor:'pointer', color:tk.txt3, padding:3, borderRadius:5, display:'flex', opacity:0.7 }}>
                                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                                            <polyline points="9,1 13,1 13,5"/><polyline points="5,13 1,13 1,9"/>
                                                            <line x1="13" y1="1" x2="8" y2="6"/><line x1="1" y1="13" x2="6" y2="8"/>
                                                        </svg>
                                                    </button>
                                                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingRight:18, minWidth:0 }}>
                                                        <Avatar vendedor={v} size="lg" />
                                                        <div style={{ minWidth:0, flex:1 }}>
                                                            <div style={{ fontWeight:800, fontSize:13, color:tk.txt, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                                                            <div style={{ fontSize:11, color:tk.txt3, marginTop:2 }}>{vActsCount} actividades</div>
                                                        </div>
                                                    </div>
                                                    {[
                                                        ['Facturación', vAv.fact, vAv.metaFact, vAv.pctFact, factColor],
                                                        ['Rentabilidad', vAv.rent, vAv.metaRent, vAv.pctRent, rentColor],
                                                    ].map(([label, logrado, meta, pct, color]) => (
                                                        <div key={label} style={{ marginBottom: label === 'Facturación' ? 10 : 0, minWidth:0 }}>
                                                            <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:10, marginBottom:4 }}>
                                                                <span style={{ color:tk.txt2, fontWeight:700 }}>{label}</span>
                                                                <span style={{ color, fontWeight:800 }}>{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <div style={{ height:6, background:tk.bdr, borderRadius:999, overflow:'hidden' }}>
                                                                <div style={{ height:'100%', borderRadius:999, width:`${pct}%`, background:color, transition:'width 0.5s ease' }} />
                                                            </div>
                                                            <div style={{ fontSize:11, color:tk.txt3, marginTop:4, fontFamily:'monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                                                {fmtUSD(logrado, moneda)}{meta > 0 && <span> / {fmtUSD(meta, moneda)}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showLegacyDashboardCards && (
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${vendedores.length},1fr)`, gap:14, marginBottom:20 }}>
                {vendedores.map(v => {
                    const vAv = avanceMensual.find(x => x.id === v.id) || { fact:0, rent:0, metaFact:0, metaRent:0, pctFact:0, pctRent:0 };
                    const vActsCount = data.filter(a => a.vendedor_id === v.id).length;
                    const factColor = vAv.pctFact >= 100 ? '#10b981' : '#5b8dee';
                    const rentColor = vAv.pctRent >= 100 ? '#10b981' : '#27ae60';
                    return (
                        <div key={v.id} className="card" style={{ padding:'16px 14px', position:'relative' }}>
                            <button onClick={() => setFsvend(v)} title="Pantalla completa"
                                style={{ position:'absolute', top:10, right:10, background:'transparent', border:'none', cursor:'pointer', color:tk.txt3, padding:3, borderRadius:5, display:'flex', opacity:0.7 }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                    <polyline points="9,1 13,1 13,5"/><polyline points="5,13 1,13 1,9"/>
                                    <line x1="13" y1="1" x2="8" y2="6"/><line x1="1" y1="13" x2="6" y2="8"/>
                                </svg>
                            </button>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                                <Avatar vendedor={v} size="lg" />
                                <div style={{ minWidth:0 }}>
                                    <div style={{ fontWeight:700, fontSize:13, color:tk.txt, lineHeight:1.2 }}>{v.nombre}</div>
                                    <div style={{ fontSize:11, color:tk.txt3, marginTop:2 }}>{vActsCount} actividades</div>
                                </div>
                            </div>
                            <div style={{ marginBottom:8 }}>
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                                    <span style={{ color:tk.txt2, fontWeight:600 }}>Facturación</span>
                                    <span style={{ color:factColor, fontWeight:700 }}>{vAv.pctFact.toFixed(0)}%</span>
                                </div>
                                <div style={{ height:6, background:tk.bdr, borderRadius:3 }}>
                                    <div style={{ height:'100%', borderRadius:3, width:`${vAv.pctFact}%`, background:factColor, transition:'width 0.5s ease' }} />
                                </div>
                                <div style={{ fontSize:11, color:tk.txt3, marginTop:3, fontFamily:'monospace' }}>{fmtUSD(vAv.fact, moneda)}{vAv.metaFact > 0 && <span> / {fmtUSD(vAv.metaFact, moneda)}</span>}</div>
                            </div>
                            <div>
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                                    <span style={{ color:tk.txt2, fontWeight:600 }}>Rentabilidad</span>
                                    <span style={{ color:rentColor, fontWeight:700 }}>{vAv.pctRent.toFixed(0)}%</span>
                                </div>
                                <div style={{ height:6, background:tk.bdr, borderRadius:3 }}>
                                    <div style={{ height:'100%', borderRadius:3, width:`${vAv.pctRent}%`, background:rentColor, transition:'width 0.5s ease' }} />
                                </div>
                                <div style={{ fontSize:11, color:tk.txt3, marginTop:3, fontFamily:'monospace' }}>{fmtUSD(vAv.rent, moneda)}{vAv.metaRent > 0 && <span> / {fmtUSD(vAv.metaRent, moneda)}</span>}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {/* Charts - fila 1: por tipo + estado por vendedor + donut estado */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:16, marginBottom:16 }}>
                <div style={card}>
                    <div style={ct}>Por Tipo</div>
                    <div style={{ position:'relative' }}>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={byTipo} cx="50%" cy="45%" outerRadius={85} innerRadius={48} dataKey="value"
                                    activeIndex={activePieIdx ?? undefined}
                                    activeShape={renderActivePie}
                                    onMouseEnter={(_, i) => setActivePieIdx(i)}
                                    onMouseLeave={() => setActivePieIdx(null)}
                                    animationDuration={700} animationEasing="ease-out">
                                    {byTipo.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} />
                                <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize:11, color: tk.txt2 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ position:'absolute', top:'38%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                            <div style={{ fontSize:22, fontWeight:800, color:tk.txt }}>{byTipo.reduce((s,x) => s+x.value, 0)}</div>
                            <div style={{ fontSize:10, color:tk.txt3 }}>total</div>
                        </div>
                    </div>
                </div>
                <div style={card}>
                    <div style={{ marginBottom:14 }}>
                        <div style={ct}>Estado de Actividades por Vendedor</div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={byVendedorEstado} margin={{ top:8, right:10, left:-10, bottom:0 }}>
                            <XAxis dataKey="name" {...axisProps} />
                            <YAxis {...axisProps} allowDecimals={false} />
                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} cursor={ttStyle.cursor} />
                            <Legend iconSize={11} iconType="square" wrapperStyle={{ fontSize:11, color: tk.txt2 }} />
                            <Bar dataKey="Ganada"       stackId="a" fill="#1e8449" animationDuration={900} animationEasing="ease-out" />
                            <Bar dataKey="Completado"   stackId="a" fill="#3498db" animationDuration={900} animationEasing="ease-out" />
                            <Bar dataKey="En Progreso"  stackId="a" fill="#9b59b6" animationDuration={900} animationEasing="ease-out" />
                            <Bar dataKey="Pendiente"    stackId="a" fill="#f1c40f" animationDuration={900} animationEasing="ease-out" />
                            <Bar dataKey="Perdida"      stackId="a" fill="#e74c3c" radius={[4,4,0,0]} animationDuration={900} animationEasing="ease-out" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={{ ...ct, marginBottom:16 }}>Última Actividad</div>
                    {actividadReciente.length === 0
                        ? <div style={{ color:'#aab', fontSize:12, textAlign:'center', paddingTop:20 }}>Sin datos</div>
                        : <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                            {actividadReciente.map((v, i) => {
                                const estadoColor = {
                                    'Completado':'#27ae60','Ganada':'#1e8449',
                                    'En Progreso':'#10b981','Pendiente':'#e67e22',
                                    'Perdida':'#e74c3c',
                                }[v.ultima.estado] || '#aab';
                                return (
                                    <div key={v.id} style={{ padding:'12px 0', borderBottom: i < actividadReciente.length - 1 ? `1px solid ${tk.bdr}` : 'none' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                                            <Avatar vendedor={v} size="sm" />
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontSize:12, fontWeight:700, color:tk.txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.ultima.nombre}</div>
                                                <div style={{ fontSize:11, color:tk.txt3 }}>{v.nombre.split(' ')[0]} · {v.ultima.cliente || '-'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: estadoColor + '18', color: estadoColor }}>{v.ultima.estado}</span>
                                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                                <span style={{ fontSize:10, color:tk.txt3, background:tk.card2, padding:'2px 7px', borderRadius:10 }}>{v.ultima.tipo}</span>
                                                <span style={{ fontSize:12, fontWeight:700, color:tk.txt2, fontFamily:'monospace' }}>{fmt(calcDuration(v.ultima))}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    }
                </div>
            </div>

            {/* Avance mensual por vendedor */}
            <div style={{ ...card, marginBottom:20 }}>
                <div style={ct}>Avance {periodo} por vendedor</div>
                {avanceMensual.length === 0
                    ? <div style={{ color:tk.txt3, fontSize:12, textAlign:'center', padding:14 }}>Sin vendedores</div>
                    : <div style={{ display:'grid', gap:12 }}>
                        {avanceMensual.map(v => (
                            <div key={v.id} style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr', gap:14, alignItems:'center' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                                    <Avatar vendedor={v} size="sm" />
                                    <div style={{ fontSize:13, fontWeight:700, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                                </div>
                                <AvanceBar tk={tk} label="Facturación" logrado={v.fact} meta={v.metaFact} pct={v.pctFact} moneda={moneda} color="#5b8dee" />
                                <AvanceBar tk={tk} label="Rentabilidad Bruta" logrado={v.rent} meta={v.metaRent} pct={v.pctRent} moneda={moneda} color="#10b981" />
                            </div>
                        ))}
                    </div>
                }
            </div>

            {/* Top oportunidades */}
            <div style={card}>
                <div style={ct}>Top oportunidades</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                        <tr style={{ background: tk.card2, borderBottom:`2px solid ${tk.bdr}` }}>
                            {['#','Actividad','Tipo','Vendedor','Cliente','Estado','Monto'].map(h =>
                                <th key={h} style={{ padding:'9px 10px', textAlign:'left', color:tk.txt2, fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {topOps.map((a, idx) => {
                            const v = vendedores.find(x => x.id === a.vendedor_id);
                            const ec = ESTADO_COLOR[a.estado] || '#8899aa';
                            const rankColor = idx === 0 ? '#d4ac0d' : idx === 1 ? '#8899aa' : idx === 2 ? '#cd7f32' : tk.txt3;
                            return (
                                <tr key={a.id} style={{ borderBottom:`1px solid ${tk.bdr}`, background: idx % 2 === 1 ? tk.card2 : 'transparent' }}>
                                    <td style={{ ...td, fontWeight:800, color:rankColor, fontSize:13, width:32 }}>#{idx+1}</td>
                                    <td style={{ ...td, fontWeight:600 }}>{a.nombre}</td>
                                    <td style={td}><span style={{ fontSize:11, background:tk.bg, color:tk.txt2, padding:'2px 8px', borderRadius:10, fontWeight:600 }}>{a.tipo}</span></td>
                                    <td style={td}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                            <Avatar vendedor={v} size="sm" />
                                            <span>{v?.nombre}</span>
                                        </div>
                                    </td>
                                    <td style={td}>{a.cliente}</td>
                                    <td style={td}>
                                        <span style={{ padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background: ec + '22', color: ec }}>
                                            {a.estado}
                                        </span>
                                    </td>
                                    <td style={{ ...td, fontWeight:800, color:'#10b981', fontFamily:'monospace' }}>{fmtUSD(a.monto, moneda)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {/* Fullscreen vendor overlay */}
            {fsvend && (() => {
                const fsActs   = data.filter(a => a.vendedor_id === fsvend.id);
                const fsAv     = avanceMensual.find(x => x.id === fsvend.id) || { fact:0, rent:0, metaFact:0, metaRent:0, pctFact:0, pctRent:0 };
                const fsByTipo = TIPOS_ALL.map(t => ({ name:t, value:fsActs.filter(a => a.tipo===t).length })).filter(x => x.value>0);
                const fsByEst  = [
                    { name:'Ganada',     value:fsActs.filter(a=>a.estado==='Ganada').length,     fill:'#1e8449' },
                    { name:'Completado', value:fsActs.filter(a=>a.estado==='Completado').length, fill:'#3498db' },
                    { name:'En Progreso',value:fsActs.filter(a=>a.estado==='En Progreso').length,fill:'#9b59b6' },
                    { name:'Pendiente',  value:fsActs.filter(a=>a.estado==='Pendiente').length,  fill:'#f1c40f' },
                    { name:'Perdida',    value:fsActs.filter(a=>a.estado==='Perdida').length,    fill:'#e74c3c' },
                ].filter(x => x.value > 0);
                const fsRecent = [...fsActs].sort((a,b) => b.id - a.id).slice(0,8);
                return (
                    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}
                        onClick={() => setFsvend(null)}>
                        <div style={{ background:tk.card, borderRadius:16, padding:28, width:'min(760px,94vw)', maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:22 }}>
                                <Avatar vendedor={fsvend} size="xl" />
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:20, fontWeight:800, color:tk.txt }}>{fsvend.nombre}</div>
                                    <div style={{ fontSize:12, color:tk.txt3, marginTop:3 }}>{getDisplayRoles(fsvend).join(' · ')}</div>
                                </div>
                                <button onClick={() => setFsvend(null)}
                                    style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:tk.txt3, lineHeight:1, padding:'4px 8px' }}>×</button>
                            </div>
                            {/* KPIs */}
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
                                {[
                                    { label:'Actividades', value:fsActs.length,                        color:'#5b8dee' },
                                    { label:'Facturación', value:fmtUSD(fsAv.fact, moneda),            color:'#5b8dee' },
                                    { label:'Rentabilidad',value:fmtUSD(fsAv.rent, moneda),            color:'#27ae60' },
                                    { label:`Avance ${periodo}`, value:`${fsAv.pctFact.toFixed(0)}% / ${fsAv.pctRent.toFixed(0)}%`, color:'#10b981' },
                                ].map(k => (
                                    <div key={k.label} style={{ background:tk.card2, borderRadius:10, padding:'12px 14px', borderTop:`3px solid ${k.color}` }}>
                                        <div style={{ fontSize:10, color:tk.txt3, textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>{k.label}</div>
                                        <div style={{ fontSize:18, fontWeight:800, color:k.color }}>{k.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Avance metas */}
                            <div style={{ display:'grid', gap:10, marginBottom:22 }}>
                                <AvanceBar tk={tk} label={`Facturación (${periodo})`} logrado={fsAv.fact} meta={fsAv.metaFact} pct={fsAv.pctFact} moneda={moneda} color="#5b8dee" />
                                <AvanceBar tk={tk} label={`Rentabilidad Bruta (${periodo})`} logrado={fsAv.rent} meta={fsAv.metaRent} pct={fsAv.pctRent} moneda={moneda} color="#27ae60" />
                            </div>
                            {/* Charts */}
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:22 }}>
                                <div>
                                    <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, marginBottom:8 }}>Por tipo</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie data={fsByTipo} cx="50%" cy="50%" outerRadius={70} innerRadius={38} dataKey="value" animationDuration={600}>
                                                {fsByTipo.map((_,i) => <Cell key={i} fill={TIPO_COLORS[i%TIPO_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} />
                                            <Legend iconSize={9} iconType="square" wrapperStyle={{ fontSize:10, color:tk.txt2 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div>
                                    <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, marginBottom:8 }}>Por estado</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={fsByEst} margin={{ top:16, right:8, left:-20, bottom:0 }}>
                                            <XAxis dataKey="name" tick={{ fill:tk.txt2, fontSize:10 }} />
                                            <YAxis tick={{ fill:tk.txt2, fontSize:10 }} allowDecimals={false} />
                                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} cursor={ttStyle.cursor} />
                                            <Bar dataKey="value" radius={[5,5,0,0]} animationDuration={600}>
                                                {fsByEst.map((e,i) => <Cell key={i} fill={e.fill} />)}
                                                <LabelList dataKey="value" position="top" style={{ fill:tk.txt2, fontSize:11, fontWeight:600 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            {/* Actividades recientes */}
                            <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, marginBottom:8 }}>Actividades recientes</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                                {fsRecent.map((a,i) => {
                                    const ec = ESTADO_COLOR[a.estado] || '#8899aa';
                                    return (
                                        <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom: i < fsRecent.length-1 ? `1px solid ${tk.bdr}` : 'none' }}>
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ fontWeight:600, fontSize:13, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.nombre}</div>
                                                <div style={{ fontSize:11, color:tk.txt3 }}>{a.cliente || '-'} · {a.mes}</div>
                                            </div>
                                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:20, background:ec+'22', color:ec, flexShrink:0 }}>{a.estado}</span>
                                            <span style={{ fontSize:12, fontWeight:700, color:'#10b981', flexShrink:0, fontFamily:'monospace' }}>{fmtUSD(a.monto, moneda)}</span>
                                        </div>
                                    );
                                })}
                                {!fsRecent.length && <div style={{ color:tk.txt3, fontSize:12, textAlign:'center', padding:16 }}>Sin actividades en el período</div>}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function AvanceBar({ tk, label, logrado, meta, pct, moneda, color }) {
    const hit = meta > 0 && logrado >= meta;
    const barColor = hit ? '#10b981' : color;
    return (
        <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                <span style={{ color:tk.txt2, fontWeight:600 }}>{label}</span>
                <span style={{ color:tk.txt2, fontFamily:'monospace' }}>
                    <strong style={{ color:tk.txt }}>{fmtUSD(logrado, moneda)}</strong>
                    {meta > 0 && <span style={{ color:tk.txt3 }}> / {fmtUSD(meta, moneda)}</span>}
                    <span style={{ marginLeft:6, color: hit ? '#10b981' : tk.txt3, fontWeight:700 }}>{pct.toFixed(0)}%</span>
                </span>
            </div>
            <div style={{ height:8, background:tk.bg, borderRadius:999, overflow:'hidden', border:`1px solid ${tk.bdr}` }}>
                <div style={{ height:'100%', width:`${pct}%`, background:barColor, transition:'width 0.5s ease' }} />
            </div>
        </div>
    );
}

function MetaGlobalBox({ tk, titulo, logrado, meta, pct, hit, moneda }) {
    const color = hit ? '#10b981' : meta > 0 ? '#e67e22' : tk.txt3;
    return (
        <div style={{ background:tk.card2, borderRadius:12, padding:'16px 18px', borderTop:`3px solid ${color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:tk.txt }}>{titulo}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: color + '22', color }}>
                    {meta > 0 ? (hit ? 'Meta alcanzada' : 'Meta pendiente') : 'Sin meta'}
                </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                    <div style={{ fontSize:10, color:tk.txt3, marginBottom:3 }}>Logrado</div>
                    <div style={{ fontSize:20, fontWeight:800, color:tk.txt }}>{fmtUSD(logrado, moneda)}</div>
                </div>
                <div>
                    <div style={{ fontSize:10, color:tk.txt3, marginBottom:3 }}>Meta</div>
                    <div style={{ fontSize:20, fontWeight:800, color:tk.txt }}>{fmtUSD(meta, moneda)}</div>
                </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:11, color:tk.txt2, fontWeight:600 }}>Avance</span>
                <span style={{ fontSize:14, fontWeight:800, color }}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ height:10, background:tk.bg, borderRadius:999, overflow:'hidden', border:`1px solid ${tk.bdr}` }}>
                <div style={{ height:'100%', width:`${pct}%`, background: hit ? 'linear-gradient(90deg,#10b981,#27ae60)' : 'linear-gradient(90deg,#e67e22,#f1c40f)', transition:'width 0.6s ease' }} />
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashStyles() {
    return {
        sel:  { padding:'8px 12px', borderRadius:8, border:`1px solid var(--input-bdr)`, fontSize:13, background:'var(--input-bg)', color:'var(--text-main)', outline:'none', fontFamily:'inherit' },
        card: { background:'var(--bg-card)', border:`1px solid var(--border)`, borderRadius:14, padding:'18px 20px', boxShadow:'var(--shadow-sm)' },
        ct:   { fontSize:13, fontWeight:700, color:'var(--text-heavy)', marginBottom:14, letterSpacing:-0.2 },
        td:   { padding:'10px 10px', color:'var(--text-main)' },
    };
}
