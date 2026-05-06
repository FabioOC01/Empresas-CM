import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { getClientes, createCliente, uploadArchivoActividad, deleteArchivoActividad } from '../api/actividades';
import { TIPOS, ESTADOS, PRIORIDADES, MESES, ROL_TIPOS, ROLES, TYPE_COLOR, TYPE_ICON, TIPOS_CON_RESULTADO, fmt as fmtDur } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';


function fmtTS(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}


const EMPTY = {
    nombre: '', tipo: 'Venta', vendedor_id: '', cliente: '',
    monto: '', prioridad: 'Media', estado: 'Pendiente',
    mes: MESES[new Date().getMonth()], fecha: new Date().toISOString().slice(0, 10), fecha_fin: '', notas: '',
    precio_venta: '', costo_base: '', gastos_operativos: [], ajuste_interno: '',
    cliente_ruc: '', cliente_email: '', cliente_telefono: '',
    colaboradores: [], checklist: [],
};

const MARKETING_TIPOS = new Set(['Publicidad','Redes','Video','P. Gráficas Externas','P. Gráficas Internas','Actividad','Evento','Piezas gráficas']);

function parseArr(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
}

export default function ActividadModal({ open, onClose, onSave, actividad, vendedores }) {
    const tk = useTheme();
    const lbl    = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: tk.txt2, fontWeight: 600 };
    const inp    = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${tk.bdr}`, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: tk.inp, color: tk.txt };
    const btnSec = { padding: '10px 20px', background: tk.card2, color: tk.txt, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer', fontSize: 13 };
    const { user } = useAuth();
    const { config } = useActividadesContext();
    const todosLosTipos = config?.tipos_actividad || TIPOS;
    const rolTipos      = config?.rol_tipos       || ROL_TIPOS;
    const [form,      setForm]      = useState(EMPTY);
    const [expanded,  setExpanded]  = useState(false);
    const [now,       setNow]       = useState(Date.now());
    useEffect(() => {
        if (!open) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [open]);
    const [clientes,  setClientes]  = useState([]);
    const [nuevoC,    setNuevoC]    = useState(false);
    const [formC,     setFormC]     = useState({ nombre:'', ruc:'', email:'', telefono:'' });
    const [savingC,   setSavingC]   = useState(false);

    const esMarketing = MARKETING_TIPOS.has(form.tipo);
    const vendedoresFiltrados = esMarketing
        ? vendedores.filter(v => v.roles?.includes('Marketing'))
        : vendedores;

    const esAdmin = user?.is_superadmin || user?.roles?.includes('Admin');
    const puedeElegirVendedor = esAdmin || user?.roles?.includes('Gerencia');
    const puedeAjuste = esAdmin || user?.roles?.includes('Gerencia');
    const tiposPermitidos = esAdmin ? todosLosTipos : (user?.roles?.reduce((acc, rol) => {
        (rolTipos[rol] || []).forEach(t => { if (!acc.includes(t)) acc.push(t); });
        return acc;
    }, []) || todosLosTipos);
    const tiposDisponibles = tiposPermitidos.length > 0 ? tiposPermitidos : todosLosTipos;

    useEffect(() => {
        if (open) getClientes().then(setClientes);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (actividad) {
            setForm({
                ...EMPTY, ...actividad,
                fecha_fin:         actividad.fecha_fin         ? String(actividad.fecha_fin).slice(0,10) : '',
                monto:             actividad.monto             ?? '',
                precio_venta:      actividad.precio_venta      ?? '',
                costo_base:        actividad.costo_base        ?? '',
                ajuste_interno:    actividad.ajuste_interno    ?? '',
                gastos_operativos: parseArr(actividad.gastos_operativos),
                archivos:          actividad.archivos          ?? [],
                cliente_ruc:       actividad.cliente_ruc       ?? '',
                cliente_email:     actividad.cliente_email     ?? '',
                cliente_telefono:  actividad.cliente_telefono  ?? '',
                colaboradores:     parseArr(actividad.colaboradores),
                checklist:         parseArr(actividad.checklist),
            });
            setExpanded(true);
        } else {
            const primerTipo = tiposDisponibles[0] || 'Venta';
            setForm({ ...EMPTY, tipo: primerTipo, vendedor_id: user?.id || vendedores[0]?.id || '' });
            setExpanded(MARKETING_TIPOS.has(primerTipo));
        }
    }, [open, actividad]);

    if (!open) return null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleClienteChange = (val) => {
        set('cliente', val);
        if (!actividad) set('nombre', `${form.tipo} — ${val}`);
    };
    const handleTipoChange = (tipo) => {
        set('tipo', tipo);
        if (!actividad && form.cliente) set('nombre', `${tipo} — ${form.cliente}`);
        if (MARKETING_TIPOS.has(tipo)) setExpanded(true);
    };
    const handleFechaChange = (val) => {
        const mes = MESES[new Date(val + 'T12:00:00').getMonth()];
        setForm(f => ({ ...f, fecha: val, mes }));
    };

    const soloChecklist = !!actividad && !esAdmin && !user?.roles?.includes('Gerencia')
        && actividad.vendedor_id !== user?.id
        && (parseArr(actividad.colaboradores).includes(user?.id));

    const toggleColab = (vid) => {
        const cur = form.colaboradores || [];
        set('colaboradores', cur.includes(vid) ? cur.filter(x => x !== vid) : [...cur, vid]);
    };
    const addChkItem    = () => set('checklist', [...(form.checklist || []), { id: Date.now() + Math.random(), texto: '', vendedor_id: '', hecho: false, created_at: null, completed_at: null }]);
    const updChkItem    = (id, patch) => set('checklist', (form.checklist || []).map(it => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        if ('hecho' in patch && it.created_at) next.completed_at = patch.hecho ? Date.now() : null;
        return next;
    }));
    const removeChkItem = (id) => set('checklist', (form.checklist || []).filter(it => it.id !== id));

    const addGasto    = () => set('gastos_operativos', [...(form.gastos_operativos || []), { nombre: '', monto: '' }]);
    const removeGasto = (i) => set('gastos_operativos', form.gastos_operativos.filter((_, idx) => idx !== i));
    const setGasto    = (i, field, val) => set('gastos_operativos', form.gastos_operativos.map((g, idx) => idx === i ? { ...g, [field]: val } : g));

    const handleSubmit = (e) => {
        e.preventDefault();
        const nowTs = Date.now();
        const checklistConTs = (form.checklist || []).map(it => ({
            ...it,
            created_at: it.created_at || (it.texto?.trim() ? nowTs : null),
        }));
        if (soloChecklist) {
            onSave({ id: actividad.id, checklist: checklistConTs });
            onClose();
            return;
        }
        onSave({
            ...form,
            fecha_fin:        form.fecha_fin || null,
            nombre:           form.nombre || `${form.tipo} — ${form.cliente}`,
            monto:            parseFloat(form.monto)         || 0,
            precio_venta:     parseFloat(form.precio_venta)  || 0,
            costo_base:       parseFloat(form.costo_base)    || 0,
            ajuste_interno:   parseFloat(form.ajuste_interno) || 0,
            gastos_operativos: (form.gastos_operativos || []).map(g => ({
                nombre: g.nombre, monto: parseFloat(g.monto) || 0,
            })),
            colaboradores: form.colaboradores || [],
            checklist:     checklistConTs.filter(it => it.texto?.trim()),
            id:      actividad?.id || Date.now(),
            elapsed: actividad?.elapsed || 0,
        });
        onClose();
    };

    const tipoActual = TYPE_COLOR[form.tipo] || { bg: '#e8f0fe', color: '#10b981' };
    const estadosDisponibles = TIPOS_CON_RESULTADO.includes(form.tipo)
        ? ['Pendiente','En Progreso','Completado','Ganada','Perdida']
        : ESTADOS;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(7,13,25,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{
                borderRadius: 14,
                width: expanded ? 900 : 520,
                maxWidth: '96vw',
                maxHeight: '92vh', overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                display: 'flex', flexDirection: 'column',
                transition: 'width 0.2s ease',
            }}>
                {/* Header */}
                <div style={{
                    background: tk.isDark ? tk.card2 : tipoActual.bg, padding: '20px 24px 16px',
                    borderRadius: '16px 16px 0 0',
                    borderBottom: `2px solid ${tipoActual.color}33`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: tipoActual.color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                            {actividad ? 'Editar actividad' : 'Nueva actividad'}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: tk.txt }}>
                            {form.nombre || (form.cliente ? `${form.tipo} — ${form.cliente}` : form.tipo)}
                        </div>
                    </div>
                    {/* Toggle expandir */}
                    <button type="button" onClick={() => setExpanded(x => !x)} style={{
                        background: expanded ? tipoActual.color + '22' : 'none',
                        border: `1px solid ${tipoActual.color}44`,
                        borderRadius: 8, cursor: 'pointer', padding: '5px 10px',
                        fontSize: 11, fontWeight: 700, color: tk.txt,
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                    }}>
                        {expanded ? '◀ Menos' : 'Más opciones ▶'}
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: expanded ? '1fr 1fr' : '1fr',
                        gap: expanded ? 28 : 0,
                        alignItems: 'start',
                    }}>

                        {/* ── Columna izquierda — campos principales ── */}
                        <div style={{ display: 'grid', gap: 16 }}>

                            {/* Tipos */}
                            <div>
                                <div style={lbl}>Tipo de actividad</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    {tiposDisponibles.map(t => {
                                        const tc = TYPE_COLOR[t] || { bg: '#f0f2f5', color: tk.txt2 };
                                        const active = form.tipo === t;
                                        const fg = tc.color;
                                        return (
                                            <button key={t} type="button" onClick={() => handleTipoChange(t)} style={{
                                                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                                cursor: 'pointer', border: 'none',
                                                background: active ? fg : fg + (tk.isDark ? '28' : '1a'),
                                                color: active ? '#fff' : tk.txt,
                                                boxShadow: active ? `0 2px 8px ${fg}44` : 'none',
                                            }}>
                                                {TYPE_ICON[t] || '📌'} {t}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cliente o Área (si Marketing) */}
                            <div>
                                <div style={{ ...lbl, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                                    <span>{esMarketing ? 'Área *' : 'Cliente *'}</span>
                                    {!esMarketing && (
                                        <button type="button" onClick={() => { setNuevoC(x => !x); setFormC({ nombre:'', ruc:'', email:'', telefono:'' }); }}
                                            style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:6, border:`1px solid ${'#10b981'}`, background: nuevoC ? '#10b981' : '#10b98118', color: nuevoC ? '#fff' : '#10b981', cursor:'pointer' }}>
                                            {nuevoC ? '✕ Cancelar' : '+ Nuevo'}
                                        </button>
                                    )}
                                </div>
                                {esMarketing ? (
                                    <select style={inp} required value={form.cliente} onChange={e => handleClienteChange(e.target.value)}>
                                        <option value="">— Seleccionar área —</option>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                ) : (
                                    <select style={inp} required value={form.cliente} onChange={e => handleClienteChange(e.target.value)}>
                                        <option value="">— Seleccionar cliente —</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}{c.ruc ? ` · ${c.ruc}` : ''}</option>
                                        ))}
                                    </select>
                                )}
                                {!esMarketing && nuevoC && (
                                    <div style={{ marginTop:10, padding:'14px', background:tk.card2, borderRadius:10, border:`1px solid ${tk.bdr}`, display:'grid', gap:8 }}>
                                        <div style={{ fontSize:11, fontWeight:700, color:tk.txt2, marginBottom:2 }}>Nuevo cliente</div>
                                        <input style={inp} placeholder="Nombre *" required value={formC.nombre}
                                            onChange={e => setFormC(f => ({ ...f, nombre: e.target.value }))} />
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                                            <input style={inp} placeholder="RUC" value={formC.ruc}
                                                onChange={e => setFormC(f => ({ ...f, ruc: e.target.value }))} />
                                            <input style={inp} placeholder="Teléfono" value={formC.telefono}
                                                onChange={e => setFormC(f => ({ ...f, telefono: e.target.value }))} />
                                        </div>
                                        <input style={inp} placeholder="Email" type="email" value={formC.email}
                                            onChange={e => setFormC(f => ({ ...f, email: e.target.value }))} />
                                        <button type="button" disabled={savingC || !formC.nombre.trim()}
                                            onClick={async () => {
                                                if (!formC.nombre.trim()) return;
                                                setSavingC(true);
                                                try {
                                                    const nuevo = await createCliente(formC);
                                                    setClientes(cs => [...cs, nuevo].sort((a,b) => a.nombre.localeCompare(b.nombre)));
                                                    handleClienteChange(nuevo.nombre);
                                                    setNuevoC(false);
                                                } finally {
                                                    setSavingC(false);
                                                }
                                            }}
                                            style={{ padding:'8px', borderRadius:8, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity: savingC ? 0.6 : 1 }}>
                                            {savingC ? 'Guardando…' : 'Crear cliente'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Vendedor + Monto */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12 }}>
                                <label style={lbl}>Vendedor *
                                    <select style={{ ...inp, background: tk.inp, color: puedeElegirVendedor ? tk.txt : tk.txt2 }}
                                        required value={form.vendedor_id} disabled={!puedeElegirVendedor}
                                        onChange={e => set('vendedor_id', e.target.value)}>
                                        <option value="">— Seleccionar —</option>
                                        {vendedoresFiltrados.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                    </select>
                                </label>
                                <label style={lbl}>{form.tipo === 'Venta' ? 'Precio Venta' : esMarketing ? 'Presupuesto' : 'Monto'}
                                    <input style={inp} type="number" min="0" step="0.01" placeholder="0.00" value={form.monto}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setForm(f => ({ ...f, monto: v, ...(f.tipo === 'Venta' ? { precio_venta: v } : {}) }));
                                        }} />
                                </label>
                            </div>

                            {/* Costo + Gastos (solo Venta) */}
                            {form.tipo === 'Venta' && (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <label style={lbl}>Costo Base
                                        <input style={inp} type="number" min="0" step="0.01" placeholder="0.00"
                                            value={form.costo_base} onChange={e => set('costo_base', e.target.value)} />
                                    </label>
                                    <div>
                                        <div style={{ ...lbl, marginBottom: 8 }}>Gastos Operativos</div>
                                        {(form.gastos_operativos || []).map((g, i) => (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 30px', gap: 6, marginBottom: 6 }}>
                                                <input style={inp} placeholder="Concepto" value={g.nombre} onChange={e => setGasto(i, 'nombre', e.target.value)} />
                                                <input style={inp} type="number" min="0" step="0.01" placeholder="Monto" value={g.monto} onChange={e => setGasto(i, 'monto', e.target.value)} />
                                                <button type="button" onClick={() => removeGasto(i)} style={{ background: '#e74c3c22', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#e74c3c', fontWeight: 700 }}>×</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={addGasto} style={{ fontSize: 12, color: '#10b981', background: 'none', border: '1px dashed #10b981', borderRadius: 7, padding: '6px 14px', cursor: 'pointer' }}>
                                            + Agregar gasto
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Botones — siempre en columna izquierda */}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                                <button type="button" onClick={onClose} style={btnSec}>Cancelar</button>
                                <button type="submit" style={{ ...btnPri, background: tipoActual.color }}>
                                    {actividad ? 'Guardar cambios' : 'Crear actividad'}
                                </button>
                            </div>
                        </div>

                        {/* ── Columna derecha — más opciones (solo cuando expandido) ── */}
                        {expanded && (
                            <div style={{ display: 'grid', gap: 16, borderLeft: `1px solid ${tk.bdr}`, paddingLeft: 28 }}>

                                {/* Nombre */}
                                <label style={lbl}>Nombre
                                    <input style={inp} placeholder={`${form.tipo} — ${form.cliente || '...'}`}
                                        value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                                </label>

                                {/* Prioridad */}
                                <div>
                                    <div style={lbl}>Prioridad</div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                        {PRIORIDADES.map(p => {
                                            const c = { Alta: '#e74c3c', Media: '#e67e22', Baja: '#27ae60' }[p];
                                            const active = form.prioridad === p;
                                            return (
                                                <button key={p} type="button" onClick={() => set('prioridad', p)} style={{
                                                    flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                    cursor: 'pointer', border: 'none',
                                                    background: active ? c : c + (tk.isDark ? '28' : '18'),
                                                    color: active ? '#fff' : tk.txt,
                                                    boxShadow: active ? `0 2px 8px ${c}44` : 'none',
                                                }}>
                                                    {p === 'Alta' ? '↑' : p === 'Media' ? '→' : '↓'} {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Estado */}
                                <div>
                                    <div style={lbl}>Estado</div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                        {estadosDisponibles.map(s => {
                                            const c = { 'Pendiente':'#e67e22','En Progreso':'#10b981','Completado':'#27ae60','Ganada':'#2e7d32','Perdida':'#e74c3c' }[s] || '#6b7a8d';
                                            const active = form.estado === s;
                                            return (
                                                <button key={s} type="button" onClick={() => set('estado', s)} style={{
                                                    flex: 1, minWidth: 70, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                                    cursor: 'pointer', border: 'none',
                                                    background: active ? c : c + (tk.isDark ? '28' : '18'),
                                                    color: active ? '#fff' : tk.txt,
                                                    boxShadow: active ? `0 2px 8px ${c}44` : 'none',
                                                }}>
                                                    {s}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {TIPOS_CON_RESULTADO.includes(form.tipo) && (
                                        <div style={{ fontSize: 10, color: tk.txt3, marginTop: 5 }}>Ganada → aparece en Comisiones</div>
                                    )}
                                </div>

                                {/* Fechas */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <label style={lbl}>Fecha de inicio
                                        <input style={(!actividad && puedeElegirVendedor) ? inp : { ...inp, background: tk.card2, color: tk.txt2 }}
                                            type="date" value={form.fecha}
                                            readOnly={!!actividad || !puedeElegirVendedor}
                                            onChange={e => (!actividad && puedeElegirVendedor) && handleFechaChange(e.target.value)} />
                                    </label>
                                    <label style={lbl}>Fin estimado
                                        <input style={inp} type="date" value={form.fecha_fin || ''}
                                            min={form.fecha}
                                            onChange={e => set('fecha_fin', e.target.value)} />
                                    </label>
                                </div>

                                {/* Colaboradores */}
                                <div>
                                    <div style={lbl}>Colaboradores</div>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                                        {vendedoresFiltrados.filter(v => v.id !== form.vendedor_id).map(v => {
                                            const active = (form.colaboradores || []).includes(v.id);
                                            return (
                                                <button key={v.id} type="button" disabled={soloChecklist} onClick={() => toggleColab(v.id)} style={{
                                                    padding:'5px 10px', borderRadius: 20, fontSize:11, fontWeight:600,
                                                    border: 'none', cursor: soloChecklist ? 'default' : 'pointer',
                                                    background: active ? v.color : (tk.isDark ? '#1e2a3b' : '#eef2f7'),
                                                    color: active ? '#fff' : tk.txt, opacity: soloChecklist ? 0.6 : 1,
                                                }}>{active ? '✓ ' : ''}{v.nombre}</button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Checklist */}
                                <div>
                                    <div style={{ ...lbl, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <span>Checklist</span>
                                        {!soloChecklist && (
                                            <button type="button" onClick={addChkItem} style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6, border:'1px dashed #10b981', background:'#10b98118', color:'#10b981', cursor:'pointer' }}>+ Ítem</button>
                                        )}
                                    </div>
                                    <div style={{ display:'grid', gap:6, marginTop:6 }}>
                                        {(form.checklist || []).length === 0 && (
                                            <div style={{ fontSize:11, color:tk.txt3 }}>Sin ítems.</div>
                                        )}
                                        {(form.checklist || []).map(it => {
                                            const puedeMarcar = soloChecklist ? it.vendedor_id === user?.id : true;
                                            const created = it.created_at ? new Date(it.created_at).getTime() : null;
                                            const ended   = it.completed_at ? new Date(it.completed_at).getTime() : null;
                                            const elapsed = created ? Math.floor(((ended || now) - created) / 1000) : 0;
                                            return (
                                                <div key={it.id} style={{ display:'grid', gridTemplateColumns:'24px 1fr 110px 70px 24px', gap:6, alignItems:'center', background: it.hecho ? (tk.isDark ? '#0f2a1a' : '#e8f5e9') : tk.card2, padding:'5px 8px', borderRadius:7 }}>
                                                    <input type="checkbox" checked={!!it.hecho} disabled={!puedeMarcar}
                                                        onChange={e => updChkItem(it.id, { hecho: e.target.checked })} />
                                                    <input style={{ ...inp, padding:'5px 8px', textDecoration: it.hecho ? 'line-through' : 'none' }}
                                                        placeholder="Tarea..." value={it.texto} disabled={soloChecklist}
                                                        onChange={e => updChkItem(it.id, { texto: e.target.value })} />
                                                    <select style={{ ...inp, padding:'5px 8px' }} value={it.vendedor_id || ''} disabled={soloChecklist}
                                                        onChange={e => updChkItem(it.id, { vendedor_id: e.target.value })}>
                                                        <option value="">— Sin asignar —</option>
                                                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                                    </select>
                                                    <span title={created ? `Creado ${new Date(created).toLocaleString('es-PE')}` : 'Sin iniciar'}
                                                        style={{ fontFamily:'monospace', fontSize:11, textAlign:'center', color: it.hecho ? '#27ae60' : tk.txt2 }}>
                                                        {created ? fmtDur(elapsed) : '—'}
                                                    </span>
                                                    {!soloChecklist ? (
                                                        <button type="button" onClick={() => removeChkItem(it.id)} style={{ background:'#e74c3c22', border:'none', borderRadius:6, cursor:'pointer', color:'#e74c3c', fontWeight:700 }}>×</button>
                                                    ) : <span />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Notas */}
                                <label style={lbl}>Notas
                                    <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }}
                                        placeholder="Observaciones, acuerdos, próximos pasos..."
                                        value={form.notas} onChange={e => set('notas', e.target.value)} />
                                </label>

                                {/* Adjuntos — solo actividades existentes */}
                                <div>
                                    <div style={{ ...lbl, marginBottom: 8 }}>Archivos adjuntos</div>
                                    {actividad ? (
                                        <>
                                            {(form.archivos || []).map((a, i) => (
                                                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, padding:'6px 10px', background: tk.card2, borderRadius:7 }}>
                                                    <span style={{ fontSize:14 }}>{a.tipo?.includes('pdf') ? '📄' : a.tipo?.includes('image') ? '🖼' : '📎'}</span>
                                                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flex:1, fontSize:12, color:'#10b981', textDecoration:'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.nombre}</a>
                                                    <button type="button" onClick={async () => {
                                                        await deleteArchivoActividad(actividad.id, a.url);
                                                        set('archivos', form.archivos.filter((_, idx) => idx !== i));
                                                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', fontSize:14, flexShrink:0 }}>×</button>
                                                </div>
                                            ))}
                                            <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#10b98120', color:'#10b981', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px dashed #10b98180', marginTop:4 }}>
                                                📎 Adjuntar archivo
                                                <input type="file" style={{ display:'none' }} onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const nuevo = await uploadArchivoActividad(actividad.id, file);
                                                    set('archivos', [...(form.archivos || []), nuevo]);
                                                    e.target.value = '';
                                                }} />
                                            </label>
                                        </>
                                    ) : (
                                        <div style={{ fontSize:12, color: tk.txt3, padding:'8px 0' }}>Guarda la actividad primero para adjuntar archivos.</div>
                                    )}
                                </div>

                                {/* Ajuste interno */}
                                {form.tipo === 'Venta' && puedeAjuste && (
                                    <label style={lbl}>Ajuste Interno
                                        <input style={{ ...inp, maxWidth: 160 }} type="number" min="0" step="0.01"
                                            value={form.ajuste_interno} onChange={e => set('ajuste_interno', e.target.value)} />
                                    </label>
                                )}

                                {/* Timestamps */}
                                {actividad && (
                                    <div style={{ background: tk.card2, borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                        {[
                                            { label: 'Pendiente',   ts: actividad.ts_pendiente,   color: '#e67e22' },
                                            { label: 'En Progreso', ts: actividad.ts_en_progreso, color: '#10b981' },
                                            { label: 'Completado',  ts: actividad.ts_completado,  color: '#27ae60' },
                                        ].map(({ label, ts, color }) => (
                                            <div key={label}>
                                                <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                                                <div style={{ fontSize: 11, color: ts ? tk.txt : tk.txt3 }}>{fmtTS(ts)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

const btnPri = { padding: '10px 24px', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 13 };
