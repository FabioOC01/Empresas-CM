import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Sector, LabelList } from 'recharts';

const renderActivePie = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.95} />
);
import { getVendedores, createActividad } from '../api/actividades';
import { useAuth } from '../context/AuthContext';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, fmt, calcDuration, TIPOS, MESES, TYPE_COLOR, TYPE_ICON, ROL_TIPOS } from '../utils/crm';
import ActividadModal from '../components/ActividadModal';
import Avatar from '../components/Avatar';
import { RolBadge } from '../components/Badge';
import PeriodoPicker from '../components/PeriodoPicker';
import { useTheme } from '../context/ThemeContext';

const ESTADO_COLOR = { 'Pendiente': '#e67e22', 'En Progreso': '#10b981', 'Completado': '#27ae60', 'Ganada': '#2e7d32', 'Perdida': '#e74c3c' };
const TIPO_COLORS = ['#10b981', '#27ae60', '#e67e22', '#8e44ad', '#e74c3c', '#1abc9c', '#e91e63', '#4caf50', '#ff9800', '#9c27b0'];
const GRUPOS_MATRIZ = [
    { label: 'VENTAS', color: '#10b981', tipos: ['Venta', 'Propuesta', 'Oportunidad'] },
    { label: 'CORPORATIVO', color: '#8e44ad', tipos: ['Cotización', 'Homologación', 'Visita'] },
    { label: 'SOPORTE', color: '#16a085', tipos: ['Seguimiento', 'Soporte'] },
    { label: 'LOGISTICA', color: '#1565c0', tipos: ['Despacho', 'Inventario', 'Facturación'] },
    { label: 'MARKETING', color: '#e67e22', tipos: ['Publicidad', 'Piezas gráficas', 'Redes'] },
    { label: 'ADMIN', color: '#6b7a8d', tipos: ['Administrativa'] },
];

function tiposPermitidos(vendedor, rolTipos = ROL_TIPOS) {
    const roles = vendedor?.roles || [];
    if (roles.includes('Admin')) return null; // null = todos
    const set = new Set();
    roles.forEach(r => ((rolTipos && rolTipos[r]) || ROL_TIPOS[r] || []).forEach(t => set.add(t)));
    return set;
}

const isMarketing = (v) => v?.roles?.includes('Marketing') && !v?.roles?.some((r) => ['Ventas', 'Gerencia', 'Retail'].includes(r));

