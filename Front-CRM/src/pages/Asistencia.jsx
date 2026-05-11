import { useEffect, useMemo, useState } from 'react';
import { getAttendanceHealth, getAttendanceSummary, getVendedores, syncAttendance, updateVendedor } from '../api/actividades';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useRolFilter from '../hooks/useRolFilter';
import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import Avatar from '../components/Avatar';
import { ClockIcon } from '../components/Icons';

const STATUS_STYLES = {
    'A tiempo': { bg: '#dcfce7', color: '#166534' },
    'Tardanza': { bg: '#fef3c7', color: '#92400e' },
    'Ausente': { bg: '#fee2e2', color: '#991b1b' },
    'Sin vincular': { bg: '#e0f2fe', color: '#075985' },
    'Sin marcación de salida': { bg: '#ede9fe', color: '#5b21b6' },
    'Día libre': { bg: '#f1f5f9', color: '#475569' },
};

const DIAS_HORARIO = [
    { dia: 1, label: 'Lun' },
    { dia: 2, label: 'Mar' },
    { dia: 3, label: 'Mié' },
    { dia: 4, label: 'Jue' },
    { dia: 5, label: 'Vie' },
    { dia: 6, label: 'Sáb' },
];

const HORARIO_EMPRESA = [
    { dia: 1, inicio: '09:30', fin: '18:30' },
    { dia: 2, inicio: '09:30', fin: '18:30' },
    { dia: 3, inicio: '09:30', fin: '18:30' },
    { dia: 4, inicio: '09:30', fin: '18:30' },
    { dia: 5, inicio: '09:30', fin: '18:30' },
    { dia: 6, inicio: '09:30', fin: '14:00' },
];

const HORARIO_STHEFANIA = [
    { dia: 1, inicio: '08:30', fin: '17:30' },
    { dia: 2, inicio: '08:30', fin: '17:30' },
    { dia: 3, inicio: '08:30', fin: '17:30' },
    { dia: 4, inicio: '08:30', fin: '17:30' },
    { dia: 5, inicio: '08:30', fin: '17:30' },
    { dia: 6, inicio: '09:30', fin: '14:00' },
];

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

