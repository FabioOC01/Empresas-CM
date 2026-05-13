import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Sector, LabelList } from 'recharts';

const renderActivePie = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.95} />
);
import { getVendedores, createActividad } from '../api/actividades';
import { useAuth } from '../context/AuthContext';
import useActividades from '../hooks/useActividades';
import { filterActs, fmtUSD, fmt, calcDuration, TIPOS, MESES, getTypeColor, ROL_TIPOS, totalGastosOperacion } from '../utils/crm';
import { canViewAll, getDisplayRoles, getEffectiveRoles, hasEffectiveRole, isGerenciaOnly } from '../utils/roles';
import ActividadModal from '../components/ActividadModal';
import Avatar from '../components/Avatar';
import { RolBadge } from '../components/Badge';
import PeriodoPicker from '../components/PeriodoPicker';
import { useTheme } from '../context/ThemeContext';
import { AlertIcon } from '../components/Icons';

const ESTADO_COLOR = { 'Pendiente': '#e67e22', 'En Progreso': '#10b981', 'Completado': '#27ae60', 'Ganada': '#2e7d32', 'Perdida': '#e74c3c' };
const TIPO_COLORS = ['#10b981', '#27ae60', '#e67e22', '#8e44ad', '#e74c3c', '#1abc9c', '#e91e63', '#4caf50', '#ff9800', '#9c27b0'];
const GRUPOS_MATRIZ = [
    { label: 'VENTAS', color: '#10b981', tipos: ['Venta', 'Cotización', 'Oportunidad'] },
    { label: 'CORPORATIVO', color: '#8e44ad', tipos: ['Homologación', 'Visita', 'Propuesta', 'Prospección', 'Primer Contacto', 'Reunión'] },
    { label: 'SOPORTE', color: '#16a085', tipos: ['Seguimiento', 'Soporte'] },
    { label: 'LOGISTICA', color: '#1565c0', tipos: ['Despacho', 'Inventario', 'Facturación'] },
    { label: 'MARKETING', color: '#e67e22', tipos: ['Publicidad', 'Piezas gráficas', 'Redes', 'Video', 'P. Gráficas Externas', 'P. Gráficas Internas', 'Actividad', 'Evento'] },
    { label: 'ADMIN', color: '#6b7a8d', tipos: ['Administrativa'] },
];
const ROLE_ORDER = ['Ventas', 'Corporativo', 'Marketing', 'Soporte Técnico', 'Logística', 'Finanzas', 'Admin', 'Gerencia', 'Retail'];
const ROLE_COLOR = {
    Gerencia: '#3f51b5',
    Admin: '#6b7a8d',
    Ventas: '#27ae60',
    Corporativo: '#8e44ad',
    Marketing: '#e91e63',
    'Soporte Técnico': '#16a085',
    'Logística': '#1565c0',
    Finanzas: '#0f766e',
    Retail: '#f57f17',
    'Sin rol': '#6b7a8d',
};

function tiposPermitidos(vendedor, rolTipos = ROL_TIPOS) {
    const roles = getEffectiveRoles(vendedor);
    if (roles.includes('Admin')) return null; // null = todos
    const set = new Set();
    roles.forEach(r => ((rolTipos && rolTipos[r]) || ROL_TIPOS[r] || []).forEach(t => set.add(t)));
    return set;
}

const isMarketing = (v) => hasEffectiveRole(v, 'Marketing') && !getEffectiveRoles(v).some((r) => ['Ventas', 'Retail'].includes(r));
const esCompletado = (actividad) => actividad?.estado === 'Completado';
const esGanada = (actividad) => actividad?.estado === 'Ganada';
const esPerdida = (actividad) => actividad?.estado === 'Perdida';
const rentabilidadBrutaActividad = (actividad) => {
    const facturacion = parseFloat(actividad?.precio_venta) || parseFloat(actividad?.monto) || 0;
    return facturacion - totalGastosOperacion(actividad);
};

