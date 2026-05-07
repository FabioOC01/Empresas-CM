import { useState, useEffect } from 'react';
import { getVendedores, createVendedor, updateVendedor, updateVendedorMetas, updateConfig, uploadFotoVendedor, getAttendanceUnmapped } from '../api/actividades';
import Avatar from '../components/Avatar';
import { useActividadesContext, CONFIG_DEFAULT } from '../context/ActividadesContext';
import { useAuth } from '../context/AuthContext';
import { ROLES, TYPE_ICON } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';

const MONEDAS = [
    { value:'USD', label:'USD — Dólar americano' },
    { value:'PEN', label:'PEN — Sol peruano' },
    { value:'EUR', label:'EUR — Euro' },
    { value:'COP', label:'COP — Peso colombiano' },
    { value:'ARS', label:'ARS — Peso argentino' },
    { value:'MXN', label:'MXN — Peso mexicano' },
    { value:'BRL', label:'BRL — Real brasileño' },
    { value:'CLP', label:'CLP — Peso chileno' },
];

const COLORS     = ['#10b981','#27ae60','#8e44ad','#e67e22','#e74c3c','#1abc9c','#1512bb','#e91e63','#f39c12','#16a085'];
const DIAS_LABEL = ['D','L','M','X','J','V','S'];
const EMPTY_FORM = { nombre:'', iniciales:'', color:'#10b981', username:'', email:'', cargo:'', password:'', roles:[], zkbio_employee_code:'', zkbio_device_name:'', asistencia_activa:true };

const BRANDING_DEFAULT = {
    logo_login:   'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-AZUL.png',
    logo_sidebar: 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO.png',
    logo_iso:     'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png',
    app_name:     'Vantio',
    subtitulo:    'CRM Empresas',
    copyright:    'VANTIO Copyright (C) 2026 Comutel and contributors',
    dark_mode:    false,
};

const ATTENDANCE_DEFAULT = {
    timezone: 'America/Lima',
    ingreso_esperado: '09:30',
    tolerancia_minutos: 10,
    tardanza_modo: 'primera_entrada',
    sedes: [],
    sedes_text: '',
};

function initCfgForm(config) {
    const attendance = { ...ATTENDANCE_DEFAULT, ...(config?.attendance_config || {}) };
    return {
        horario_dias:    (config?.horario_dias || CONFIG_DEFAULT.horario_dias).map(d => ({ ...d })),
        tasa_sunat:      ((parseFloat(config?.tasa_sunat)    || 0.295) * 100).toFixed(1),
        tasa_comision:   ((parseFloat(config?.tasa_comision) || 0.05)  * 100).toFixed(1),
        meta_global_rentabilidad: parseFloat(config?.meta_global_rentabilidad) || 0,
        meta_global_facturacion:  parseFloat(config?.meta_global_facturacion)  || 0,
        meta_global_rentabilidad_mes:  parseFloat(config?.meta_global_rentabilidad_mes)  || 0,
        meta_global_facturacion_mes:   parseFloat(config?.meta_global_facturacion_mes)   || 0,
        meta_global_rentabilidad_trim: parseFloat(config?.meta_global_rentabilidad_trim) || 0,
        meta_global_facturacion_trim:  parseFloat(config?.meta_global_facturacion_trim)  || 0,
        feriados:        [...(config?.feriados || [])],
        feriadoInput:    '',
        moneda:          config?.moneda || 'USD',
        tipos_actividad: [...(config?.tipos_actividad || CONFIG_DEFAULT.tipos_actividad)],
        tipoInput:       '',
        pipeline_etapas: (config?.pipeline_etapas || CONFIG_DEFAULT.pipeline_etapas).map(e => ({ ...e, tipos: [...e.tipos] })),
        etapaInput:      '',
        rol_tipos:       { ...(config?.rol_tipos || CONFIG_DEFAULT.rol_tipos) },
        branding:        { ...BRANDING_DEFAULT, ...(config?.branding || {}) },
        attendance_config: {
            ...attendance,
            tolerancia_minutos: attendance.tolerancia_minutos ?? 10,
            sedes_text: Array.isArray(attendance.sedes) ? attendance.sedes.join('\n') : '',
        },
    };
}

