import { useEffect, useMemo, useState } from 'react';
import { getAttendanceHealth, getAttendanceSummary, getVendedores, syncAttendance } from '../api/actividades';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useRolFilter from '../hooks/useRolFilter';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import Avatar from '../components/Avatar';

const STATUS_STYLES = {
    'A tiempo': { bg: '#dcfce7', color: '#166534' },
    'Tardanza': { bg: '#fef3c7', color: '#92400e' },
    'Ausente': { bg: '#fee2e2', color: '#991b1b' },
    'Sin vincular': { bg: '#e0f2fe', color: '#075985' },
    'Sin marcación de salida': { bg: '#ede9fe', color: '#5b21b6' },
};

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function fmtSyncDate(value) {
    if (!value) return 'Sin sincronizacion';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin sincronizacion';
    return date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function inputStyle(tk, width) {
    return {
        width,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${tk.bdr}`,
        background: tk.inp,
        color: tk.txt,
        outline: 'none',
        fontFamily: 'inherit',
        fontSize: 13,
    };
}

function StatusBadge({ status, tk }) {
    const style = STATUS_STYLES[status] || { bg: tk.card2, color: tk.txt2 };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: tk.isDark ? `${style.color}26` : style.bg,
            color: style.color,
            whiteSpace: 'nowrap',
        }}>
            {status}
        </span>
    );
}

export default function Asistencia() {
    const tk = useTheme();
    const { user } = useAuth();
    const vendedorForzado = useRolFilter();
    const canManage = user?.is_superadmin || user?.roles?.some(r => ['Admin', 'Gerencia'].includes(r));

    const [fecha, setFecha] = useState(todayIso());
    const [estado, setEstado] = useState('');
    const [sede, setSede] = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [rows, setRows] = useState([]);
    const [vendedores, setVendedores] = useState([]);
    const [config, setConfig] = useState(null);
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [msg, setMsg] = useState(null);

    const fetchPage = async (skipSpinner = false) => {
        if (!skipSpinner) setLoading(true);
        try {
            const [summary, healthData] = await Promise.all([
                getAttendanceSummary({
                    fecha,
                    estado: estado || undefined,
                    sede: sede || undefined,
                    vendedorId: vendedorForzado || vendedorId || undefined,
                }),
                getAttendanceHealth(),
            ]);
            setRows(summary.rows || []);
            setConfig(summary.config || null);
            setHealth(healthData || null);
            setMsg(null);
        } catch (err) {
            setMsg({ type: 'err', text: err.response?.data?.error || 'No se pudo cargar la asistencia.' });
        } finally {
            if (!skipSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        if (!canManage) {
            setLoading(false);
            return;
        }
        getVendedores()
            .then(data => setVendedores(data.filter(v => v.asistencia_activa !== false)))
            .catch(() => {});
    }, [canManage]);

    useEffect(() => {
        if (!canManage) {
            setLoading(false);
            return;
        }
        fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage, fecha, estado, sede, vendedorId, vendedorForzado]);

    const kpis = useMemo(() => {
        const presentes = rows.filter(r => ['A tiempo', 'Tardanza', 'Sin marcación de salida'].includes(r.estado)).length;
        return {
            presentes,
            tardanzas: rows.filter(r => r.estado === 'Tardanza').length,
            ausentes: rows.filter(r => r.estado === 'Ausente').length,
            sinVincular: rows.filter(r => r.estado === 'Sin vincular').length,
        };
    }, [rows]);

    const sedes = useMemo(() => {
        const fromConfig = Array.isArray(config?.sedes) ? config.sedes : [];
        const fromRows = rows.map(r => r.sede).filter(Boolean);
        return [...new Set([...fromConfig, ...fromRows])].sort();
    }, [config, rows]);

    const handleSync = async () => {
        setSyncing(true);
        setMsg(null);
        try {
            const result = await syncAttendance({ desde: fecha, hasta: fecha });
            setMsg({
                type: 'ok',
                text: `Sincronizacion completada. ${result.records_inserted} nueva(s) de ${result.records_fetched} marcacion(es).`,
            });
            await fetchPage(true);
        } catch (err) {
            setMsg({ type: 'err', text: err.response?.data?.error || 'No se pudo sincronizar la asistencia.' });
        } finally {
            setSyncing(false);
        }
    };

    if (!canManage) {
        return (
            <div style={{ display: 'grid', gap: 18 }}>
                <PageHeader
                    title="Próximamente"
                    subtitle="El módulo de asistencia estará disponible pronto para vendedores."
                />

                <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                    <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>🕒</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: tk.txt, marginBottom: 8 }}>
                        Módulo en desarrollo
                    </div>
                    
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: 18 }}>
            <PageHeader
                title="Asistencia"
                subtitle="Resumen diario de ingreso y marcaciones de vendedores."
                actions={canManage ? (
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            padding: '9px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: syncing ? '#9ca3af' : '#10b981',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: syncing ? 'default' : 'pointer',
                        }}
                    >
                        {syncing ? 'Sincronizando...' : 'Sincronizar ZKBio'}
                    </button>
                ) : null}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <KpiCard label="Presentes" value={kpis.presentes} sub="Con al menos una marcacion" icon="P" variant="accent" />
                <KpiCard label="Tardanzas" value={kpis.tardanzas} sub="Llegaron fuera de tolerancia" icon="T" variant="warning" />
                <KpiCard label="Ausentes" value={kpis.ausentes} sub="Sin marcaciones del dia" icon="A" variant="danger" />
                <KpiCard label="Sin Vincular" value={kpis.sinVincular} sub="Sin codigo ZKBio" icon="Z" variant="blue" />
            </div>

            <div className="card" style={{ padding: 16, display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: tk.txt2 }}>
                            Fecha
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle(tk, 150)} />
                        </label>
                        {!vendedorForzado && (
                            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: tk.txt2 }}>
                                Vendedor
                                <select value={vendedorId} onChange={e => setVendedorId(e.target.value)} style={inputStyle(tk, 220)}>
                                    <option value="">Todos</option>
                                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                </select>
                            </label>
                        )}
                        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: tk.txt2 }}>
                            Estado
                            <select value={estado} onChange={e => setEstado(e.target.value)} style={inputStyle(tk, 190)}>
                                <option value="">Todos</option>
                                {Object.keys(STATUS_STYLES).map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: tk.txt2 }}>
                            Sede
                            <select value={sede} onChange={e => setSede(e.target.value)} style={inputStyle(tk, 190)}>
                                <option value="">Todas</option>
                                {sedes.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                    </div>
                    <div style={{ fontSize: 12, color: tk.txt3, textAlign: 'right' }}>
                        <div>Ultima sincronizacion: {fmtSyncDate(health?.last_sync?.finished_at || health?.last_sync?.started_at)}</div>
                        {health?.last_sync?.status === 'error' && <div style={{ color: '#dc2626', marginTop: 2 }}>{health.last_sync.error_message}</div>}
                    </div>
                </div>

                {msg && (
                    <div style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        background: msg.type === 'ok' ? '#e8f8ee' : '#fff0f0',
                        color: msg.type === 'ok' ? '#166534' : '#b91c1c',
                        border: `1px solid ${msg.type === 'ok' ? '#86efac' : '#fecaca'}`,
                    }}>
                        {msg.text}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.2fr) 0.9fr 0.9fr 0.9fr 0.8fr 0.8fr', gap: 10, alignItems: 'center', fontSize: 11, fontWeight: 700, color: tk.txt3, textTransform: 'uppercase', padding: '0 8px' }}>
                    <span>Vendedor</span>
                    <span>Entrada</span>
                    <span>Ultima marcacion</span>
                    <span>Salida</span>
                    <span>Tardanza</span>
                    <span>Estado</span>
                </div>

                {loading ? (
                    <div style={{ padding: 26, textAlign: 'center', color: tk.txt2 }}>Cargando asistencia...</div>
                ) : rows.length ? (
                    rows.map(row => (
                        <div key={row.vendedor_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.2fr) 0.9fr 0.9fr 0.9fr 0.8fr 0.8fr', gap: 10, alignItems: 'center', padding: '12px 8px', borderTop: `1px solid ${tk.bdr}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <Avatar vendedor={row} size="sm" />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: tk.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nombre}</div>
                                    <div style={{ fontSize: 11, color: tk.txt3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {row.sede || 'Sin sede'} {row.zkbio_employee_code ? `· ${row.zkbio_employee_code}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.primera_entrada_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.ultima_marcacion_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.ultima_salida_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.minutos_tardanza == null ? '-' : `${row.minutos_tardanza} min`}</div>
                            <StatusBadge status={row.estado} tk={tk} />
                        </div>
                    ))
                ) : (
                    <div style={{ padding: 26, textAlign: 'center', color: tk.txt2 }}>No hay registros para los filtros seleccionados.</div>
                )}
            </div>
        </div>
    );
}