function primaryRole(vendedor) {
    const roles = getDisplayRoles(vendedor);
    return ROLE_ORDER.find((rol) => roles.includes(rol)) || roles[0] || 'Sin rol';
}

function rolesParaCarrusel(vendedor) {
    const roles = getDisplayRoles(vendedor);
    if (!roles.length) return [];
    return [
        ...ROLE_ORDER.filter((rol) => roles.includes(rol)),
        ...roles.filter((rol) => !ROLE_ORDER.includes(rol)),
    ];
}

function cuentaEnMatriz(vendedor) {
    return getDisplayRoles(vendedor).length > 0;
}

function colorWithAlpha(hex, alpha) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return `rgba(107,122,141,${alpha})`;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

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
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
    const [trim, setTrim] = useState('');
    const [mes, setMes] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fTipo, setFTipo] = useState('');
    const [modal, setModal] = useState({ open: false, actividad: null });
    const [activePieIdx, setActivePieIdx] = useState(null);
    const [activeRoleIdx, setActiveRoleIdx] = useState(0);

    const ttStyle = {
        contentStyle: { background: tk.card, border: `1px solid ${tk.bdr}`, borderRadius: 8, fontSize: 12, color: tk.txt },
        itemStyle: { color: tk.txt2 },
        labelStyle: { color: tk.txt, fontWeight: 600 },
        cursor: { fill: tk.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
    };
    const axisProps = { tick: { fill: tk.txt2, fontSize: 11 } };

    const soloLecturaGerencia = isGerenciaOnly(user);
    const esAdminGerencia = canViewAll(user);

    useEffect(() => {
        getVendedores().then((vs) => {
            if (esAdminGerencia) {
                setVendedores(vs);
            } else {
                setVendedores(vs.filter((v) => v.id === user?.id));
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

    const vendedoresMatriz = vendedores.filter(cuentaEnMatriz);

    // Grupos visibles: solo los que aplican a al menos uno de los vendedores mostrados
    const gruposVisibles = gruposBase.filter(g => vendedoresMatriz.some(v => {
        const p = tiposPermitidos(v, rolTiposCfg);
        return p === null || g.tipos.some(t => p.has(t));
    }));

    const vendRanked = [...vendedores].sort((a, b) => {
        const mA = filtered.filter((x) => x.vendedor_id === a.id && esCompletado(x)).reduce((s, x) => s + rentabilidadBrutaActividad(x), 0);
        const mB = filtered.filter((x) => x.vendedor_id === b.id && esCompletado(x)).reduce((s, x) => s + rentabilidadBrutaActividad(x), 0);
        return mB - mA;
    });
    const vendRankedMatriz = vendRanked.filter(cuentaEnMatriz);
    const rolesConVendedores = [...new Set(vendRankedMatriz.flatMap(rolesParaCarrusel))];
    const rolesOrdenados = [
        ...ROLE_ORDER.filter((rol) => rolesConVendedores.includes(rol)),
        ...rolesConVendedores.filter((rol) => !ROLE_ORDER.includes(rol)),
    ];
    const roleGroups = rolesOrdenados.map((rol) => ({
        rol,
        color: ROLE_COLOR[rol] || '#6b7a8d',
        entries: vendRankedMatriz
            .map((v, rank) => ({ v, rank }))
            .filter(({ v }) => rolesParaCarrusel(v).includes(rol)),
    })).filter((g) => g.entries.length);
    const visibleRoleIdx = roleGroups.length ? Math.min(activeRoleIdx, roleGroups.length - 1) : 0;
    const activeRoleGroup = roleGroups[visibleRoleIdx] || roleGroups[0];

    useEffect(() => {
        if (roleGroups.length <= 1) return undefined;
        const t = setInterval(() => {
            setActiveRoleIdx((idx) => (idx + 1) % roleGroups.length);
        }, 5200);
        return () => clearInterval(t);
    }, [roleGroups.length]);
    const getVendorActs = (id) => filtered.filter((a) => a.vendedor_id === id);
    const matrixVendorIds = new Set(vendRankedMatriz.map((v) => v.id));
    const matrixFiltered = filtered.filter((a) => matrixVendorIds.has(a.vendedor_id));
    const getVisibleTypes = (v, grupo) => {
        const permitidos = tiposPermitidos(v, rolTiposCfg);
        return permitidos === null ? grupo.tipos : grupo.tipos.filter(t => permitidos.has(t));
    };
    const getGroupCount = (v, grupo) => {
        const tiposVisibles = getVisibleTypes(v, grupo);
        if (!tiposVisibles.length) return null;
        return getVendorActs(v.id).filter((a) => tiposVisibles.includes(a.tipo)).length;
    };
    const matrixMaxCell = Math.max(
        1,
        ...vendRankedMatriz.flatMap((v) => gruposVisibles.map((g) => getGroupCount(v, g) || 0))
    );
    const matrixColumns = `minmax(190px, 1.25fr) ${gruposVisibles.map(() => 'minmax(104px, 1fr)').join(' ')} 68px`;
    const matrixMinWidth = Math.max(560, 258 + gruposVisibles.length * 104);
    const showLegacyMatrix = false;

    const byVendCerrado = vendedores
        .filter((v) => !isMarketing(v))
        .map((v) => ({
            name: v.nombre.split(' ')[0],
            color: v.color,
            Monto: filtered.filter((a) => a.vendedor_id === v.id && esCompletado(a)).reduce((s, a) => s + rentabilidadBrutaActividad(a), 0),
        })).filter((x) => x.Monto > 0);

    const byTipo = TIPOS.map((t) => ({ name: t, value: filtered.filter((a) => a.tipo === t).length })).filter((x) => x.value > 0);

    const trend = MESES.map((m) => {
        const entry = { name: m };
        vendedores.forEach((v) => { entry[v.nombre.split(' ')[0]] = filtered.filter((a) => a.vendedor_id === v.id && a.mes === m).length; });
        return entry;
    }).filter((row) => vendedores.some((v) => row[v.nombre.split(' ')[0]] > 0));

    const handleSave = async (data) => {
        if (soloLecturaGerencia) return;
        await createActividad(data);
    };

    const matrixView = esAdminGerencia ? (
        <div className="team-matrix-scroll" style={{ overflowX: 'auto', paddingBottom: 2 }}>
            <div className="team-matrix-table" style={{ minWidth: matrixMinWidth, fontSize: 12 }}>
                <div className="team-matrix-grid team-matrix-head" style={{ display: 'grid', gridTemplateColumns: matrixColumns, alignItems: 'stretch', borderBottom: `1px solid ${tk.bdr}` }}>
                    <div style={{ padding: '8px 10px', color: tk.txt2, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Vendedor</div>
                    {gruposVisibles.map((g) => {
                        const total = matrixFiltered.filter((a) => g.tipos.includes(a.tipo)).length;
                        return (
                            <div key={g.label} style={{ padding: '8px 10px', textAlign: 'center', color: g.color, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                                {g.label}
                                <div style={{ color: tk.txt3, fontSize: 10, fontWeight: 700, marginTop: 3 }}>{total}</div>
                            </div>
                        );
                    })}
                    <div style={{ padding: '8px 10px', textAlign: 'center', color: tk.txt2, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Ganada</div>
                </div>

                {roleGroups.map((grupoRol) => (
                    <div key={grupoRol.rol}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 10px 5px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: grupoRol.color }} />
                            <span style={{ fontSize: 11, fontWeight: 900, color: grupoRol.color, textTransform: 'uppercase' }}>{grupoRol.rol}</span>
                            <span style={{ fontSize: 11, color: tk.txt3 }}>{grupoRol.entries.length}</span>
                        </div>

                        {grupoRol.entries.map(({ v }) => {
                            const vActs = getVendorActs(v.id);
                            return (
                                <div className="team-matrix-grid team-matrix-row" key={v.id} style={{ display: 'grid', gridTemplateColumns: matrixColumns, alignItems: 'stretch', borderTop: `1px solid ${tk.bdr}` }}>
                                    <div className="team-matrix-vendor" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px', minWidth: 0 }}>
                                        <Avatar vendedor={v} size="sm" />
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: tk.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nombre}</div>
                                            <div style={{ color: tk.txt3, fontSize: 10, marginTop: 3 }}>{primaryRole(v)} · {vActs.length} total</div>
                                        </div>
                                    </div>

                                    {gruposVisibles.map((g) => {
                                        const tiposVisibles = getVisibleTypes(v, g);
                                        if (!tiposVisibles.length) {
                                            return (
                                                <div className="team-matrix-cell" data-label={g.label} key={g.label} style={{ display: 'grid', placeItems: 'center', padding: 10, color: tk.txt3, borderLeft: `1px solid ${tk.bdr}` }}>
                                                    -
                                                </div>
                                            );
                                        }
                                        const n = vActs.filter((a) => tiposVisibles.includes(a.tipo)).length;
                                        const alpha = n ? 0.08 + (n / matrixMaxCell) * (tk.isDark ? 0.28 : 0.22) : 0;
                                        const breakdown = tiposVisibles
                                            .map((t) => ({ t, n: vActs.filter((a) => a.tipo === t).length }))
                                            .filter((x) => x.n > 0)
                                            .slice(0, 2);
                                        return (
                                            <div className="team-matrix-cell" data-label={g.label} key={g.label} style={{ padding: '9px 10px', textAlign: 'center', borderLeft: `1px solid ${tk.bdr}`, background: n ? colorWithAlpha(g.color, alpha) : 'transparent', minWidth: 0 }}>
                                                {n ? (
                                                    <>
                                                        <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1, color: g.color }}>{n}</div>
                                                        <div style={{ marginTop: 5, fontSize: 10, color: tk.txt3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {breakdown.map((x) => `${x.t.split(' ')[0]} ${x.n}`).join(' · ')}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span style={{ color: tk.txt3 }}>0</span>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <div className="team-matrix-total" data-label="Ganada" style={{ display: 'grid', placeItems: 'center', padding: 10, borderLeft: `1px solid ${tk.bdr}`, fontWeight: 900, color: tk.txt }}>
                                        {vActs.filter(esGanada).length}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {!roleGroups.length && (
                    <div style={{ padding: 28, textAlign: 'center', color: tk.txt3 }}>
                        Sin vendedores
                    </div>
                )}
            </div>
        </div>
    ) : (() => {
        const yo = vendedores[0];
        const vActs = yo ? getVendorActs(yo.id) : [];
        const rolesYo = getEffectiveRoles(yo).filter(r => r !== 'Admin');
        const esAdminYo = getEffectiveRoles(yo).includes('Admin');

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
            <div style={{ display: 'grid', gap: 16 }}>
                {yo && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) repeat(3, minmax(72px, 92px))', gap: 10, alignItems: 'center', paddingBottom: 14, borderBottom: `1px solid ${tk.bdr}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <Avatar vendedor={yo} size="sm" />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: tk.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{yo.nombre}</div>
                                <div style={{ fontSize: 11, color: tk.txt3 }}>{primaryRole(yo)}</div>
                            </div>
                        </div>
                        {[
                            ['Proceso', vActs.filter(a => a.estado === 'En Progreso').length],
                            ['Cerrado', vActs.filter(esCompletado).length],
                            ['Ganada', vActs.filter(esGanada).length],
                        ].map(([label, value]) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: tk.txt }}>{value}</div>
                                <div style={{ fontSize: 10, color: tk.txt3 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {bloques.map(({ rol, tipos: tiposCol }) => {
                    const maxTipo = Math.max(1, ...tiposCol.map((t) => vActs.filter((a) => a.tipo === t).length));
                    return (
                        <div key={rol}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 900, color: ROLE_COLOR[rol] || tk.txt2, textTransform: 'uppercase' }}>{rol}</div>
                                <div style={{ fontSize: 11, color: tk.txt3 }}>{vActs.filter(a => tiposCol.includes(a.tipo)).length}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}>
                                {tiposCol.map((t) => {
                                    const n = vActs.filter((a) => a.tipo === t).length;
                                    const c = getTypeColor(t);
                                    const alpha = n ? 0.08 + (n / maxTipo) * (tk.isDark ? 0.26 : 0.20) : 0;
                                    return (
                                        <div key={t} style={{ minHeight: 64, padding: '9px 10px', border: `1px solid ${n ? c.color + '42' : tk.bdr}`, borderRadius: 6, background: n ? colorWithAlpha(c.color, alpha) : 'transparent' }}>
                                            <div style={{ fontSize: 20, fontWeight: 900, color: n ? c.color : tk.txt3, lineHeight: 1 }}>{n}</div>
                                            <div style={{ marginTop: 8, fontSize: 11, color: tk.txt2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    })();

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 10, minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tk.txt }}>
                            Ranking por rol
                        </div>
                        <div style={{ fontSize: 11, color: tk.txt3, marginTop: 3 }}>
                            {activeRoleGroup
                                ? `${activeRoleGroup.rol} · ${activeRoleGroup.entries.length} ${activeRoleGroup.entries.length === 1 ? 'vendedor' : 'vendedores'}`
                                : 'Sin vendedores'}
                        </div>
                    </div>
                    {roleGroups.length > 1 && (
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, flexShrink: 0, maxWidth: '68%' }}>
                            {roleGroups.map((g, idx) => {
                                const active = idx === visibleRoleIdx;
                                return (
                                    <button
                                        key={g.rol}
                                        type="button"
                                        onClick={() => setActiveRoleIdx(idx)}
                                        style={{
                                            height: 28,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            border: `1px solid ${active ? g.color + '66' : tk.bdr}`,
                                            borderRadius: 999,
                                            background: active ? g.color + (tk.isDark ? '26' : '16') : tk.card,
                                            color: active ? g.color : tk.txt2,
                                            padding: '0 10px',
                                            fontSize: 11,
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                                        {g.rol}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            width: '100%',
                            transform: `translateX(-${visibleRoleIdx * 100}%)`,
                            transition: 'transform 0.6s cubic-bezier(.22,1,.36,1)',
                        }}
                    >
                        {(roleGroups.length ? roleGroups : [{ rol: 'Sin rol', color: tk.accent, entries: [] }]).map((g) => (
                            <div key={g.rol} style={{ flex: '0 0 100%', minWidth: 0 }}>
                                <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(188px, 214px)', gap: 14, overflowX: 'auto', overflowY: 'hidden', padding: '2px 2px 6px' }}>
                                    {g.entries.map(({ v, rank }) => {
                                        const vActs = filtered.filter((a) => a.vendedor_id === v.id);
                                        const cerr = vActs.filter(esCompletado);
                                        const ganadas = vActs.filter(esGanada);
                                        const perdidas = vActs.filter(esPerdida);
                                        const avanceCount = cerr.length + ganadas.length + perdidas.length;
                                        const pct = vActs.length ? Math.round(avanceCount / vActs.length * 100) : 0;
                                        const enProgreso = vActs.filter(a => a.estado === 'En Progreso').length;
                                        const rentabilidadBrutaCerrada = ganadas.reduce((s, a) => s + rentabilidadBrutaActividad(a), 0);
                                        const isTop = rank < 2;
                                        const vColor = v.color || g.color;
                                        const rankTone = rank === 0
                                            ? { bg: '#fff4d7', fg: '#8a5a00', border: '#f1c45c' }
                                            : rank === 1
                                                ? { bg: tk.isDark ? 'rgba(148,163,184,0.18)' : '#eef2f7', fg: tk.isDark ? '#cbd5e1' : '#5f6f86', border: tk.isDark ? 'rgba(148,163,184,0.25)' : '#d8e1ec' }
                                                : { bg: tk.card2, fg: tk.txt3, border: tk.bdr };
                                        const roles = getDisplayRoles(v);
                                        return (
                                            <div
                                                key={v.id}
                                                style={{
                                                    background: `linear-gradient(160deg, ${vColor}1f 0%, ${tk.card} 36%, ${tk.card} 100%)`,
                                                    border: `1px solid ${tk.isDark ? vColor + '2e' : vColor + '24'}`,
                                                    borderRadius: 8,
                                                    padding: '13px 13px 12px',
                                                    boxShadow: tk.shadow,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    minHeight: 188,
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                                                    <div
                                                        style={{
                                                            width: 64,
                                                            height: 64,
                                                            borderRadius: '50%',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            flexShrink: 0,
                                                            background: `conic-gradient(${vColor} ${pct * 3.6}deg, ${tk.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'} 0deg)`,
                                                            boxShadow: `0 0 0 1px ${tk.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
                                                        }}
                                                    >
                                                        <div style={{ padding: 4, borderRadius: '50%', background: tk.card }}>
                                                            <Avatar vendedor={v} size="xl" />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                                                        <span
                                                            style={{
                                                                height: 24,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                borderRadius: 999,
                                                                border: `1px solid ${rankTone.border}`,
                                                                background: rankTone.bg,
                                                                color: rankTone.fg,
                                                                padding: isTop ? '0 10px' : '0 8px',
                                                                fontSize: 11,
                                                                fontWeight: 800,
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            {isTop ? `Top ${rank + 1}` : `#${rank + 1}`}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 118 }}>
                                                            {roles.slice(0, 2).map((r) => <RolBadge key={r} rol={r} />)}
                                                            {roles.length > 2 && (
                                                                <span style={{ padding: '2px 7px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: tk.txt3, background: tk.card2 }}>
                                                                    +{roles.length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 800, fontSize: 14, color: tk.txt, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {v.nombre}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: tk.txt3, marginTop: 4, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {fmt$(rentabilidadBrutaCerrada)} rent. bruta
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: tk.txt3, marginBottom: 6 }}>
                                                        <span>Avance</span>
                                                        <span style={{ color: tk.txt2, fontWeight: 800 }}>{pct}%</span>
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 999, background: tk.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: vColor, transition: 'width 0.25s ease' }} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                                                    {[
                                                        ['En progreso', enProgreso, '#2862c8'],
                                                        ['Completado', cerr.length, '#079669'],
                                                        ['Ganada', ganadas.length, vColor],
                                                    ].map(([l, val, color]) => (
                                                        <div key={l} style={{ minWidth: 0, paddingTop: 8, borderTop: `1px solid ${tk.bdr}` }}>
                                                            <div style={{ fontSize: 19, fontWeight: 850, color, lineHeight: 1 }}>{val}</div>
                                                            <div style={{ fontSize: 10, color: tk.txt3, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!g.entries.length && (
                                        <div style={{ color: tk.txt3, fontSize: 12, padding: 20 }}>
                                            Sin vendedores
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <div>
                            <div style={ct}>{esAdminGerencia ? 'Matriz operativa' : 'Tu matriz operativa'}</div>
                            <div style={{ fontSize: 11, color: tk.txt3, marginTop: 3 }}>{matrixFiltered.length} actividades filtradas</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {gruposVisibles.slice(0, 4).map((g) => {
                                const total = matrixFiltered.filter((a) => g.tipos.includes(a.tipo)).length;
                                return (
                                    <span key={g.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px', borderRadius: 999, background: colorWithAlpha(g.color, tk.isDark ? 0.18 : 0.10), color: g.color, fontSize: 11, fontWeight: 800 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color }} />
                                        {g.label} {total}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    {matrixView}
                    {showLegacyMatrix && (esAdminGerencia ? (
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
                        const rolesYo = getEffectiveRoles(yo).filter(r => r !== 'Admin');
                        const esAdminYo = getEffectiveRoles(yo).includes('Admin');

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
                                                        const c = getTypeColor(t);
                                                        return (
                                                            <th key={t} style={{ ...th, textAlign: 'center', color: c.color }}>
                                                                {t}
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
                                                            const c = getTypeColor(t);
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
                    })())}
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
                            const tc = getTypeColor(a.tipo);
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
                                            {a.tipo}
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