function MsgBox({ msg }) {
    return (
        <div style={{ padding:'9px 12px', borderRadius:7, fontSize:12,
            background: msg.type==='ok' ? '#e8f8ee' : '#fff0f0',
            border: `1px solid ${msg.type==='ok' ? '#a8ddb8' : '#fcc'}`,
            color: msg.type==='ok' ? '#1a7a3c' : '#c0392b' }}>
            {msg.type==='ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
    );
}

export default function Admin() {
    const tk = useTheme();
    const lbl = { display:'flex', flexDirection:'column', gap:5, fontSize:12, color:tk.txt2, fontWeight:600 };
    const inp = { padding:'9px 11px', borderRadius:7, border:`1px solid ${tk.bdr}`, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', background:tk.inp, color:tk.txt };
    const { config, setConfig, configLoaded } = useActividadesContext();
    const { user } = useAuth();
    const esAdmin = user?.is_superadmin || user?.roles?.includes('Admin');
    const esGerencia = user?.roles?.includes('Gerencia');
    const esAdminGerencia = esAdmin || esGerencia;

    const [seccion,    setSeccion]    = useState(
        (user?.roles?.includes('Gerencia') && !(user?.is_superadmin || user?.roles?.includes('Admin'))) ? 'horario' : 'vendedores'
    );
    const [vendedores, setVendedores] = useState([]);
    const [editing,    setEditing]    = useState(null);
    const [form,       setForm]       = useState(EMPTY_FORM);
    const [saving,     setSaving]     = useState(false);
    const [msg,        setMsg]        = useState(null);

    const [fotoUploading, setFotoUploading] = useState(false);
    const [fotoMsg,       setFotoMsg]       = useState(null);

    const [cfgForm,   setCfgForm]   = useState(null);
    const [cfgSaving, setCfgSaving] = useState(false);
    const [cfgMsg,    setCfgMsg]    = useState(null);

    const [editingTasas, setEditingTasas] = useState({});
    const [savingTasas,  setSavingTasas]  = useState({});
    const [msgTasas,     setMsgTasas]     = useState({});
    const [attendanceSaving, setAttendanceSaving] = useState({});
    const [attendanceMsg, setAttendanceMsg] = useState({});
    const [unmapped, setUnmapped] = useState([]);

    useEffect(() => { getVendedores().then(setVendedores); }, []);
    useEffect(() => {
        if (esAdminGerencia) getAttendanceUnmapped().then(setUnmapped).catch(() => {});
    }, [esAdminGerencia]);
    useEffect(() => {
        if (configLoaded && !cfgForm) setCfgForm(initCfgForm(config));
    }, [configLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Secciones disponibles
    const secciones = esGerencia && !esAdmin ? [
        { id: 'horario',   label: 'Horario laboral', icon: '🕐' },
        { id: 'tasas',     label: 'Tasas',           icon: '💹' },
        { id: 'feriados',  label: 'Feriados',        icon: '📅' },
    ] : [
        { id: 'vendedores', label: 'Vendedores',      icon: '👤' },
        ...(esAdmin ? [
            { id: 'horario',   label: 'Horario laboral', icon: '🕐' },
            { id: 'tasas',     label: 'Tasas',           icon: '💹' },
            { id: 'feriados',  label: 'Feriados',        icon: '📅' },
            { id: 'moneda',    label: 'Moneda',          icon: '💱' },
            { id: 'tipos',     label: 'Tipos actividad', icon: '🏷️' },
            { id: 'pipeline',  label: 'Pipeline',        icon: '🔀' },
            { id: 'roltypes',  label: 'Permisos por rol',icon: '🔐' },
            { id: 'asistencia',label: 'Asistencia',      icon: '🕒' },
            { id: 'branding',  label: 'Branding',        icon: '🎨' },
        ] : []),
    ];

    // --- Vendedores ---
    const openEdit = (v) => {
        setEditing(v);
        setForm({ nombre:v.nombre, iniciales:v.iniciales, color:v.color,
            username:v.username||'', email:v.email||'', cargo:v.cargo||'', password:'', roles:v.roles||[],
            zkbio_employee_code: v.zkbio_employee_code || '',
            zkbio_device_name:   v.zkbio_device_name   || '',
            asistencia_activa:   v.asistencia_activa !== false });
        setMsg(null);
    };
    const openNew  = () => { setEditing('new'); setForm(EMPTY_FORM); setMsg(null); };
    const setF     = (k, val) => setForm(f => ({ ...f, [k]: val }));
    const toggleRol = (rol) => setForm(f => ({
        ...f, roles: f.roles.includes(rol) ? f.roles.filter(r => r !== rol) : [...f.roles, rol],
    }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.roles.length) return setMsg({ type:'err', text:'El vendedor debe tener al menos un rol.' });
        if (editing==='new' && !form.password) return setMsg({ type:'err', text:'La contraseña es obligatoria.' });
        setSaving(true); setMsg(null);
        try {
            const payload = { nombre:form.nombre, iniciales:form.iniciales.toUpperCase().slice(0,3),
                color:form.color, username:form.username, email:form.email, cargo:form.cargo, roles:form.roles,
                zkbio_employee_code: form.zkbio_employee_code?.trim() || null,
                zkbio_device_name:   form.zkbio_device_name?.trim() || null,
                asistencia_activa:   !!form.asistencia_activa };
            if (form.password) payload.password = form.password;
            if (editing==='new') {
                const created = await createVendedor(payload);
                setVendedores(vs => [...vs, created]);
                setMsg({ type:'ok', text:'Vendedor creado correctamente.' });
                setEditing(created); setForm(f => ({ ...f, password:'' }));
            } else {
                const updated = await updateVendedor(editing.id, payload);
                setVendedores(vs => vs.map(v => v.id===updated.id ? updated : v));
                setMsg({ type:'ok', text:'Guardado correctamente.' });
                setForm(f => ({ ...f, password:'' }));
            }
        } catch (err) {
            setMsg({ type:'err', text: err.response?.data?.error || 'Error al guardar.' });
        } finally { setSaving(false); }
    };

    // --- Config ---
    const isDiaActivo = (d) => cfgForm?.horario_dias.some(x => x.dia === d);
    const toggleDia   = (d) => setCfgForm(f => {
        const activo = f.horario_dias.some(x => x.dia === d);
        const nuevos = activo
            ? f.horario_dias.filter(x => x.dia !== d)
            : [...f.horario_dias, { dia:d, inicio:'09:00', fin:'13:00' }].sort((a,b) => a.dia-b.dia);
        return { ...f, horario_dias: nuevos };
    });
    const setHora = (d, campo, val) => setCfgForm(f => ({
        ...f, horario_dias: f.horario_dias.map(x => x.dia===d ? { ...x, [campo]:val } : x),
    }));

    const addFeriado = () => {
        const f = cfgForm.feriadoInput.trim();
        if (!f || cfgForm.feriados.includes(f)) return;
        setCfgForm(c => ({ ...c, feriados:[...c.feriados, f].sort(), feriadoInput:'' }));
    };
    const removeFeriado = (f) => setCfgForm(c => ({ ...c, feriados:c.feriados.filter(x => x !== f) }));

    const handleSaveCfg = async (e) => {
        e.preventDefault();
        setCfgSaving(true); setCfgMsg(null);
        try {
            const payload = {
                horario_dias:    cfgForm.horario_dias,
                tasa_sunat:      parseFloat(cfgForm.tasa_sunat)    / 100,
                tasa_comision:   parseFloat(cfgForm.tasa_comision) / 100,
                meta_global_rentabilidad: parseFloat(cfgForm.meta_global_rentabilidad) || 0,
                meta_global_facturacion:  parseFloat(cfgForm.meta_global_facturacion)  || 0,
                meta_global_rentabilidad_mes:  parseFloat(cfgForm.meta_global_rentabilidad_mes)  || 0,
                meta_global_facturacion_mes:   parseFloat(cfgForm.meta_global_facturacion_mes)   || 0,
                meta_global_rentabilidad_trim: parseFloat(cfgForm.meta_global_rentabilidad_trim) || 0,
                meta_global_facturacion_trim:  parseFloat(cfgForm.meta_global_facturacion_trim)  || 0,
                feriados:        cfgForm.feriados,
                moneda:          cfgForm.moneda,
                tipos_actividad: cfgForm.tipos_actividad,
                pipeline_etapas: cfgForm.pipeline_etapas,
                rol_tipos:       cfgForm.rol_tipos,
                branding:        cfgForm.branding,
                attendance_config: {
                    ...cfgForm.attendance_config,
                    tolerancia_minutos: parseInt(cfgForm.attendance_config.tolerancia_minutos, 10) || 0,
                    sedes: cfgForm.attendance_config.sedes_text
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean),
                },
            };
            const updated = await updateConfig(payload);
            setConfig(prev => ({ ...prev, ...updated }));
            setCfgMsg({ type:'ok', text:'Configuración guardada.' });
        } catch (err) {
            setCfgMsg({ type:'err', text: err.response?.data?.error || 'Error al guardar.' });
        } finally { setCfgSaving(false); }
    };

    // --- Tipos de actividad ---
    const addTipo = () => {
        const t = (cfgForm?.tipoInput || '').trim();
        if (!t) { setCfgMsg({ type:'err', text:'Escribe un nombre de tipo.' }); return; }
        const actuales = Array.isArray(cfgForm?.tipos_actividad) ? cfgForm.tipos_actividad : [];
        if (actuales.some(x => x.toLowerCase() === t.toLowerCase())) {
            setCfgMsg({ type:'err', text:`El tipo "${t}" ya existe.` }); return;
        }
        setCfgForm(f => ({ ...f, tipos_actividad: [...(f.tipos_actividad || []), t], tipoInput: '' }));
        setCfgMsg({ type:'ok', text:`Agregado "${t}". Presiona Guardar para aplicar.` });
    };
    const removeTipo = (t) => setCfgForm(f => ({
        ...f,
        tipos_actividad: f.tipos_actividad.filter(x => x !== t),
        pipeline_etapas: f.pipeline_etapas.map(e => ({ ...e, tipos: e.tipos.filter(x => x !== t) })),
        rol_tipos: Object.fromEntries(Object.entries(f.rol_tipos).map(([r, ts]) => [r, ts === null ? null : ts.filter(x => x !== t)])),
    }));

    // --- Pipeline ---
    const addEtapa = () => {
        const n = cfgForm?.etapaInput.trim();
        if (!n) return;
        setCfgForm(f => ({ ...f, pipeline_etapas: [...f.pipeline_etapas, { nombre: n, tipos: [] }], etapaInput: '' }));
    };
    const removeEtapa = (i) => setCfgForm(f => ({ ...f, pipeline_etapas: f.pipeline_etapas.filter((_, idx) => idx !== i) }));
    const getTipoEtapa = (tipo) => cfgForm?.pipeline_etapas.findIndex(e => e.tipos.includes(tipo)) ?? -1;
    const setTipoEtapa = (tipo, etapaIdx) => setCfgForm(f => ({
        ...f,
        pipeline_etapas: f.pipeline_etapas.map((e, i) => ({
            ...e,
            tipos: etapaIdx === i ? (e.tipos.includes(tipo) ? e.tipos : [...e.tipos, tipo]) : e.tipos.filter(t => t !== tipo),
        })),
    }));

    // --- ROL_TIPOS ---
    const toggleRolTipo = (rol, tipo) => setCfgForm(f => {
        const actual = f.rol_tipos[rol];
        if (actual === null) return { ...f, rol_tipos: { ...f.rol_tipos, [rol]: f.tipos_actividad.filter(t => t !== tipo) } };
        const nuevo = actual.includes(tipo) ? actual.filter(t => t !== tipo) : [...actual, tipo];
        return { ...f, rol_tipos: { ...f.rol_tipos, [rol]: nuevo } };
    });
    const toggleRolTodos = (rol) => setCfgForm(f => ({
        ...f, rol_tipos: { ...f.rol_tipos, [rol]: f.rol_tipos[rol] === null ? [] : null },
    }));

    const handleFotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !editing || editing === 'new') return;
        setFotoUploading(true); setFotoMsg(null);
        try {
            const { foto_url } = await uploadFotoVendedor(editing.id, file);
            const actualizado = { ...editing, foto_url };
            setEditing(actualizado);
            setVendedores(vs => vs.map(v => v.id === editing.id ? { ...v, foto_url } : v));
            setFotoMsg({ type:'ok', text:'Foto actualizada.' });
        } catch {
            setFotoMsg({ type:'err', text:'Error al subir la foto.' });
        } finally { setFotoUploading(false); }
    };

    const handleSaveTasa = async (id, edit) => {
        setSavingTasas(s => ({ ...s, [id]: true }));
        setMsgTasas(m => ({ ...m, [id]: null }));
        try {
            const updated = await updateVendedorMetas(id, {
                meta_mensual:      parseFloat(edit.meta_mensual)      || 0,
                meta_facturacion_mensual: parseFloat(edit.meta_facturacion_mensual) || 0,
                meta_rentabilidad_trimestral: parseFloat(edit.meta_rentabilidad_trimestral) || 0,
                meta_facturacion_trimestral: parseFloat(edit.meta_facturacion_trimestral) || 0,
                meta_rentabilidad_anual: parseFloat(edit.meta_rentabilidad_anual) || 0,
                meta_facturacion_anual:  parseFloat(edit.meta_facturacion_anual)  || 0,
                umbral_comision:   0,
                pct_comision_base: (parseFloat(edit.pct_comision_base) || 2)  / 100,
                pct_comision_bajo: (parseFloat(edit.pct_comision_bajo) || 7)  / 100,
                pct_comision_alto: (parseFloat(edit.pct_comision_alto) || 8)  / 100,
            });
            setVendedores(vs => vs.map(v => v.id === id ? { ...v, ...updated } : v));
            setEditingTasas(prev => { const n = { ...prev }; delete n[id]; return n; });
            setMsgTasas(m => ({ ...m, [id]: { type:'ok', text:'Guardado.' } }));
            setTimeout(() => setMsgTasas(m => ({ ...m, [id]: null })), 3000);
        } catch (err) {
            setMsgTasas(m => ({ ...m, [id]: { type:'err', text: err.response?.data?.error || 'Error al guardar.' } }));
        } finally {
            setSavingTasas(s => ({ ...s, [id]: false }));
        }
    };

    const handleSaveAttendanceVendor = async (v) => {
        setAttendanceSaving(s => ({ ...s, [v.id]: true }));
        setAttendanceMsg(m => ({ ...m, [v.id]: null }));
        try {
            const updated = await updateVendedor(v.id, {
                zkbio_employee_code: v.zkbio_employee_code || null,
                zkbio_device_name: v.zkbio_device_name || null,
                asistencia_activa: v.asistencia_activa !== false,
            });
            setVendedores(vs => vs.map(item => item.id === updated.id ? { ...item, ...updated } : item));
            setAttendanceMsg(m => ({ ...m, [v.id]: { type:'ok', text:'Guardado.' } }));
        } catch (err) {
            setAttendanceMsg(m => ({ ...m, [v.id]: { type:'err', text: err.response?.data?.error || 'Error al guardar.' } }));
        } finally {
            setAttendanceSaving(s => ({ ...s, [v.id]: false }));
        }
    };

    const isNew = editing === 'new';

    return (
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, alignItems:'start' }}>

            {/* Sidebar de secciones */}
            <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflow:'hidden' }}>
                {secciones.map(s => (
                    <button key={s.id} onClick={() => { setSeccion(s.id); setEditing(null); setMsg(null); }} style={{
                        display:'flex', alignItems:'center', gap:10, width:'100%',
                        padding:'13px 18px', border:'none', cursor:'pointer', textAlign:'left',
                        background: seccion===s.id ? (tk.isDark ? '#1a2744' : '#f0f5ff') : 'transparent',
                        borderLeft: seccion===s.id ? '3px solid #10b981' : '3px solid transparent',
                        borderBottom:`1px solid ${tk.bdr}`,
                        fontWeight: seccion===s.id ? 700 : 500,
                        fontSize:13, color: seccion===s.id ? '#10b981' : tk.txt,
                    }}>
                        <span style={{ fontSize:16 }}>{s.icon}</span>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Panel derecho */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* ── VENDEDORES ── */}
                {seccion === 'vendedores' && (
                    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:16, alignItems:'start' }}>

                        {/* Lista */}
                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflow:'hidden' }}>
                            <div style={{ padding:'13px 16px', borderBottom:`1px solid ${tk.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontWeight:700, fontSize:13 }}>Vendedores</span>
                                <button onClick={openNew} style={{ padding:'5px 12px', background:'#10b981', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Nuevo</button>
                            </div>
                            {vendedores.map(v => (
                                <button key={v.id} onClick={() => openEdit(v)} style={{
                                    display:'flex', alignItems:'center', gap:10, width:'100%',
                                    padding:'11px 16px', background:(!isNew && editing?.id===v.id)?'#f0f5ff':'none',
                                    border:'none', borderBottom:'1px solid #f3f4f6', cursor:'pointer', textAlign:'left',
                                    borderLeft:(!isNew && editing?.id===v.id)?'3px solid #10b981':'3px solid transparent',
                                }}>
                                    <Avatar vendedor={v} size="sm" />
                                    <div style={{ minWidth:0 }}>
                                        <div style={{ fontSize:13, fontWeight:600, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                                        <div style={{ fontSize:11, color:tk.txt2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.cargo||(v.roles||[]).join(', ')}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Formulario */}
                        {editing ? (
                            <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'22px 24px' }}>
                                <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:18 }}>
                                    {isNew ? 'Nuevo vendedor' : `Editar: ${editing.nombre}`}
                                </div>

                                {/* Foto de perfil — solo al editar */}
                                {!isNew && (
                                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, padding:'14px 16px', background:tk.card2, borderRadius:10 }}>
                                        <Avatar vendedor={editing} size="lg" />
                                        <div>
                                            <div style={{ fontSize:12, fontWeight:600, color:tk.txt, marginBottom:6 }}>Foto de perfil</div>
                                            <label style={{ display:'inline-block', padding:'6px 14px', background:'#10b981', color:'#fff', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                                {fotoUploading ? 'Subiendo...' : 'Cambiar foto'}
                                                <input type="file" accept="image/*" style={{ display:'none' }} disabled={fotoUploading} onChange={handleFotoUpload} />
                                            </label>
                                            {fotoMsg && <div style={{ fontSize:11, marginTop:5, color: fotoMsg.type==='ok'?'#27ae60':'#e74c3c' }}>{fotoMsg.text}</div>}
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleSave} style={{ display:'grid', gap:14, maxWidth:440 }}>
                                    <label style={lbl}>Nombre completo *
                                        <input style={inp} required value={form.nombre} onChange={e => setF('nombre', e.target.value)} />
                                    </label>
                                    <label style={lbl}>Cargo / Descripción
                                        <input style={inp} placeholder="Ej: Ejecutivo de Ventas" value={form.cargo} onChange={e => setF('cargo', e.target.value)} />
                                    </label>
                                    <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:12, alignItems:'end' }}>
                                        <label style={lbl}>Iniciales *
                                            <input style={inp} required maxLength={3} value={form.iniciales} onChange={e => setF('iniciales', e.target.value.toUpperCase())} />
                                        </label>
                                        <label style={lbl}>Color
                                            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
                                                {COLORS.map(c => (
                                                    <button key={c} type="button" onClick={() => setF('color', c)} style={{ width:24, height:24, borderRadius:'50%', background:c, border: form.color===c?'3px solid #1e2a3b':'2px solid transparent', cursor:'pointer', padding:0 }} />
                                                ))}
                                                <span style={{ width:24, height:24, borderRadius:'50%', background:form.color, color:'#fff', fontSize:8, fontWeight:700, marginLeft:4, display:'flex', alignItems:'center', justifyContent:'center' }}>{form.iniciales||'?'}</span>
                                            </div>
                                        </label>
                                    </div>
                                    <label style={lbl}>Email *
                                        <input style={inp} type="email" required value={form.email} onChange={e => setF('email', e.target.value)} />
                                    </label>
                                    <label style={lbl}>Usuario *
                                        <input style={inp} type="text" required placeholder="nombre.apellido" value={form.username} onChange={e => setF('username', e.target.value)} />
                                    </label>
                                    <label style={lbl}>{isNew ? 'Contraseña *' : 'Nueva contraseña'}
                                        <input style={inp} type="password" placeholder={isNew?'Contraseña inicial':'Dejar vacío para no cambiar'} required={isNew} value={form.password} onChange={e => setF('password', e.target.value)} />
                                    </label>
                                    <div>
                                        <div style={{ fontSize:12, color:tk.txt2, fontWeight:600, marginBottom:8 }}>Roles *</div>
                                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                            {ROLES.map(rol => {
                                                const active = form.roles.includes(rol);
                                                return <button key={rol} type="button" onClick={() => toggleRol(rol)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', background:active?'#10b981':'#10b981'+(tk.isDark?'28':'18'), color:active?'#fff':tk.txt, border:`1px solid ${active?'#10b981':'#10b981'+(tk.isDark?'44':'33')}` }}>{rol}</button>;
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ borderTop:`1px solid ${tk.bdr}`, paddingTop:16 }}>
                                        <div style={{ fontSize:12, color:tk.txt2, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>🕒 Asistencia (BioTime)</div>
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                            <label style={lbl}>Código BioTime (DNI)
                                                <input style={inp} placeholder="Ej: 76507151" value={form.zkbio_employee_code || ''} onChange={e => setF('zkbio_employee_code', e.target.value)} />
                                            </label>
                                            <label style={lbl}>Sede / Dispositivo (opcional)
                                                <input style={inp} placeholder="Ej: PUERTA-1" value={form.zkbio_device_name || ''} onChange={e => setF('zkbio_device_name', e.target.value)} />
                                            </label>
                                        </div>
                                        <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13, color:tk.txt, cursor:'pointer' }}>
                                            <input type="checkbox" checked={!!form.asistencia_activa} onChange={e => setF('asistencia_activa', e.target.checked)} />
                                            Aparece en el resumen de asistencia
                                        </label>
                                    </div>
                                    {msg && <MsgBox msg={msg} />}
                                    <div style={{ display:'flex', gap:10 }}>
                                        <button type="submit" disabled={saving} style={{ padding:'9px 22px', background:saving?'#a0b8e8':'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:saving?'default':'pointer' }}>{saving?'Guardando...':isNew?'Crear vendedor':'Guardar cambios'}</button>
                                        <button type="button" onClick={() => setEditing(null)} style={{ padding:'9px 18px', background:tk.bg, color:tk.txt, border:'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancelar</button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:40, textAlign:'center', color:tk.txt2, fontSize:13 }}>
                                Seleccioná un vendedor o presioná <strong>+ Nuevo</strong>.
                            </div>
                        )}
                    </div>
                )}

                {/* ── HORARIO ── */}
                {seccion === 'horario' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:20 }}>Horario laboral (Lima)</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:10, maxWidth:420 }}>
                            {DIAS_LABEL.map((label, d) => {
                                const activo = isDiaActivo(d);
                                const entry  = cfgForm.horario_dias.find(x => x.dia === d);
                                return (
                                    <div key={d} style={{ display:'flex', alignItems:'center', gap:12 }}>
                                        <button type="button" onClick={() => toggleDia(d)} style={{ width:36, height:36, borderRadius:'50%', fontSize:12, fontWeight:700, cursor:'pointer', border:'none', flexShrink:0, background:activo?'#10b981':'#f0f2f5', color:activo?'#fff':'#6b7a8d' }}>{label}</button>
                                        {activo && entry ? (
                                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                <input type="time" style={{ ...inp, width:110 }} value={entry.inicio} onChange={e => setHora(d,'inicio',e.target.value)} />
                                                <span style={{ color:tk.txt2, fontSize:12 }}>→</span>
                                                <input type="time" style={{ ...inp, width:110 }} value={entry.fin} onChange={e => setHora(d,'fin',e.target.value)} />
                                            </div>
                                        ) : (
                                            <span style={{ fontSize:12, color:'#bbb' }}>No laboral</span>
                                        )}
                                    </div>
                                );
                            })}
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div style={{ marginTop:8 }}>
                                <button type="submit" disabled={cfgSaving} style={{ padding:'9px 22px', background:cfgSaving?'#a0b8e8':'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:cfgSaving?'default':'pointer' }}>{cfgSaving?'Guardando...':'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── TASAS ── */}
                {seccion === 'tasas' && cfgForm && (
                    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                        {/* SUNAT global */}
                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'22px 26px' }}>
                            <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:3 }}>SUNAT — tasa sobre Rentabilidad Bruta</div>
                            <div style={{ fontSize:12, color:tk.txt3, marginBottom:16 }}>Se aplica sobre Facturación menos Costo real en la calculadora de comisiones.</div>
                            <form onSubmit={handleSaveCfg} style={{ display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>
                                <label style={lbl}>Tasa sobre Rentabilidad Bruta (%)
                                    <input type="number" min="0" max="100" step="0.1" style={{ ...inp, width:140 }}
                                        value={cfgForm.tasa_sunat}
                                        onChange={e => setCfgForm(f => ({ ...f, tasa_sunat:e.target.value }))} />
                                </label>
                                <button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>
                                    {cfgSaving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </form>
                            {cfgMsg && <div style={{ marginTop:12 }}><MsgBox msg={cfgMsg} /></div>}
                        </div>

                        {/* Meta Global de la empresa */}
                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'22px 26px' }}>
                            <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:3 }}>Meta Global de la empresa</div>
                            <div style={{ fontSize:12, color:tk.txt3, marginBottom:16 }}>Se muestran en el Dashboard como Meta Global de Rentabilidad y Facturación según el periodo.</div>
                            <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:14 }}>
                                {[
                                    { titulo:'Mensual',     keyR:'meta_global_rentabilidad_mes',  keyF:'meta_global_facturacion_mes' },
                                    { titulo:'Trimestral',  keyR:'meta_global_rentabilidad_trim', keyF:'meta_global_facturacion_trim' },
                                    { titulo:'Anual',       keyR:'meta_global_rentabilidad',      keyF:'meta_global_facturacion' },
                                ].map(p => (
                                    <div key={p.titulo} style={{ display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>
                                        <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, minWidth:90 }}>{p.titulo}</div>
                                        <label style={lbl}>Rentabilidad (USD)
                                            <input type="number" min="0" step="0.01" style={{ ...inp, width:180 }}
                                                value={cfgForm[p.keyR]}
                                                onChange={e => setCfgForm(f => ({ ...f, [p.keyR]:e.target.value }))} />
                                        </label>
                                        <label style={lbl}>Facturación (USD)
                                            <input type="number" min="0" step="0.01" style={{ ...inp, width:180 }}
                                                value={cfgForm[p.keyF]}
                                                onChange={e => setCfgForm(f => ({ ...f, [p.keyF]:e.target.value }))} />
                                        </label>
                                    </div>
                                ))}
                                <div>
                                    <button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>
                                        {cfgSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Cuotas y comisiones por vendedor */}
                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflowX:'auto', overflowY:'hidden' }}>
                            <div style={{ padding:'16px 22px', borderBottom:`1px solid ${tk.bdr}` }}>
                                <div style={{ fontWeight:700, fontSize:14, color:tk.txt }}>Cuotas y comisiones por vendedor</div>
                                <div style={{ fontSize:12, color:tk.txt3, marginTop:3 }}>Metas mensuales/trimestrales y tasas de comisión por persona. La meta de Facturación no afecta las comisiones.</div>
                            </div>

                            {/* Header */}
                            <div style={{ display:'grid', gridTemplateColumns:'minmax(150px,1fr) repeat(6,110px) repeat(3,100px) 100px', gap:10, padding:'9px 22px', borderBottom:`1px solid ${tk.bdr}`, background:tk.bg, minWidth:1290 }}>
                                {[
                                    'Vendedor',
                                    'Rent. Bruta Mes',
                                    'Facturación Mes',
                                    'Rent. Bruta Trim',
                                    'Facturación Trim',
                                    'Rent. Bruta Anual',
                                    'Facturación Anual',
                                    'Comision 2%-14%',
                                    'Comisión ≥15%',
                                    'Comisión ≥20%',
                                    '',
                                ].map((h, i) => (
                                    <span key={i} style={{ fontSize:11, fontWeight:700, color:tk.txt3, textTransform:'uppercase', letterSpacing:0.5 }}>{h}</span>
                                ))}
                            </div>

                            {vendedores.map(v => {
                                const defBase = parseFloat(v.pct_comision_base ?? 0.02) * 100;
                                const defBajo = parseFloat(v.pct_comision_bajo ?? 0.07) * 100;
                                const defAlto = parseFloat(v.pct_comision_alto ?? 0.08) * 100;
                                const edit = editingTasas[v.id] ?? {
                                    meta_mensual:     v.meta_mensual ?? 0,
                                    meta_facturacion_mensual: v.meta_facturacion_mensual ?? 0,
                                    meta_rentabilidad_trimestral: v.meta_rentabilidad_trimestral ?? 0,
                                    meta_facturacion_trimestral: v.meta_facturacion_trimestral ?? 0,
                                    meta_rentabilidad_anual: v.meta_rentabilidad_anual ?? 0,
                                    meta_facturacion_anual:  v.meta_facturacion_anual  ?? 0,
                                    pct_comision_base: defBase,
                                    pct_comision_bajo: defBajo,
                                    pct_comision_alto: defAlto,
                                };
                                const isSaving = !!savingTasas[v.id];
                                const rowMsg   = msgTasas[v.id];
                                const changed  = String(edit.meta_mensual)      !== String(v.meta_mensual ?? 0)
                                             || String(edit.meta_facturacion_mensual) !== String(v.meta_facturacion_mensual ?? 0)
                                             || String(edit.meta_rentabilidad_trimestral) !== String(v.meta_rentabilidad_trimestral ?? 0)
                                             || String(edit.meta_facturacion_trimestral) !== String(v.meta_facturacion_trimestral ?? 0)
                                             || String(edit.meta_rentabilidad_anual) !== String(v.meta_rentabilidad_anual ?? 0)
                                             || String(edit.meta_facturacion_anual)  !== String(v.meta_facturacion_anual  ?? 0)
                                             || String(edit.pct_comision_base)  !== String(defBase)
                                             || String(edit.pct_comision_bajo)  !== String(defBajo)
                                             || String(edit.pct_comision_alto)  !== String(defAlto);
                                const setEdit  = (field, val) => setEditingTasas(prev => ({
                                    ...prev, [v.id]: { ...edit, [field]: val },
                                }));
                                return (
                                    <div key={v.id} style={{ display:'grid', gridTemplateColumns:'minmax(150px,1fr) repeat(6,110px) repeat(3,100px) 100px', gap:10, padding:'13px 22px', borderBottom:`1px solid ${tk.bdr}`, alignItems:'center', minWidth:1290 }}>
                                        {/* Vendedor */}
                                        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                                            <Avatar vendedor={v} size="sm" />
                                            <div style={{ minWidth:0 }}>
                                                <div style={{ fontSize:13, fontWeight:600, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                                                <div style={{ fontSize:11, color:tk.txt3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{(v.roles||[]).join(', ')}</div>
                                            </div>
                                        </div>

                                        {/* Metas */}
                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_mensual}
                                            onChange={e => setEdit('meta_mensual', e.target.value)} />

                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_facturacion_mensual}
                                            onChange={e => setEdit('meta_facturacion_mensual', e.target.value)} />

                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_rentabilidad_trimestral}
                                            onChange={e => setEdit('meta_rentabilidad_trimestral', e.target.value)} />

                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_facturacion_trimestral}
                                            onChange={e => setEdit('meta_facturacion_trimestral', e.target.value)} />

                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_rentabilidad_anual}
                                            onChange={e => setEdit('meta_rentabilidad_anual', e.target.value)} />

                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                            style={{ ...inp, width:'100%' }}
                                            value={edit.meta_facturacion_anual}
                                            onChange={e => setEdit('meta_facturacion_anual', e.target.value)} />

                                        {/* Comisión ≥15% margen */}
                                        <PctInput value={edit.pct_comision_base} inp={inp}
                                            onChange={val => setEdit('pct_comision_base', val)} />

                                        <PctInput value={edit.pct_comision_bajo} inp={inp}
                                            onChange={val => setEdit('pct_comision_bajo', val)} />

                                        {/* Comisión ≥20% margen */}
                                        <PctInput value={edit.pct_comision_alto} inp={inp}
                                            onChange={val => setEdit('pct_comision_alto', val)} />

                                        {/* Acción */}
                                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                            <button
                                                disabled={isSaving || !changed}
                                                onClick={() => handleSaveTasa(v.id, edit)}
                                                style={{ padding:'7px 14px', background: isSaving || !changed ? '#a0b8e8' : '#10b981', color:'#fff', border:'none', borderRadius:7, fontWeight:700, fontSize:12, cursor: isSaving || !changed ? 'default' : 'pointer' }}>
                                                {isSaving ? 'Guardando...' : 'Guardar'}
                                            </button>
                                            {rowMsg && <div style={{ fontSize:11, color: rowMsg.type==='ok' ? '#27ae60' : '#e74c3c' }}>{rowMsg.type==='ok' ? '✓' : '⚠'} {rowMsg.text}</div>}
                                        </div>
                                    </div>
                                );
                            })}

                            {!vendedores.length && (
                                <div style={{ padding:'28px 22px', textAlign:'center', fontSize:13, color:tk.txt3 }}>Sin vendedores.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── FERIADOS ── */}
                {seccion === 'feriados' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:20 }}>Feriados</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:16, maxWidth:480 }}>
                            <div style={{ display:'flex', gap:8 }}>
                                <input type="date" style={{ ...inp, width:170 }}
                                    value={cfgForm.feriadoInput}
                                    onChange={e => setCfgForm(f => ({ ...f, feriadoInput:e.target.value }))}
                                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addFeriado())} />
                                <button type="button" onClick={addFeriado} style={{ padding:'9px 16px', background:tk.bg, border:`1px solid ${tk.bdr}`, borderRadius:7, fontSize:13, cursor:'pointer', fontWeight:600, color:tk.txt }}>+ Agregar</button>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {cfgForm.feriados.map(f => (
                                    <span key={f} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', background:'#fff3cd', border:'1px solid #f0c040', borderRadius:20, fontSize:12, color:'#856404' }}>
                                        {f}
                                        <button type="button" onClick={() => removeFeriado(f)} style={{ background:'none', border:'none', cursor:'pointer', color:'#856404', fontSize:15, lineHeight:1, padding:0 }}>×</button>
                                    </span>
                                ))}
                                {!cfgForm.feriados.length && <span style={{ fontSize:12, color:'#bbb' }}>Sin feriados agregados.</span>}
                            </div>
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div>
                                <button type="submit" disabled={cfgSaving} style={{ padding:'9px 22px', background:cfgSaving?'#a0b8e8':'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:cfgSaving?'default':'pointer' }}>{cfgSaving?'Guardando...':'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── MONEDA ── */}
                {seccion === 'moneda' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:20 }}>Moneda</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:18, maxWidth:340 }}>
                            <label style={lbl}>Moneda de la empresa
                                <select style={inp} value={cfgForm.moneda} onChange={e => setCfgForm(f => ({ ...f, moneda: e.target.value }))}>
                                    {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </label>
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar'}</button></div>
                        </form>
                    </div>
                )}

                {/* ── TIPOS DE ACTIVIDAD ── */}
                {seccion === 'tipos' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:6 }}>Tipos de actividad</div>
                        <div style={{ fontSize:12, color:tk.txt3, marginBottom:18 }}>Eliminar un tipo lo quita del pipeline y permisos por rol.</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:18, maxWidth:520 }}>
                            <div style={{ display:'flex', gap:8 }}>
                                <input style={{ ...inp, width:220 }} placeholder="Nuevo tipo..." value={cfgForm.tipoInput}
                                    onChange={e => setCfgForm(f => ({ ...f, tipoInput: e.target.value }))}
                                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addTipo())} />
                                <button type="button" onClick={addTipo} style={{ padding:'9px 18px', background:'#10b981', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 }}>+ Agregar tipo</button>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {cfgForm.tipos_actividad.map(t => (
                                    <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', background:tk.bg, border:`1px solid ${tk.bdr}`, borderRadius:20, fontSize:12, color:tk.txt, fontWeight:600 }}>
                                        {TYPE_ICON[t] || '📌'} {t}
                                        <button type="button" onClick={() => removeTipo(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', fontSize:15, lineHeight:1, padding:0 }}>×</button>
                                    </span>
                                ))}
                            </div>
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar'}</button></div>
                        </form>
                    </div>
                )}

                {/* ── PIPELINE ── */}
                {seccion === 'pipeline' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:20 }}>Pipeline</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:20, maxWidth:580 }}>
                            {/* Etapas */}
                            <div>
                                <div style={{ fontSize:12, color:tk.txt2, fontWeight:600, marginBottom:10 }}>Etapas</div>
                                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                                    <input style={{ ...inp, width:200 }} placeholder="Nueva etapa..." value={cfgForm.etapaInput}
                                        onChange={e => setCfgForm(f => ({ ...f, etapaInput: e.target.value }))}
                                        onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addEtapa())} />
                                    <button type="button" onClick={addEtapa} style={{ padding:'9px 16px', background:tk.bg, border:`1px solid ${tk.bdr}`, borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Agregar</button>
                                </div>
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                    {cfgForm.pipeline_etapas.map((e, i) => (
                                        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', background:'#eaf4fb', border:'1px solid #aed6f1', borderRadius:20, fontSize:12, color:'#1a5276', fontWeight:600 }}>
                                            {e.nombre}
                                            <button type="button" onClick={() => removeEtapa(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', fontSize:15, lineHeight:1, padding:0 }}>×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {/* Asignar tipos a etapas */}
                            <div>
                                <div style={{ fontSize:12, color:tk.txt2, fontWeight:600, marginBottom:10 }}>Asignar tipo → etapa</div>
                                <div style={{ display:'grid', gap:8 }}>
                                    {cfgForm.tipos_actividad.map(tipo => (
                                        <div key={tipo} style={{ display:'flex', alignItems:'center', gap:10 }}>
                                            <span style={{ fontSize:13, color:tk.txt, width:160, flexShrink:0 }}>{TYPE_ICON[tipo] || '📌'} {tipo}</span>
                                            <select style={{ ...inp, width:180 }} value={getTipoEtapa(tipo)}
                                                onChange={e => setTipoEtapa(tipo, parseInt(e.target.value))}>
                                                <option value={-1}>— Sin etapa —</option>
                                                {cfgForm.pipeline_etapas.map((e, i) => <option key={i} value={i}>{e.nombre}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar'}</button></div>
                        </form>
                    </div>
                )}

                {/* ── PERMISOS POR ROL ── */}
                {seccion === 'roltypes' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:6 }}>Permisos por rol</div>
                        <div style={{ fontSize:12, color:tk.txt3, marginBottom:20 }}>Qué tipos de actividad puede crear cada rol. Gerencia siempre puede ver todo.</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:20 }}>
                            {ROLES.map(rol => {
                                const esTodos = cfgForm.rol_tipos[rol] === null;
                                const activos = cfgForm.rol_tipos[rol] || [];
                                return (
                                    <div key={rol} style={{ borderBottom:`1px solid ${tk.bdr}`, paddingBottom:16 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                                            <span style={{ fontSize:13, fontWeight:700, color:tk.txt, width:130 }}>{rol}</span>
                                            <button type="button" onClick={() => toggleRolTodos(rol)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: esTodos?'#10b981':'#10b981'+(tk.isDark?'28':'18'), color: esTodos?'#fff':tk.txt }}>
                                                {esTodos ? '✓ Todos' : 'Todos'}
                                            </button>
                                        </div>
                                        {!esTodos && (
                                            <div style={{ display:'flex', flexWrap:'wrap', gap:6, paddingLeft:140 }}>
                                                {cfgForm.tipos_actividad.map(tipo => {
                                                    const on = activos.includes(tipo);
                                                    return (
                                                        <button key={tipo} type="button" onClick={() => toggleRolTipo(rol, tipo)}
                                                            style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', background: on?'#10b981':'#10b981'+(tk.isDark?'28':'18'), color: on?'#fff':tk.txt, borderColor: on?'#10b981':'#10b981'+(tk.isDark?'44':'33') }}>
                                                            {TYPE_ICON[tipo] || '📌'} {tipo}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar'}</button></div>
                        </form>
                    </div>
                )}

                {/* ── BRANDING ── */}
                {seccion === 'asistencia' && cfgForm && (
                    <div style={{ display:'grid', gap:16 }}>
                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                            <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:6 }}>Configuracion de asistencia</div>
                            <div style={{ fontSize:12, color:tk.txt3, marginBottom:18 }}>Define la politica base para calcular tardanza y las sedes esperadas.</div>
                            <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:16, maxWidth:560 }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                                    <label style={lbl}>Zona horaria
                                        <input style={inp} value={cfgForm.attendance_config.timezone}
                                            onChange={e => setCfgForm(f => ({ ...f, attendance_config: { ...f.attendance_config, timezone: e.target.value } }))} />
                                    </label>
                                    <label style={lbl}>Ingreso esperado
                                        <input type="time" style={inp} value={cfgForm.attendance_config.ingreso_esperado}
                                            onChange={e => setCfgForm(f => ({ ...f, attendance_config: { ...f.attendance_config, ingreso_esperado: e.target.value } }))} />
                                    </label>
                                    <label style={lbl}>Tolerancia (min)
                                        <input type="number" min="0" style={inp} value={cfgForm.attendance_config.tolerancia_minutos}
                                            onChange={e => setCfgForm(f => ({ ...f, attendance_config: { ...f.attendance_config, tolerancia_minutos: e.target.value } }))} />
                                    </label>
                                </div>
                                <label style={lbl}>Modo de tardanza
                                    <select style={inp} value={cfgForm.attendance_config.tardanza_modo}
                                        onChange={e => setCfgForm(f => ({ ...f, attendance_config: { ...f.attendance_config, tardanza_modo: e.target.value } }))}>
                                        <option value="primera_entrada">Primera entrada</option>
                                    </select>
                                </label>
                                <label style={lbl}>Sedes validas (una por linea)
                                    <textarea rows={4} style={{ ...inp, resize:'vertical' }} value={cfgForm.attendance_config.sedes_text}
                                        onChange={e => setCfgForm(f => ({ ...f, attendance_config: { ...f.attendance_config, sedes_text: e.target.value } }))} />
                                </label>
                                {cfgMsg && <MsgBox msg={cfgMsg} />}
                                <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar configuracion'}</button></div>
                            </form>
                        </div>

                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, overflow:'hidden' }}>
                            <div style={{ padding:'16px 22px', borderBottom:`1px solid ${tk.bdr}` }}>
                                <div style={{ fontWeight:700, fontSize:14, color:tk.txt }}>Vinculos CRM ↔ ZKBio</div>
                                <div style={{ fontSize:12, color:tk.txt3, marginTop:3 }}>Relaciona cada vendedor con su codigo biometrico y controla si participa en asistencia.</div>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 180px 180px 120px 110px', gap:10, padding:'9px 22px', borderBottom:`1px solid ${tk.bdr}`, background:tk.bg }}>
                                {['Vendedor','Codigo ZKBio','Sede por defecto','Control',''].map((h, i) => (
                                    <span key={i} style={{ fontSize:11, fontWeight:700, color:tk.txt3, textTransform:'uppercase', letterSpacing:0.5 }}>{h}</span>
                                ))}
                            </div>
                            {vendedores.map(v => {
                                const rowMsg = attendanceMsg[v.id];
                                const isSaving = attendanceSaving[v.id];
                                const setVendorField = (field, value) => setVendedores(prev => prev.map(item => item.id === v.id ? { ...item, [field]: value } : item));
                                return (
                                    <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr 180px 180px 120px 110px', gap:10, padding:'13px 22px', borderBottom:`1px solid ${tk.bdr}`, alignItems:'center' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                            <Avatar vendedor={v} size="sm" />
                                            <div style={{ minWidth:0 }}>
                                                <div style={{ fontSize:13, fontWeight:600, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre}</div>
                                                <div style={{ fontSize:11, color:tk.txt3 }}>{v.email}</div>
                                            </div>
                                        </div>
                                        <input style={{ ...inp, width:'100%' }} value={v.zkbio_employee_code || ''} onChange={e => setVendorField('zkbio_employee_code', e.target.value)} placeholder="Ej: 73567017" />
                                        <input style={{ ...inp, width:'100%' }} value={v.zkbio_device_name || ''} onChange={e => setVendorField('zkbio_device_name', e.target.value)} placeholder="Ej: San Borja" />
                                        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:tk.txt }}>
                                            <input type="checkbox" checked={v.asistencia_activa !== false} onChange={e => setVendorField('asistencia_activa', e.target.checked)} />
                                            Activo
                                        </label>
                                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                            <button disabled={isSaving} onClick={() => handleSaveAttendanceVendor(v)} style={{ padding:'7px 12px', background:isSaving?'#a0b8e8':'#10b981', color:'#fff', border:'none', borderRadius:7, fontWeight:700, fontSize:12, cursor:isSaving?'default':'pointer' }}>
                                                {isSaving ? 'Guardando...' : 'Guardar'}
                                            </button>
                                            {rowMsg && <div style={{ fontSize:11, color: rowMsg.type==='ok' ? '#27ae60' : '#e74c3c' }}>{rowMsg.text}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'20px 24px' }}>
                            <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:6 }}>Codigos sin vincular</div>
                            <div style={{ fontSize:12, color:tk.txt3, marginBottom:16 }}>Marcaciones existentes en backend que aun no corresponden a un vendedor del CRM.</div>
                            <div style={{ display:'grid', gap:8 }}>
                                {unmapped.length ? unmapped.map(item => (
                                    <div key={item.zkbio_employee_code} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'10px 12px', borderRadius:8, background:tk.card2, border:`1px solid ${tk.bdr}` }}>
                                        <div>
                                            <div style={{ fontSize:13, fontWeight:700, color:tk.txt }}>{item.zkbio_employee_code}</div>
                                            <div style={{ fontSize:11, color:tk.txt3 }}>{item.sede || 'Sin sede'}</div>
                                        </div>
                                        <div style={{ textAlign:'right', fontSize:11, color:tk.txt3 }}>
                                            <div>{item.total_marcaciones} marcacion(es)</div>
                                            <div>{item.ultima_marcacion ? new Date(item.ultima_marcacion).toLocaleString('es-PE') : 'Sin fecha'}</div>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ fontSize:12, color:tk.txt3 }}>No hay codigos pendientes de vinculacion.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {seccion === 'branding' && cfgForm && (
                    <div style={{ background:tk.card, borderRadius:10, boxShadow:tk.shadow, padding:'24px 28px' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:tk.txt, marginBottom:20 }}>Branding</div>
                        <form onSubmit={handleSaveCfg} style={{ display:'grid', gap:20, maxWidth:520 }}>

                            {/* Modo oscuro */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background: cfgForm.branding.dark_mode ? '#0f172a' : '#f8f9fb', borderRadius:8, border:`1px solid ${tk.bdr}` }}>
                                <div>
                                    <div style={{ fontSize:13, fontWeight:600, color: cfgForm.branding.dark_mode ? '#e2e8f0' : '#1e2a3b' }}>Modo oscuro</div>
                                    <div style={{ fontSize:11, color:tk.txt3, marginTop:2 }}>Cambia el tema de toda la aplicación</div>
                                </div>
                                <button type="button"
                                    onClick={() => setCfgForm(f => ({ ...f, branding: { ...f.branding, dark_mode: !f.branding.dark_mode } }))}
                                    style={{
                                        width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                                        background: cfgForm.branding.dark_mode ? '#10b981' : '#dde1e8',
                                        position:'relative', transition:'background 0.2s', flexShrink:0,
                                    }}
                                >
                                    <span style={{
                                        position:'absolute', top:3, left: cfgForm.branding.dark_mode ? 23 : 3,
                                        width:18, height:18, borderRadius:'50%', background:'#fff',
                                        transition:'left 0.2s', display:'block',
                                    }} />
                                </button>
                            </div>

                            {/* Subtítulo */}
                            <label style={lbl}>Subtítulo (debajo del logo en sidebar)
                                <input style={inp} value={cfgForm.branding.subtitulo}
                                    onChange={e => setCfgForm(f => ({ ...f, branding: { ...f.branding, subtitulo: e.target.value } }))} />
                            </label>

                            {/* Logos editables */}
                            {[
                                { key:'logo_sidebar', label:'Logo Sidebar expandido (fondo oscuro)', preview:'#1e2a3b' },
                                { key:'logo_iso',     label:'Logo Sidebar colapsado (fondo oscuro)', preview:'#1e2a3b' },
                            ].map(({ key, label, preview }) => (
                                <div key={key}>
                                    <label style={lbl}>{label}
                                        <input style={inp} placeholder="https://..." value={cfgForm.branding[key]}
                                            onChange={e => setCfgForm(f => ({ ...f, branding: { ...f.branding, [key]: e.target.value } }))} />
                                    </label>
                                    {cfgForm.branding[key] && (
                                        <div style={{ marginTop:8, padding:'12px 16px', background: preview, borderRadius:8, display:'inline-flex', alignItems:'center' }}>
                                            <img src={cfgForm.branding[key]} alt={label} style={{ height:36, maxWidth:160, objectFit:'contain' }} />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {cfgMsg && <MsgBox msg={cfgMsg} />}
                            <div><button type="submit" disabled={cfgSaving} style={btnGuardar(cfgSaving)}>{cfgSaving?'Guardando...':'Guardar'}</button></div>
                        </form>
                    </div>
                )}

            </div>
        </div>
    );
}

const btnGuardar = (saving) => ({ padding:'9px 22px', background: saving?'#a0b8e8':'#10b981', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor: saving?'default':'pointer' });

function PctInput({ value, inp, onChange }) {
    return (
        <div style={{ position:'relative' }}>
            <input type="number" min="0" max="100" step="0.01" placeholder="0.00"
                style={{ ...inp, width:'100%', paddingRight:22 }}
                value={value}
                onChange={e => onChange(e.target.value)} />
            <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#8899aa', pointerEvents:'none' }}>%</span>
        </div>
    );
}