export default function Equipo() {
    const { actividades, config } = useActividades();
    const tk = useTheme();
    const fmt$ = (n) => fmtUSD(n, config?.moneda || 'USD');
    const { user } = useAuth();

    const sel = { padding: '7px 12px', borderRadius: 7, border: `1px solid ${tk.bdr}`, fontSize: 13, background: tk.card, color: tk.txt };
    const card = { background: tk.card, borderRadius: 10, padding: '18px 20px', boxShadow: tk.shadow };
    const ct = { fontSize: 13, fontWeight: 700, color: tk.txt, marginBottom: 0 };
    const th = { padding: '8px 10px', textAlign: 'left', color: tk.txt2, fontWeight: 700, fontSize: 11 };
    const td = { padding: '10px 10px', color: tk.txt };
    const [vendedores, setVendedores] = useState([]);
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
    const [trim, setTrim] = useState('');
    const [mes, setMes] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fTipo, setFTipo] = useState('');
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [activePieIdx, setActivePieIdx] = useState(null);

    const ttStyle = {
        contentStyle: { background: tk.card, border: `1px solid ${tk.bdr}`, borderRadius: 8, fontSize: 12, color: tk.txt },
        itemStyle: { color: tk.txt2 },
        labelStyle: { color: tk.txt, fontWeight: 600 },
        cursor: { fill: tk.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
    };
    const axisProps = { tick: { fill: tk.txt2, fontSize: 11 } };

    const esAdminGerencia = user?.is_superadmin || user?.roles?.some((r) => ['Admin', 'Gerencia'].includes(r));

    useEffect(() => {
        getVendedores().then((vs) => {
            const sinAdminGerencia = vs.filter((v) => !v.roles?.some((r) => ['Admin', 'Gerencia'].includes(r)));
            if (esAdminGerencia) {
                setVendedores(sinAdminGerencia);
            } else {
                setVendedores(sinAdminGerencia.filter((v) => v.id === user?.id));
            }
        });
    }, [esAdminGerencia, user?.id]);

    const filtered = filterActs(actividades, {
        trimestre: trim || undefined,
        mes: mes || undefined,
        estado: fEstado || undefined,
        tipo: fTipo || undefined,
    }).filter((a) => esAdminGerencia || a.vendedor_id === user?.id);

    const rolTiposCfg = config?.rol_tipos || ROL_TIPOS;
    const tiposCfg    = config?.tipos_actividad || TIPOS;

    // Tipos extra no contemplados en los grupos base (ej. nuevos tipos agregados por config)
    const tiposEnGrupos = new Set(GRUPOS_MATRIZ.flatMap(g => g.tipos));
    const tiposExtra    = tiposCfg.filter(t => !tiposEnGrupos.has(t));
    const gruposBase = tiposExtra.length
        ? [...GRUPOS_MATRIZ, { label: 'OTROS', color: '#6b7a8d', tipos: tiposExtra }]
        : GRUPOS_MATRIZ;

    // Grupos visibles: solo los que aplican a al menos uno de los vendedores mostrados
    const gruposVisibles = gruposBase.filter(g => vendedores.some(v => {
        const p = tiposPermitidos(v, rolTiposCfg);
        return p === null || g.tipos.some(t => p.has(t));
    }));

    const vendRanked = [...vendedores].sort((a, b) => {
        const mA = filtered.filter((x) => x.vendedor_id === a.id && x.estado === 'Completado').reduce((s, x) => s + Number(x.monto), 0);
        const mB = filtered.filter((x) => x.vendedor_id === b.id && x.estado === 'Completado').reduce((s, x) => s + Number(x.monto), 0);
        return mB - mA;
    });

    const totalActs = filtered.length;
    const pctGlobal = totalActs ? Math.round(filtered.filter((a) => a.estado === 'Completado').length / totalActs * 100) : 0;
    const avanceData = ['Completado', 'En Progreso', 'Pendiente', 'Perdida'].map((e) => ({
        name: e, value: filtered.filter((a) => a.estado === e).length,
    }));

    const altasPendientes = [...filtered]
        .filter((a) => a.prioridad === 'Alta' && ['Pendiente', 'En Progreso'].includes(a.estado))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5);

    const byVendCerrado = vendedores
        .filter((v) => !isMarketing(v))
        .map((v) => ({
            name: v.nombre.split(' ')[0],
            color: v.color,
            Monto: filtered.filter((a) => a.vendedor_id === v.id && a.estado === 'Completado').reduce((s, a) => s + Number(a.monto), 0),
        })).filter((x) => x.Monto > 0);

    const byTipo = TIPOS.map((t) => ({ name: t, value: filtered.filter((a) => a.tipo === t).length })).filter((x) => x.value > 0);

    const trend = MESES.map((m) => {
        const entry = { name: m };
        vendedores.forEach((v) => { entry[v.nombre.split(' ')[0]] = filtered.filter((a) => a.vendedor_id === v.id && a.mes === m).length; });
        return entry;
    }).filter((row) => vendedores.some((v) => row[v.nombre.split(' ')[0]] > 0));

    const handleSave = async (data) => {
        await createActividad(data);
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(vendRanked.length, 1)},1fr)`, gap: 14, marginBottom: 20 }}>
                {vendRanked.map((v, i) => {
                    const vActs = filtered.filter((a) => a.vendedor_id === v.id);
                    const cerr = vActs.filter((a) => a.estado === 'Completado');
                    const pct = vActs.length ? Math.round(cerr.length / vActs.length * 100) : 0;
                    return (
                        <div key={v.id} style={{ background: tk.card, borderRadius: 10, padding: '16px 14px', boxShadow: tk.shadow, textAlign: 'center', position: 'relative' }}>
                            {i < 2 && (
                                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 18 }}>
                                    {i === 0 ? '🥇' : '🥈'}<span style={{ fontSize: 11, fontWeight: 700, color: tk.txt2 }}>#{i + 1}</span>
                                </div>
                            )}
                            {i >= 2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: tk.txt3, fontWeight: 600 }}>#{i + 1}</div>}

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                                <Avatar vendedor={v} size="xl" />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: tk.txt }}>{v.nombre}</div>
                            <div style={{ fontSize: 11, color: tk.txt3, marginBottom: 8 }}>{esAdminGerencia ? 'Vista de equipo' : 'Tu vista personal'}</div>

                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                                {v.roles?.map((r) => <RolBadge key={r} rol={r} />)}
                            </div>

                            <div style={{ height: 4, background: tk.bdr, borderRadius: 2, marginBottom: 12 }}>
                                <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: v.color, transition: 'width 0.4s' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                                {[['TOTAL', vActs.length], ['CERRADO', cerr.length], ['AVANCE', `${pct}%`]].map(([l, val]) => (
                                    <div key={l}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: tk.txt }}>{val}</div>
                                        <div style={{ fontSize: 9, color: tk.txt3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                    <div style={{ marginBottom: 14 }}>
                        <div style={ct}>{esAdminGerencia ? 'Matriz de Actividades por Vendedor' : 'Tu matriz de actividades'}</div>
                    </div>
                    {esAdminGerencia ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${tk.bdr}` }}>
                                    <th style={{ ...th, width: '22%' }}>VENDEDOR</th>
                                    {gruposVisibles.map((g) => (
                                        <th key={g.label} style={{ ...th, textAlign: 'center', color: g.color }}>
                                            {g.label}
                                            <div style={{ fontSize: 9, color: tk.txt3, fontWeight: 400, marginTop: 1 }}>
                                                {g.tipos.join(' · ')}
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ ...th, textAlign: 'center' }}>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendedores.map((v) => {
                                    const vActs = filtered.filter((a) => a.vendedor_id === v.id);
                                    const permitidos = tiposPermitidos(v, rolTiposCfg);
                                    return (
                                        <tr key={v.id} style={{ borderBottom: `1px solid ${tk.bdr}` }}>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Avatar vendedor={v} size="sm" />
                                                    <span style={{ fontWeight: 600, color: tk.txt }}>{v.nombre}</span>
                                                </div>
                                            </td>
                                            {gruposVisibles.map((g) => {
                                                const tiposVisibles = permitidos === null ? g.tipos : g.tipos.filter(t => permitidos.has(t));
                                                if (tiposVisibles.length === 0) {
                                                    return <td key={g.label} style={{ padding: '10px', textAlign: 'center', color: tk.txt3 }}>—</td>;
                                                }
                                                const n = vActs.filter((a) => tiposVisibles.includes(a.tipo)).length;
                                                const breakdown = tiposVisibles
                                                    .map((t) => ({ t, n: vActs.filter((a) => a.tipo === t).length }))
                                                    .filter((x) => x.n > 0);
                                                return (
                                                    <td key={g.label} style={{ padding: '10px', textAlign: 'center' }}>
                                                        {n > 0 ? (
                                                            <div>
                                                                <div style={{ fontWeight: 800, fontSize: 15, color: g.color }}>{n}</div>
                                                                <div style={{ fontSize: 10, color: tk.txt3, marginTop: 2 }}>
                                                                    {breakdown.map((x) => `${x.t.split(' ')[0]} ${x.n}`).join(' · ')}
                                                                </div>
                                                            </div>
                                                        ) : <span style={{ color: tk.txt3 }}>—</span>}
                                                    </td>
                                                );
                                            })}
                                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: tk.txt }}>{vActs.length}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (() => {
                        const yo = vendedores[0];
                        const vActs = yo ? filtered.filter((a) => a.vendedor_id === yo.id) : [];
                        const rolesYo = (yo?.roles || []).filter(r => r !== 'Admin' && r !== 'Gerencia');
                        const esAdminYo = (yo?.roles || []).includes('Admin');

                        const bloques = (esAdminYo || rolesYo.length <= 1)
                            ? [{
                                rol: rolesYo[0] || 'General',
                                tipos: esAdminYo
                                    ? tiposCfg
                                    : tiposCfg.filter(t => (rolTiposCfg[rolesYo[0]] || []).includes(t)),
                              }]
                            : rolesYo.map(r => ({
                                rol: r,
                                tipos: tiposCfg.filter(t => (rolTiposCfg[r] || []).includes(t)),
                              })).filter(b => b.tipos.length > 0);

                        return (
                            <div style={{ display: 'grid', gap: 18 }}>
                                {bloques.map(({ rol, tipos: tiposCol }) => (
                                    <div key={rol}>
                                        {bloques.length > 1 && (
                                            <div style={{ fontSize: 11, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                                {rol}
                                            </div>
                                        )}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead>
                                                <tr style={{ borderBottom: `2px solid ${tk.bdr}` }}>
                                                    <th style={{ ...th, width: '22%' }}>VENDEDOR</th>
                                                    {tiposCol.map((t) => {
                                                        const c = TYPE_COLOR[t] || { color: tk.txt2 };
                                                        return (
                                                            <th key={t} style={{ ...th, textAlign: 'center', color: c.color }}>
                                                                {TYPE_ICON[t] || ''} {t}
                                                            </th>
                                                        );
                                                    })}
                                                    <th style={{ ...th, textAlign: 'center' }}>TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {yo && (
                                                    <tr style={{ borderBottom: `1px solid ${tk.bdr}` }}>
                                                        <td style={{ padding: '10px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Avatar vendedor={yo} size="sm" />
                                                                <span style={{ fontWeight: 600, color: tk.txt }}>{yo.nombre}</span>
                                                            </div>
                                                        </td>
                                                        {tiposCol.map((t) => {
                                                            const n = vActs.filter((a) => a.tipo === t).length;
                                                            const c = TYPE_COLOR[t] || { color: tk.txt2 };
                                                            return (
                                                                <td key={t} style={{ padding: '10px', textAlign: 'center' }}>
                                                                    {n > 0
                                                                        ? <span style={{ fontWeight: 800, fontSize: 15, color: c.color }}>{n}</span>
                                                                        : <span style={{ color: tk.txt3 }}>—</span>}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: tk.txt }}>
                                                            {vActs.filter(a => tiposCol.includes(a.tipo)).length}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={card}>
                        <div style={ct}>{esAdminGerencia ? 'Avance General del Equipo' : 'Tu avance general'}</div>
                        <div style={{ position: 'relative', height: 160 }}>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={avanceData} cx="40%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value" startAngle={90} endAngle={-270}>
                                        {avanceData.map((e, i) => <Cell key={i} fill={ESTADO_COLOR[e.name] || '#eee'} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: '50%', left: '40%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: tk.txt }}>{pctGlobal}%</div>
                                <div style={{ fontSize: 10, color: tk.txt3 }}>Completado</div>
                            </div>
                        </div>
                    </div>

                    <div style={card}>
                        <div style={ct}>Prioridades Alta Pendientes</div>
                        {altasPendientes.length === 0 && <div style={{ fontSize: 12, color: tk.txt3, textAlign: 'center', padding: '12px 0' }}>Sin alertas urgentes</div>}
                        {altasPendientes.map((a) => {
                            const v = vendedores.find((x) => x.id === a.vendedor_id);
                            const mkt = isMarketing(v);
                            return (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${tk.bdr}` }}>
                                    <span style={{ fontSize: 16 }}>⚠️</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: tk.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</div>
                                        <div style={{ fontSize: 10, color: tk.txt3 }}>{v?.nombre.split(' ')[0]} · {a.mes}</div>
                                    </div>
                                    {!mkt && <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', flexShrink: 0 }}>{fmt$(a.monto)}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                    <div style={ct}>Montos Cerrados por Vendedor</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={byVendCerrado} margin={{ top: 24, right: 8, left: -10, bottom: 0 }}>
                            <XAxis dataKey="name" {...axisProps} />
                            <YAxis {...axisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} cursor={ttStyle.cursor} formatter={(v) => fmt$(v)} />
                            <Bar dataKey="Monto" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out">
                                {byVendCerrado.map((e, i) => <Cell key={i} fill={e.color} />)}
                                <LabelList dataKey="Monto" position="top" formatter={(v) => `${(v / 1000).toFixed(0)}k`} style={{ fill: tk.txt2, fontSize: 11, fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Tipos de Actividad</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={byTipo}
                                cx="50%"
                                cy="55%"
                                outerRadius={75}
                                innerRadius={40}
                                dataKey="value"
                                activeIndex={activePieIdx ?? undefined}
                                activeShape={renderActivePie}
                                onMouseEnter={(_, i) => setActivePieIdx(i)}
                                onMouseLeave={() => setActivePieIdx(null)}
                                animationDuration={700}
                                animationEasing="ease-out"
                            >
                                {byTipo.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize: 10, color: tk.txt2 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div style={card}>
                    <div style={ct}>Tendencia Mensual</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={trend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                            <defs>
                                {vendedores.map((v) => (
                                    <linearGradient key={v.id} id={`grad_${v.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={v.color} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={v.color} stopOpacity={0.03} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <XAxis dataKey="name" {...axisProps} />
                            <YAxis {...axisProps} allowDecimals={false} />
                            <Tooltip contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} cursor={ttStyle.cursor} />
                            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize: 10, color: tk.txt2 }} />
                            {vendedores.map((v) => (
                                <Area key={v.id} type="monotone" dataKey={v.nombre.split(' ')[0]} stroke={v.color} strokeWidth={2} fill={`url(#grad_${v.id})`} dot={{ r: 3, fill: v.color }} animationDuration={800} animationEasing="ease-out" />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={ct}>{esAdminGerencia ? 'Actividades del Equipo' : 'Tus actividades'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <PeriodoPicker trim={trim} mes={mes} onTrim={setTrim} onMes={setMes} />
                        <select style={sel} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                            <option value="">Todos los estados</option>
                            {['Pendiente', 'En Progreso', 'Completado', 'Ganada', 'Perdida'].map((e) => <option key={e}>{e}</option>)}
                        </select>
                        <select style={sel} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                            <option value="">Todos los tipos</option>
                            {TIPOS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: `2px solid ${tk.bdr}` }}>
                            {['VENDEDOR', 'ACTIVIDAD', 'TIPO', 'CLIENTE', 'PRIORIDAD', 'ESTADO', 'MES', 'MONTO', 'TIEMPO'].map((h) => (
                                <th key={h} style={th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a) => {
                            const v = vendedores.find((x) => x.id === a.vendedor_id);
                            const mkt = isMarketing(v);
                            const tc = TYPE_COLOR[a.tipo] || { bg: '#eee', color: '#333' };
                            return (
                                <tr key={a.id} style={{ borderBottom: `1px solid ${tk.bdr}` }}>
                                    <td style={td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Avatar vendedor={v} size="sm" />
                                            <span style={{ fontSize: 12 }}>{v?.nombre}</span>
                                        </div>
                                    </td>
                                    <td style={td}>
                                        <div style={{ fontWeight: 600 }}>{a.nombre}</div>
                                        {a.notas && <div style={{ fontSize: 11, color: tk.txt3 }}>{a.notas}</div>}
                                    </td>
                                    <td style={td}>
                                        <span style={{ padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: tc.color + (tk.isDark ? '28' : '1a'), color: tk.isDark ? '#cbd5e1' : tc.color, whiteSpace: 'nowrap' }}>
                                            {TYPE_ICON[a.tipo]} {a.tipo}
                                        </span>
                                    </td>
                                    <td style={td}>{a.cliente}</td>
                                    <td style={td}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.prioridad === 'Alta' ? '#e74c3c' : a.prioridad === 'Media' ? '#e67e22' : '#27ae60', flexShrink: 0 }} />
                                            {a.prioridad}
                                        </span>
                                    </td>
                                    <td style={td}>
                                        {(() => {
                                            const ec = ESTADO_COLOR[a.estado] || '#8899aa';
                                            return (
                                                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ec + (tk.isDark ? '38' : '1e'), color: ec }}>
                                                    {a.estado}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={td}>{a.mes}</td>
                                    <td style={{ ...td, fontWeight: 700, color: mkt ? '#8899aa' : '#10b981' }}>
                                        {mkt ? '—' : fmt$(a.monto)}
                                    </td>
                                    <td style={td}>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: tk.txt2 }}>{fmt(calcDuration(a, now))}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!filtered.length && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: tk.txt3 }}>Sin actividades</td></tr>}
                    </tbody>
                </table>
            </div>

            <ActividadModal
                open={modal.open}
                actividad={null}
                vendedores={vendedores}
                onClose={() => setModal({ open: false, actividad: null })}
                onSave={handleSave}
            />
        </div>
    );
}