function fmtMinutes(value) {
    if (value == null) return '-';
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return '-';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
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
    const canEditSchedule = user?.is_superadmin || user?.roles?.includes('Admin');
    const attendanceGrid = canEditSchedule
        ? 'minmax(220px, 1.2fr) 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.8fr 0.6fr'
        : 'minmax(220px, 1.2fr) 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.8fr';

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
    const [scheduleModal, setScheduleModal] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);

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

    const openScheduleModal = (vendedor) => {
        const base = Array.isArray(vendedor?.horario_dias) && vendedor.horario_dias.length
            ? vendedor.horario_dias
            : HORARIO_EMPRESA;
        setScheduleModal({
            vendedor,
            useOverride: Array.isArray(vendedor?.horario_dias) && vendedor.horario_dias.length > 0,
            horario: DIAS_HORARIO.map(({ dia }) => {
                const item = base.find(x => Number(x.dia) === dia) || {};
                return { dia, inicio: item.inicio || '', fin: item.fin || '' };
            }),
        });
    };

    const updateScheduleDay = (dia, field, value) => {
        setScheduleModal(current => ({
            ...current,
            useOverride: true,
            horario: current.horario.map(item => item.dia === dia ? { ...item, [field]: value } : item),
        }));
    };

    const applyScheduleTemplate = (template) => {
        setScheduleModal(current => ({
            ...current,
            useOverride: true,
            horario: template.map(item => ({ ...item })),
        }));
    };

    const handleSaveSchedule = async () => {
        if (!scheduleModal?.vendedor) return;
        setSavingSchedule(true);
        setMsg(null);
        try {
            const horario = scheduleModal.useOverride
                ? scheduleModal.horario
                    .filter(item => item.inicio && item.fin)
                    .map(item => ({ dia: item.dia, inicio: item.inicio, fin: item.fin }))
                : null;
            const updated = await updateVendedor(scheduleModal.vendedor.id, { horario_dias: horario });
            setVendedores(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v));
            setScheduleModal(null);
            setMsg({ type: 'ok', text: 'Horario actualizado.' });
            await fetchPage(true);
        } catch (err) {
            setMsg({ type: 'err', text: err.response?.data?.error || 'No se pudo guardar el horario.' });
        } finally {
            setSavingSchedule(false);
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
                    <div style={{ color: '#10b981', marginBottom: 12 }}>
                        <ClockIcon size={44} />
                    </div>
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

                <div style={{ display: 'grid', gridTemplateColumns: attendanceGrid, gap: 10, alignItems: 'center', fontSize: 11, fontWeight: 700, color: tk.txt3, textTransform: 'uppercase', padding: '0 8px' }}>
                    <span>Vendedor</span>
                    <span>Entrada</span>
                    <span>Sale alm.</span>
                    <span>Vuelve alm.</span>
                    <span>Almuerzo</span>
                    <span>Salida</span>
                    <span>Tardanza</span>
                    <span>Estado</span>
                    {canEditSchedule && <span>Horario</span>}
                </div>

                {loading ? (
                    <div style={{ padding: 26, textAlign: 'center', color: tk.txt2 }}>Cargando asistencia...</div>
                ) : rows.length ? (
                    rows.map(row => (
                        <div key={row.vendedor_id} style={{ display: 'grid', gridTemplateColumns: attendanceGrid, gap: 10, alignItems: 'center', padding: '12px 8px', borderTop: `1px solid ${tk.bdr}` }}>
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
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.salida_almuerzo_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.retorno_almuerzo_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: row.minutos_almuerzo_exceso > 0 ? '#b45309' : tk.txt }}>
                                {fmtMinutes(row.minutos_almuerzo)}
                                {row.minutos_almuerzo_exceso > 0 ? ` +${row.minutos_almuerzo_exceso}` : ''}
                            </div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.ultima_salida_hora || '-'}</div>
                            <div style={{ fontSize: 13, color: tk.txt }}>{row.minutos_tardanza == null ? '-' : `${row.minutos_tardanza} min`}</div>
                            <StatusBadge status={row.estado} tk={tk} />
                            {canEditSchedule && (
                                <button
                                    type="button"
                                    onClick={() => openScheduleModal(vendedores.find(v => v.id === row.vendedor_id) || row)}
                                    style={{
                                        justifySelf: 'start',
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        border: `1px solid ${tk.bdr}`,
                                        background: tk.card2,
                                        color: tk.txt,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Editar
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{ padding: 26, textAlign: 'center', color: tk.txt2 }}>No hay registros para los filtros seleccionados.</div>
                )}
            </div>

            {scheduleModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15,23,42,0.42)',
                    display: 'grid',
                    placeItems: 'center',
                    zIndex: 50,
                    padding: 18,
                }}>
                    <div className="card" style={{ width: 'min(620px, 100%)', padding: 18, display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: tk.txt }}>Horario de {scheduleModal.vendedor.nombre}</div>
                                <div style={{ fontSize: 12, color: tk.txt3, marginTop: 3 }}>Tolerancia general: {config?.tolerancia_minutos ?? 5} min</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setScheduleModal(null)}
                                style={{ border: 'none', background: 'transparent', color: tk.txt2, fontSize: 24, lineHeight: 1, cursor: 'pointer' }}
                            >
                                ×
                            </button>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.txt }}>
                            <input
                                type="checkbox"
                                checked={scheduleModal.useOverride}
                                onChange={e => setScheduleModal(current => ({ ...current, useOverride: e.target.checked }))}
                            />
                            Usar horario personalizado
                        </label>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => applyScheduleTemplate(HORARIO_EMPRESA)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${tk.bdr}`, background: tk.card2, color: tk.txt, fontWeight: 700, cursor: 'pointer' }}>
                                L-V 09:30-18:30
                            </button>
                            <button type="button" onClick={() => applyScheduleTemplate(HORARIO_STHEFANIA)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${tk.bdr}`, background: tk.card2, color: tk.txt, fontWeight: 700, cursor: 'pointer' }}>
                                Sthefania
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            {DIAS_HORARIO.map(({ dia, label }) => {
                                const item = scheduleModal.horario.find(x => x.dia === dia) || {};
                                return (
                                    <div key={dia} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr', gap: 10, alignItems: 'center' }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: tk.txt }}>{label}</div>
                                        <input type="time" value={item.inicio || ''} onChange={e => updateScheduleDay(dia, 'inicio', e.target.value)} disabled={!scheduleModal.useOverride} style={inputStyle(tk, '100%')} />
                                        <input type="time" value={item.fin || ''} onChange={e => updateScheduleDay(dia, 'fin', e.target.value)} disabled={!scheduleModal.useOverride} style={inputStyle(tk, '100%')} />
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" onClick={() => setScheduleModal(null)} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${tk.bdr}`, background: tk.card2, color: tk.txt, fontWeight: 700, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleSaveSchedule} disabled={savingSchedule} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: savingSchedule ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 700, cursor: savingSchedule ? 'default' : 'pointer' }}>
                                {savingSchedule ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
