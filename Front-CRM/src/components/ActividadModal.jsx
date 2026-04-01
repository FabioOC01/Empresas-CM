import { useState, useEffect } from 'react';

function fmtTS(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}
import { TIPOS, ESTADOS, PRIORIDADES, MESES } from '../utils/crm';

const EMPTY = {
    nombre: '', tipo: 'Venta', vendedor_id: '', cliente: '',
    monto: '', prioridad: 'Media', estado: 'Pendiente',
    mes: MESES[new Date().getMonth()], fecha: new Date().toISOString().slice(0,10), notas: '',
};

export default function ActividadModal({ open, onClose, onSave, actividad, vendedores }) {
    const [form, setForm] = useState(EMPTY);

    useEffect(() => {
        if (open) setForm(actividad ? { ...EMPTY, ...actividad, monto: actividad.monto ?? '' } : { ...EMPTY, vendedor_id: vendedores[0]?.id || '' });
    }, [open, actividad, vendedores]);

    if (!open) return null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...form,
            monto: parseFloat(form.monto) || 0,
            id: actividad?.id || Date.now(),
            elapsed: actividad?.elapsed || 0,
        });
        onClose();
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 12, padding: 28, width: 520,
                maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#1e2a3b' }}>
                    {actividad ? 'Editar actividad' : 'Nueva actividad'}
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
                    <label style={lbl}>Nombre *
                        <input style={inp} required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={lbl}>Tipo
                            <select style={inp} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                                {TIPOS.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </label>
                        <label style={lbl}>Vendedor *
                            <select style={inp} required value={form.vendedor_id} onChange={e => set('vendedor_id', e.target.value)}>
                                <option value="">— Seleccionar —</option>
                                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                            </select>
                        </label>
                    </div>
                    <label style={lbl}>Cliente *
                        <input style={inp} required value={form.cliente} onChange={e => set('cliente', e.target.value)} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <label style={lbl}>Monto (USD)
                            <input style={inp} type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} />
                        </label>
                        <label style={lbl}>Prioridad
                            <select style={inp} value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                                {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
                            </select>
                        </label>
                        <label style={lbl}>Estado
                            <select style={inp} value={form.estado} onChange={e => set('estado', e.target.value)}>
                                {ESTADOS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={lbl}>Mes
                            <select style={inp} value={form.mes} onChange={e => set('mes', e.target.value)}>
                                {MESES.map(m => <option key={m}>{m}</option>)}
                            </select>
                        </label>
                        <label style={lbl}>Fecha
                            <input style={inp} type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
                        </label>
                    </div>
                    <label style={lbl}>Notas
                        <textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.notas} onChange={e => set('notas', e.target.value)} />
                    </label>

                    {/* Timestamps de estado — solo en modo edición */}
                    {actividad && (
                        <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            {[
                                { label: 'Pendiente',   ts: actividad.ts_pendiente,   color: '#e67e22' },
                                { label: 'En Progreso', ts: actividad.ts_en_progreso, color: '#2f6fd4' },
                                { label: 'Completado',  ts: actividad.ts_completado,  color: '#27ae60' },
                            ].map(({ label, ts, color }) => (
                                <div key={label}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                                    <div style={{ fontSize: 11, color: ts ? '#2d3d52' : '#bbb' }}>{fmtTS(ts)}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
                        <button type="submit" style={btnPrimary}>Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#6b7a8d', fontWeight: 600 };
const inp = { padding: '8px 10px', borderRadius: 7, border: '1px solid #dde1e8', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
const btnPrimary   = { padding: '9px 22px', background: '#2f6fd4', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 };
const btnSecondary = { padding: '9px 22px', background: '#f0f2f5', color: '#1e2a3b', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 };
