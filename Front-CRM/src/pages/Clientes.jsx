import { useState, useEffect } from 'react';
import { getClientes, createCliente, updateCliente } from '../api/actividades';
import { useTheme } from '../context/ThemeContext';

const EMPTY = { nombre: '', ruc: '', email: '', telefono: '', contacto: '' };

export default function Clientes() {
    const tk = useTheme();
    const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: tk.txt2, fontWeight: 600 };
    const inp = { padding: '9px 11px', borderRadius: 7, border: `1px solid ${tk.bdr}`, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: tk.inp, color: tk.txt };
    const [clientes,  setClientes]  = useState([]);
    const [buscar,    setBuscar]    = useState('');
    const [editing,   setEditing]   = useState(null); // cliente | 'new' | null
    const [form,      setForm]      = useState(EMPTY);
    const [saving,    setSaving]    = useState(false);
    const [msg,       setMsg]       = useState(null);

    useEffect(() => { getClientes().then(setClientes); }, []);

    const filtered = clientes.filter(c =>
        c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
        c.ruc.includes(buscar) ||
        c.email.toLowerCase().includes(buscar.toLowerCase())
    );

    const openEdit = (c) => { setEditing(c); setForm({ nombre: c.nombre, ruc: c.ruc, email: c.email, telefono: c.telefono, contacto: c.contacto || '' }); setMsg(null); };
    const openNew  = ()  => { setEditing('new'); setForm(EMPTY); setMsg(null); };
    const set      = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) return setMsg({ type: 'err', text: 'El nombre es obligatorio.' });
        setSaving(true); setMsg(null);
        try {
            if (editing === 'new') {
                const created = await createCliente(form);
                setClientes(cs => [created, ...cs]);
                setMsg({ type: 'ok', text: 'Cliente creado.' });
                setEditing(created);
            } else {
                const updated = await updateCliente(editing.id, form);
                setClientes(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                setMsg({ type: 'ok', text: 'Guardado correctamente.' });
                setEditing({ ...editing, ...updated });
            }
        } catch (err) {
            setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar.' });
        } finally {
            setSaving(false);
        }
    };

    const isNew = editing === 'new';

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

            {/* Lista */}
            <div style={{ background: tk.card, borderRadius: 10, boxShadow: tk.shadow, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tk.bdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: tk.txt }}>Clientes ({filtered.length})</span>
                    <button onClick={openNew} style={{ padding: '5px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        + Nuevo
                    </button>
                </div>

                {/* Buscador */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tk.bdr}` }}>
                    <input
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${tk.bdr}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: tk.inp, color: tk.txt }}
                        placeholder="Buscar por nombre, RUC o email..."
                        value={buscar}
                        onChange={e => setBuscar(e.target.value)}
                    />
                </div>

                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', color: '#8899aa', fontSize: 12 }}>Sin clientes</div>
                    )}
                    {filtered.map(c => (
                        <button key={c.id} onClick={() => openEdit(c)} style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '11px 18px', background: (!isNew && editing?.id === c.id) ? (tk.isDark ? '#1a2744' : '#f0f5ff') : 'transparent',
                            border: 'none', borderBottom: `1px solid ${tk.bdr}`, cursor: 'pointer', textAlign: 'left',
                            borderLeft: (!isNew && editing?.id === c.id) ? '3px solid #10b981' : '3px solid transparent',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', background: tk.isDark ? '#1e3a6e' : '#e8f0fe',
                                color: '#10b981', fontWeight: 700, fontSize: 13,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                {c.nombre[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: tk.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                                <div style={{ fontSize: 11, color: tk.txt2 }}>
                                    {c.ruc ? `RUC: ${c.ruc}` : c.email || 'Sin contacto'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Panel derecho */}
            {editing ? (
                <div style={{ background: tk.card, borderRadius: 10, boxShadow: tk.shadow, padding: '24px 28px' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: tk.txt, marginBottom: 22 }}>
                        {isNew ? 'Nuevo cliente' : editing.nombre}
                    </div>

                    {/* Info de quién registró */}
                    {!isNew && editing.registrado_por_nombre && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '8px 12px', background: tk.card2, borderRadius: 8, fontSize: 12, color: tk.txt2 }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: editing.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {editing.iniciales}
                            </span>
                            Registrado por <strong style={{ color: '#1e2a3b' }}>{editing.registrado_por_nombre}</strong>
                            <span style={{ marginLeft: 'auto' }}>{new Date(editing.created_at).toLocaleDateString('es-PE')}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
                        <label style={lbl}>Nombre *
                            <input style={inp} required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                        </label>
                        <label style={lbl}>RUC
                            <input style={inp} maxLength={11} placeholder="20XXXXXXXXX" value={form.ruc} onChange={e => set('ruc', e.target.value)} />
                        </label>
                        <label style={lbl}>Nombre de contacto
                            <input style={inp} placeholder="Persona de contacto" value={form.contacto} onChange={e => set('contacto', e.target.value)} />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={lbl}>Correo
                                <input style={inp} type="email" placeholder="correo@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
                            </label>
                            <label style={lbl}>Teléfono
                                <input style={inp} type="tel" placeholder="+51 9XXXXXXXX" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
                            </label>
                        </div>

                        {msg && (
                            <div style={{ padding: '9px 12px', borderRadius: 7, fontSize: 12, background: msg.type === 'ok' ? '#e8f8ee' : '#fff0f0', border: `1px solid ${msg.type === 'ok' ? '#a8ddb8' : '#fcc'}`, color: msg.type === 'ok' ? '#1a7a3c' : '#c0392b' }}>
                                {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: saving ? '#a0b8e8' : '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
                                {saving ? 'Guardando...' : isNew ? 'Crear cliente' : 'Guardar cambios'}
                            </button>
                            <button type="button" onClick={() => setEditing(null)} style={{ padding: '10px 20px', background: tk.card2, color: tk.txt, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div style={{ background: tk.card, borderRadius: 10, boxShadow: tk.shadow, padding: 40, textAlign: 'center', color: tk.txt2, fontSize: 13 }}>
                    Seleccioná un cliente para ver su detalle, o presioná <strong>+ Nuevo</strong> para agregar uno.
                </div>
            )}
        </div>
    );
}

