import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { getClientes, createCliente, lookupRuc, lookupDni, uploadArchivoActividad, deleteArchivoActividad } from '../api/actividades';
import { TIPOS, ESTADOS, PRIORIDADES, MESES, ROL_TIPOS, ROLES, TIPOS_CON_RESULTADO, getTypeColor, fmt as fmtDur } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';
import { FileIcon, ImageIcon, PaperclipIcon } from './Icons';
import { getEffectiveRoles, isAdminUser } from '../utils/roles';


function fmtTS(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function todayInputDate() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
}

const EMPTY = {
    nombre: '', tipo: 'Venta', vendedor_id: '', cliente: '',
    monto: '', prioridad: 'Media', estado: 'Pendiente',
    mes: MESES[new Date().getMonth()], fecha: todayInputDate(), fecha_fin: '', notas: '',
    precio_venta: '', costo_base: '', gastos_operativos: [], ajuste_interno: '',
    cliente_ruc: '', cliente_email: '', cliente_telefono: '',
    colaboradores: [], checklist: [],
};

const docLabel = (doc) => String(doc || '').replace(/\D/g, '').length === 8 ? 'DNI' : 'RUC';

const MARKETING_TIPOS = new Set(['Publicidad','Redes','Video','P. Graficas Externas','P. Graficas Internas','Actividad','Evento','Piezas graficas']);

function parseArr(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
}

function gastosFromActividad(actividad) {
    const gastos = parseArr(actividad?.gastos_operativos).map(g => ({
        nombre: g.nombre || '',
        monto: g.monto ?? '',
        notas: g.notas || '',
    }));
    const legacyCosto = parseFloat(actividad?.costo_base) || 0;
    if (!gastos.length && legacyCosto > 0) {
        return [{ nombre:'Costo real', monto: legacyCosto, notas:'' }];
    }
    return gastos;
}

export default function ActividadModal({ open, onClose, onSave, actividad, vendedores }) {
    const tk = useTheme();
    const lbl    = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: tk.txt2, fontWeight: 600 };
    const inp    = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${tk.bdr}`, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: tk.inp, color: tk.txt };
    const { user } = useAuth();
    const { config } = useActividadesContext();
    const todosLosTipos = config?.tipos_actividad || TIPOS;
    const rolTipos      = config?.rol_tipos       || ROL_TIPOS;
    const [form,      setForm]      = useState(EMPTY);
    const [expanded,  setExpanded]  = useState(false);
    const [now,       setNow]       = useState(Date.now());
    const [isMobile,  setIsMobile]  = useState(() => window.innerWidth <= 760);
    useEffect(() => {
        if (!open) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [open]);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 760);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const [clientes,  setClientes]  = useState([]);
    const [nuevoC,    setNuevoC]    = useState(false);
    const [clienteQuery,setClienteQuery]= useState('');
    const [formC,     setFormC]     = useState({ nombre:'', ruc:'', email:'', telefono:'' });
    const [savingC,   setSavingC]   = useState(false);
    const [lookingDocC,setLookingDocC]= useState(false);
    const [sunatInfoC,setSunatInfoC]= useState(null);
    const [clienteMsg,setClienteMsg]= useState(null);

    const esMarketing = MARKETING_TIPOS.has(form.tipo);
    const vendedoresFiltrados = esMarketing
        ? vendedores.filter(v => getEffectiveRoles(v).some(r => ['Admin','Marketing'].includes(r)))
        : vendedores;

    const esAdmin = isAdminUser(user);
    const userRoles = getEffectiveRoles(user);
    const puedeEditarFechaInicio = !actividad || esAdmin || actividad.vendedor_id === user?.id;
    const puedeElegirVendedor = esAdmin;
    const puedeAjuste = esAdmin;
    const tiposPermitidos = esAdmin ? todosLosTipos : (userRoles.reduce((acc, rol) => {
        (rolTipos[rol] || []).forEach(t => { if (!acc.includes(t)) acc.push(t); });
        return acc;
    }, []) || todosLosTipos);
    const tiposDisponibles = tiposPermitidos.length > 0 ? tiposPermitidos : todosLosTipos;
    const clientesFiltrados = clientes
        .filter(c => {
            const q = clienteQuery.trim().toLowerCase();
            if (!q) return false;
            return c.nombre.toLowerCase().includes(q) || String(c.ruc || '').includes(q);
        })
        .slice(0, 8);
    const clienteQueryRuc = clienteQuery.replace(/\D/g, '');
    const clienteSeleccionadoExacto = clientes.some(c => c.nombre === form.cliente && c.nombre === clienteQuery);

    useEffect(() => {
        if (open) getClientes().then(setClientes);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                const formEl = document.querySelector('.am-md form');
                if (formEl) formEl.requestSubmit?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (actividad) {
            const fechaInicio = actividad.fecha ? String(actividad.fecha).slice(0,10) : todayInputDate();
            setForm({
                ...EMPTY, ...actividad,
                fecha:             fechaInicio,
                mes:               actividad.mes || MESES[new Date(`${fechaInicio}T12:00:00`).getMonth()],
                fecha_fin:         actividad.fecha_fin         ? String(actividad.fecha_fin).slice(0,10) : '',
                monto:             actividad.monto             ?? '',
                precio_venta:      actividad.precio_venta      ?? '',
                costo_base:        actividad.costo_base        ?? '',
                ajuste_interno:    actividad.ajuste_interno    ?? '',
                gastos_operativos: gastosFromActividad(actividad),
                archivos:          actividad.archivos          ?? [],
                cliente_ruc:       actividad.cliente_ruc       ?? '',
                cliente_email:     actividad.cliente_email     ?? '',
                cliente_telefono:  actividad.cliente_telefono  ?? '',
                colaboradores:     parseArr(actividad.colaboradores),
                checklist:         parseArr(actividad.checklist),
            });
            setClienteQuery(actividad.cliente || '');
            setExpanded(true);
        } else {
            const primerTipo = tiposDisponibles[0] || 'Venta';
            const fechaInicio = todayInputDate();
            setForm({ ...EMPTY, fecha: fechaInicio, mes: MESES[new Date(`${fechaInicio}T12:00:00`).getMonth()], tipo: primerTipo, vendedor_id: user?.id || vendedores[0]?.id || '' });
            setClienteQuery('');
            setExpanded(MARKETING_TIPOS.has(primerTipo));
        }
    }, [open, actividad]);

    if (!open) return null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const resetNuevoCliente = () => {
        setFormC({ nombre:'', ruc:'', email:'', telefono:'' });
        setClienteQuery('');
        setSunatInfoC(null);
        setClienteMsg(null);
    };

    const setClienteRuc = (value) => {
        setFormC(f => ({ ...f, ruc: value.replace(/\D/g, '').slice(0, 11) }));
        setSunatInfoC(null);
        setClienteMsg(null);
    };

    const handleLookupClienteDoc = async () => {
        const doc = String(formC.ruc || clienteQuery || '').replace(/\D/g, '');
        if (!/^\d{8}$/.test(doc) && !/^\d{11}$/.test(doc)) {
            setClienteMsg({ type:'err', text:'Ingresa un DNI de 8 digitos o RUC de 11 digitos.' });
            return;
        }

        setLookingDocC(true);
        setClienteMsg(null);
        try {
            const data = doc.length === 8 ? await lookupDni(doc) : await lookupRuc(doc);
            const documento = data.ruc || data.dni || doc;
            setFormC(f => ({ ...f, ruc: documento, nombre: data.nombre || f.nombre }));
            setClienteQuery(data.nombre || documento);
            setForm(f => ({
                ...f,
                cliente: data.nombre || documento,
                cliente_ruc: documento,
                ...(!actividad ? { nombre: `${f.tipo} - ${data.nombre || documento}` } : {}),
            }));
            setNuevoC(true);
            setSunatInfoC(data);
        } catch (err) {
            setSunatInfoC(null);
            setClienteMsg({ type:'err', text: err.response?.data?.error || 'No se pudo consultar el documento. Intenta nuevamente.' });
        } finally {
            setLookingDocC(false);
        }
    };

    const handleClienteChange = (val) => {
        const cliente = clientes.find(c => c.nombre === val);
        setClienteQuery(val);
        set('cliente', val);
        if (cliente) {
            setForm(f => ({
                ...f,
                cliente: val,
                cliente_ruc: cliente.ruc || '',
                cliente_email: cliente.email || '',
                cliente_telefono: cliente.telefono || '',
            }));
        }
        if (!actividad) set('nombre', `${form.tipo} - ${val}`);
    };
    const handleClienteSearchChange = (val) => {
        setClienteQuery(val);
        const ruc = val.replace(/\D/g, '').slice(0, 11);
        if (ruc) setFormC(f => ({ ...f, ruc }));
        setForm(f => ({
            ...f,
            cliente: val,
            cliente_ruc: '',
            cliente_email: '',
            cliente_telefono: '',
            ...(!actividad ? { nombre: `${f.tipo} - ${val}` } : {}),
        }));
    };

    const handleClienteSearchKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (clientesFiltrados.length === 1) {
            handleClienteChange(clientesFiltrados[0].nombre);
            return;
        }
        if ([8, 11].includes(clienteQueryRuc.length)) handleLookupClienteDoc();
    };

    const handleTipoChange = (tipo) => {
        set('tipo', tipo);
        if (!actividad && form.cliente) set('nombre', `${tipo} - ${form.cliente}`);
        if (MARKETING_TIPOS.has(tipo)) setExpanded(true);
    };
    const handleFechaChange = (val) => {
        const mes = MESES[new Date(val + 'T12:00:00').getMonth()];
        setForm(f => ({ ...f, fecha: val, mes }));
    };

    const soloChecklist = !!actividad && !esAdmin
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
            nombre:           form.nombre || `${form.tipo} - ${form.cliente}`,
            monto:            parseFloat(form.monto)         || 0,
            precio_venta:     parseFloat(form.precio_venta)  || 0,
            costo_base:       0,
            ajuste_interno:   parseFloat(form.ajuste_interno) || 0,
            gastos_operativos: (form.gastos_operativos || [])
                .filter(g => g.nombre || g.notas || parseFloat(g.monto) > 0)
                .map(g => ({
                    nombre: g.nombre, monto: parseFloat(g.monto) || 0, notas: g.notas || '',
                })),
            colaboradores: form.colaboradores || [],
            checklist:     checklistConTs.filter(it => it.texto?.trim()),
            id:      actividad?.id || Date.now(),
            elapsed: actividad?.elapsed || 0,
        });
        onClose();
    };

    const estadosDisponibles = TIPOS_CON_RESULTADO.includes(form.tipo)
        ? ['Pendiente','En Progreso','Completado','Ganada','Perdida']
        : ESTADOS;

    return (
        <div className="am-ovl" style={{
            position: 'fixed', inset: 0, background: 'rgba(20,20,18,0.42)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
        }}>
            <style>{`
                .am-md {
                    --g:#079669; --g2:#036b4c; --gbg:#ecfdf5; --gln:#bfe9d6;
                    --ln:#ebebe7; --ln2:#f1f1ed; --ln3:#e3e3df;
                    --ink:#161614; --ink2:#4a4a45; --ink3:#8a8a82; --ink4:#b6b6ad;
                    --hover:#f6f6f3; --bg:#f7f7f5;
                    --red:#c0392b; --amber:#b8740a; --blue:#2862c8; --gray:#5b5d57;
                }
                [data-theme="dark"] .am-md { --bg:${tk.bg}; --hover:${tk.card2}; --ln:${tk.bdr}; --ln2:${tk.bdr}; --ln3:${tk.bdr}; --ink:${tk.txt}; --ink2:${tk.txt2}; --ink3:${tk.txt3}; --ink4:${tk.txt3}; }
                .am-md .am-h {
                    display:flex; align-items:center; justify-content:space-between; gap:12px;
                    padding:14px 18px;
                    background: linear-gradient(180deg, #ecfdf5 0%, #f3fbf7 100%);
                    border-bottom: 1px solid var(--gln);
                }
                [data-theme="dark"] .am-md .am-h { background: ${tk.card2}; border-bottom-color: ${tk.bdr}; }
                .am-md .am-eyebrow { font-size:10.5px; font-weight:600; color: var(--g2); text-transform:uppercase; letter-spacing:.08em; }
                .am-md .am-title { font-size:17px; font-weight:600; color: var(--ink); letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .am-md .am-gbtn { appearance:none; height:30px; padding:0 11px; font:inherit; font-size:12px; font-weight:500; background:#fff; border:1px solid var(--gln); color: var(--g2); border-radius:7px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
                .am-md .am-gbtn:hover { background: var(--gbg); }
                .am-md .am-x { appearance:none; width:30px; height:30px; background:#fff; border:1px solid var(--ln3); color: var(--ink2); border-radius:7px; cursor:pointer; display:inline-grid; place-items:center; }
                .am-md .am-x:hover { background: var(--hover); color: var(--ink); }
                .am-md .am-tchip {
                    appearance:none;
                    display:grid;
                    grid-template-columns:auto minmax(0, 1fr) auto;
                    align-items:center;
                    gap:8px;
                    min-height:34px;
                    padding:0 10px;
                    font:inherit;
                    font-size:12px;
                    font-weight:500;
                    color: var(--ink2);
                    background:#fff;
                    border:1px solid var(--ln);
                    border-radius:8px;
                    cursor:pointer;
                    text-align:left;
                    box-shadow: 0 1px 2px rgba(20,20,18,.035);
                    transition: border-color .12s, background .12s, color .12s, box-shadow .12s, transform .08s;
                }
                [data-theme="dark"] .am-md .am-tchip {
                    background: rgba(15,23,42,.54);
                    border-color: rgba(92,115,146,.34);
                    color: #c7d2e2;
                    box-shadow: none;
                }
                .am-md .am-tchip:hover {
                    color: var(--ink);
                    border-color: var(--type-color, var(--ln3));
                    background: var(--type-soft, var(--hover));
                    transform: translateY(-1px);
                }
                [data-theme="dark"] .am-md .am-tchip:hover {
                    color: #eef5ff;
                    background: var(--type-soft, rgba(148,163,184,.10));
                }
                .am-md .am-tchip.on {
                    color: var(--type-color, var(--g2));
                    background: linear-gradient(180deg, #fff 0%, var(--type-soft, var(--gbg)) 100%);
                    border-color: var(--type-color, var(--g));
                    box-shadow: 0 0 0 3px var(--type-ring, rgba(7,150,105,.10)), 0 3px 8px rgba(20,20,18,.05);
                }
                [data-theme="dark"] .am-md .am-tchip.on {
                    color: #f8fbff;
                    background: linear-gradient(180deg, rgba(30,41,59,.76) 0%, var(--type-soft, rgba(16,185,129,.16)) 100%);
                    box-shadow: 0 0 0 1px var(--type-color, var(--g)) inset, 0 0 0 3px var(--type-ring, rgba(16,185,129,.12));
                }
                .am-md .am-tchip-mark {
                    width:8px;
                    height:8px;
                    border-radius:999px;
                    background: var(--type-color, var(--g));
                    box-shadow: 0 0 0 3px var(--type-soft, rgba(7,150,105,.10));
                }
                .am-md .am-tchip-label {
                    min-width:0;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                }
                .am-md .am-tchip-check {
                    width:16px;
                    height:16px;
                    display:grid;
                    place-items:center;
                    border-radius:999px;
                    color:#fff;
                    background: var(--type-color, var(--g));
                    opacity:0;
                    transform: scale(.82);
                    transition: opacity .12s, transform .12s;
                }
                .am-md .am-tchip.on .am-tchip-check {
                    opacity:1;
                    transform: scale(1);
                }
                .am-md .am-seg {
                    display:grid; grid-auto-flow:column; grid-auto-columns:1fr;
                    background: var(--bg); border:1px solid var(--ln);
                    border-radius:8px; padding:3px; gap:2px;
                }
                .am-md .am-seg button {
                    appearance:none; border:none; background:transparent;
                    height:28px; font:inherit; font-size:12px; font-weight:500; color: var(--ink2);
                    border-radius:6px; cursor:pointer;
                    display:inline-flex; align-items:center; justify-content:center; gap:5px;
                }
                .am-md .am-seg button:hover { color: var(--ink); }
                .am-md .am-seg button.on { background:#fff; box-shadow: 0 0 0 1px var(--ln3), 0 1px 2px rgba(0,0,0,.04); color: var(--ink); }
                .am-md .am-seg button .pd { width:6px; height:6px; border-radius:50%; }
                .am-md .am-seg button.on[data-p="Alta"]  { color:#8a201a; box-shadow:0 0 0 1px #f0c6c1, 0 1px 2px rgba(192,57,43,.08); }
                .am-md .am-seg button.on[data-p="Alta"]  .pd { background: var(--red); }
                .am-md .am-seg button.on[data-p="Media"] { color:#7a4d05; box-shadow:0 0 0 1px #ecd6b1, 0 1px 2px rgba(184,116,10,.08); }
                .am-md .am-seg button.on[data-p="Media"] .pd { background: var(--amber); }
                .am-md .am-seg button.on[data-p="Baja"]  { color: var(--g2); box-shadow:0 0 0 1px var(--gln), 0 1px 2px rgba(7,150,105,.08); }
                .am-md .am-seg button.on[data-p="Baja"]  .pd { background: var(--g); }
                .am-md .am-seg button.on[data-s="Pendiente"]    { color: var(--gray); box-shadow:0 0 0 1px var(--ln3); }
                .am-md .am-seg button.on[data-s="Pendiente"]    .pd { background: var(--gray); }
                .am-md .am-seg button.on[data-s="En Progreso"]  { color: var(--blue); box-shadow:0 0 0 1px #cfdcf5; }
                .am-md .am-seg button.on[data-s="En Progreso"]  .pd { background: var(--blue); }
                .am-md .am-seg button.on[data-s="Completado"]   { color: var(--g2); box-shadow:0 0 0 1px var(--gln); }
                .am-md .am-seg button.on[data-s="Completado"]   .pd { background: var(--g); }
                .am-md .am-seg button.on[data-s="Ganada"]       { color: var(--g2); box-shadow:0 0 0 1px var(--gln); }
                .am-md .am-seg button.on[data-s="Ganada"]       .pd { background: var(--g); }
                .am-md .am-seg button.on[data-s="Perdida"]      { color: var(--red); box-shadow:0 0 0 1px #f0c6c1; }
                .am-md .am-seg button.on[data-s="Perdida"]      .pd { background: var(--red); }
                .am-md .am-form-scroll {
                    flex:1;
                    min-height:0;
                    overflow-y:auto;
                    overflow-x:hidden;
                    scrollbar-gutter:stable;
                    padding:20px 24px 24px;
                }
                .am-md .am-form-scroll::-webkit-scrollbar {
                    width:10px;
                }
                .am-md .am-form-scroll::-webkit-scrollbar-track {
                    background:transparent;
                }
                .am-md .am-form-scroll::-webkit-scrollbar-thumb {
                    background:#c8c9c2;
                    border:3px solid transparent;
                    border-radius:999px;
                    background-clip:content-box;
                }
                .am-md .am-form-scroll::-webkit-scrollbar-thumb:hover {
                    background:#a9aba3;
                    border:3px solid transparent;
                    background-clip:content-box;
                }
                [data-theme="dark"] .am-md .am-form-scroll::-webkit-scrollbar-thumb {
                    background:#53657d;
                    border:3px solid transparent;
                    background-clip:content-box;
                }
                [data-theme="dark"] .am-md .am-form-scroll::-webkit-scrollbar-thumb:hover {
                    background:#71839c;
                    border:3px solid transparent;
                    background-clip:content-box;
                }
                .am-md .am-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 18px; background:#fbfbf8; border-top:1px solid var(--ln); }
                [data-theme="dark"] .am-md .am-foot { background: ${tk.card2}; border-top-color: ${tk.bdr}; }
                .am-md .am-hint { font-size:11.5px; color: var(--ink3); }
                .am-md .am-hint kbd { font-family:inherit; font-size:10.5px; font-weight:600; color: var(--ink2); padding:1px 5px; background:#fff; border:1px solid var(--ln3); border-bottom-width:2px; border-radius:4px; margin:0 1px; }
                .am-md .am-cancel { appearance:none; height:34px; padding:0 14px; font:inherit; font-size:12.5px; font-weight:500; color: var(--ink2); background:#fff; border:1px solid var(--ln3); border-radius:8px; cursor:pointer; white-space:nowrap; }
                .am-md .am-cancel:hover { background: var(--hover); color: var(--ink); }
                .am-md .am-create { appearance:none; position:relative; height:34px; padding:0 14px; font:inherit; font-size:12.5px; font-weight:600; color:#fff; background: linear-gradient(180deg, #0aaa78 0%, #058256 100%); border:1px solid #036445; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 -1px 0 rgba(0,0,0,.12) inset, 0 4px 10px -3px rgba(7,150,105,.45); transition: filter .15s, transform .08s; white-space:nowrap; }
                .am-md .am-create:hover { filter: brightness(1.04); }
                .am-md .am-create:active { transform: translateY(1px); }
            `}</style>
            <div onClick={e => e.stopPropagation()} className="card am-md" style={{
                borderRadius: 12,
                width: isMobile ? '96vw' : (expanded ? 960 : 520),
                maxWidth: '96vw',
                maxHeight: 'calc(100vh - 48px)', overflow: 'hidden',
                boxShadow: '0 24px 64px -12px rgba(20,20,18,.28), 0 4px 12px rgba(20,20,18,.08)',
                display: 'flex', flexDirection: 'column',
                transition: 'width 0.2s ease',
                border: `1px solid ${tk.bdr}`,
            }}>
                {/* Header v2 */}
                <div className="am-h">
                    <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                        <div className="am-eyebrow">
                            {actividad ? 'Editar actividad' : 'Nueva actividad'}
                        </div>
                        <div className="am-title">
                            {form.nombre || (form.cliente ? `${form.tipo} - ${form.cliente}` : form.tipo)}
                        </div>
                    </div>
                    <div style={{ display:'inline-flex', gap:6 }}>
                        <button type="button" onClick={() => setExpanded(x => !x)} className="am-gbtn">
                            {expanded ? 'v Menos' : '> Mas'}
                        </button>
                        <button type="button" onClick={onClose} className="am-x" aria-label="Cerrar">
                            <svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 2l6 6M8 2l-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </button>
                    </div>
                </div>

                <form className="am-form-scroll" onSubmit={handleSubmit}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: expanded && !isMobile ? '1fr 1fr' : '1fr',
                        gap: expanded && !isMobile ? 28 : 0,
                        alignItems: 'start',
                    }}>

                        {/*  Columna izquierda - campos principales  */}
                        <div style={{ display: 'grid', gap: 16 }}>

                            {/* Tipos */}
                            <div>
                                <div style={lbl}>Tipo de actividad</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 8, marginTop: 8 }}>
                                    {tiposDisponibles.map(t => {
                                        const tc = getTypeColor(t);
                                        const active = form.tipo === t;
                                        return (
                                            <button key={t} type="button" onClick={() => handleTipoChange(t)} className={`am-tchip ${active ? 'on' : ''}`} style={{
                                                '--type-color': tc.color,
                                                '--type-soft': tk.isDark ? `${tc.color}${active ? '28' : '18'}` : `${tc.color}${active ? '14' : '0d'}`,
                                                '--type-ring': `${tc.color}22`,
                                            }}>
                                                <span className="am-tchip-mark" />
                                                <span className="am-tchip-label">{t}</span>
                                                <span className="am-tchip-check" aria-hidden="true">
                                                    <svg viewBox="0 0 12 12" width="10" height="10">
                                                        <path d="M3 6.1l2 2L9.2 3.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cliente o Area (si Marketing) */}
                            <div>
                                <div style={{ ...lbl, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                                    <span>{esMarketing ? 'Area *' : 'Cliente *'}</span>
                                    {!esMarketing && (
                                        <button type="button" onClick={() => { setNuevoC(x => !x); resetNuevoCliente(); }}
                                            style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:6, border:`1px solid ${'#10b981'}`, background: nuevoC ? '#10b981' : '#10b98118', color: nuevoC ? '#fff' : '#10b981', cursor:'pointer' }}>
                                            {nuevoC ? 'Cancelar' : '+ Nuevo'}
                                        </button>
                                    )}
                                </div>
                                {esMarketing ? (
                                    <select style={inp} required value={form.cliente} onChange={e => handleClienteChange(e.target.value)}>
                                        <option value="">- Seleccionar area -</option>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                ) : (
                                    <>
                                    <div style={{ position:'relative' }}>
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                                            <input
                                                style={inp}
                                                required
                                                placeholder="Buscar por nombre, DNI o RUC..."
                                                value={clienteQuery}
                                                onChange={e => handleClienteSearchChange(e.target.value)}
                                                onKeyDown={handleClienteSearchKeyDown}
                                                onBlur={() => setTimeout(() => setClienteQuery(form.cliente || clienteQuery), 120)}
                                            />
                                            <button type="button" disabled={lookingDocC || ![8, 11].includes(clienteQueryRuc.length)} onMouseDown={e => e.preventDefault()} onClick={handleLookupClienteDoc}
                                                title="Buscar documento en SUNAT"
                                                style={{ padding:'9px 12px', borderRadius:8, border:'none', background: lookingDocC || ![8, 11].includes(clienteQueryRuc.length) ? '#a0b8e8' : '#1e88e5', color:'#fff', fontWeight:700, fontSize:12, cursor: lookingDocC || ![8, 11].includes(clienteQueryRuc.length) ? 'default' : 'pointer' }}>
                                                {lookingDocC ? '...' : 'SUNAT'}
                                            </button>
                                        </div>
                                        {clienteQuery.trim() && !clienteSeleccionadoExacto && clientesFiltrados.length > 0 && (
                                            <div style={{ position:'absolute', zIndex:20, top:'calc(100% + 4px)', left:0, right:0, background:tk.card, border:`1px solid ${tk.bdr}`, borderRadius:8, boxShadow:tk.shadow, overflow:'hidden' }}>
                                                {clientesFiltrados.map(c => (
                                                    <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleClienteChange(c.nombre)}
                                                        style={{ width:'100%', border:'none', background:'transparent', color:tk.txt, textAlign:'left', padding:'9px 11px', cursor:'pointer', display:'block' }}>
                                                        <div style={{ fontSize:12, fontWeight:700 }}>{c.nombre}</div>
                                                        <div style={{ fontSize:10, color:tk.txt3 }}>{c.ruc ? `${docLabel(c.ruc)}: ${c.ruc}` : c.email || 'Sin contacto'}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {[8, 11].includes(clienteQueryRuc.length) && !clienteSeleccionadoExacto && clientesFiltrados.length === 0 && (
                                            <div style={{ position:'absolute', zIndex:20, top:'calc(100% + 4px)', left:0, right:0, background:tk.card, border:`1px solid ${tk.bdr}`, borderRadius:8, boxShadow:tk.shadow, overflow:'hidden' }}>
                                                <button type="button" disabled={lookingDocC} onMouseDown={e => e.preventDefault()} onClick={handleLookupClienteDoc}
                                                    style={{ width:'100%', border:'none', background:'transparent', color:tk.txt, textAlign:'left', padding:'10px 11px', cursor: lookingDocC ? 'default' : 'pointer', display:'block' }}>
                                                    <div style={{ fontSize:12, fontWeight:700 }}>{lookingDocC ? 'Buscando en SUNAT...' : `Buscar ${docLabel(clienteQueryRuc)} ${clienteQueryRuc} en SUNAT`}</div>
                                                    <div style={{ fontSize:10, color:tk.txt3 }}>Si existe, se llenara el nuevo cliente para crearlo.</div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Legacy select removed; client search above replaces it. */}
                                    {false && <select style={inp} required value={form.cliente} onChange={e => handleClienteChange(e.target.value)}>
                                        <option value="">Seleccionar cliente</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}{c.ruc ? ` - ${docLabel(c.ruc)} ${c.ruc}` : ''}</option>
                                        ))}
                                    </select>}
                                    </>
                                )}
                                {!esMarketing && nuevoC && (
                                    <div style={{ marginTop:10, padding:'14px', background:tk.card2, borderRadius:10, border:`1px solid ${tk.bdr}`, display:'grid', gap:8 }}>
                                        <div style={{ fontSize:11, fontWeight:700, color:tk.txt2, marginBottom:2 }}>Nuevo cliente</div>
                                        <input style={inp} placeholder="Nombre *" required value={formC.nombre}
                                            onChange={e => setFormC(f => ({ ...f, nombre: e.target.value }))} />
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                                            <input style={inp} inputMode="numeric" maxLength={11} placeholder="DNI o RUC" value={formC.ruc}
                                                onChange={e => setClienteRuc(e.target.value)} />
                                            <button type="button" disabled={lookingDocC || ![8, 11].includes(String(formC.ruc || '').replace(/\D/g, '').length)} onClick={handleLookupClienteDoc}
                                                style={{ padding:'8px 12px', borderRadius:8, border:'none', background: lookingDocC || ![8, 11].includes(String(formC.ruc || '').replace(/\D/g, '').length) ? '#a0b8e8' : '#1e88e5', color:'#fff', fontWeight:700, fontSize:12, cursor: lookingDocC || ![8, 11].includes(String(formC.ruc || '').replace(/\D/g, '').length) ? 'default' : 'pointer' }}>
                                                {lookingDocC ? 'Buscando...' : 'Buscar'}
                                            </button>
                                            <input style={inp} placeholder="Telefono" value={formC.telefono}
                                                onChange={e => setFormC(f => ({ ...f, telefono: e.target.value }))} />
                                        </div>
                                        {sunatInfoC && (
                                            <div style={{ padding:'8px 10px', borderRadius:8, background:tk.card, border:`1px solid ${tk.bdr}`, color:tk.txt2, fontSize:11 }}>
                                                {sunatInfoC.dni ? 'DNI' : 'SUNAT'}: <strong style={{ color:tk.txt }}>{sunatInfoC.dni ? sunatInfoC.nombre : `${sunatInfoC.estado || 'Sin estado'} / ${sunatInfoC.condicion || 'Sin condicion'}`}</strong>
                                            </div>
                                        )}
                                        {clienteMsg && (
                                            <div style={{ padding:'8px 10px', borderRadius:8, background: clienteMsg.type === 'err' ? '#fff0f0' : '#e8f8ee', border:`1px solid ${clienteMsg.type === 'err' ? '#fcc' : '#a8ddb8'}`, color: clienteMsg.type === 'err' ? '#c0392b' : '#1a7a3c', fontSize:11 }}>
                                                {clienteMsg.text}
                                            </div>
                                        )}
                                        <input style={inp} placeholder="Email" type="email" value={formC.email}
                                            onChange={e => setFormC(f => ({ ...f, email: e.target.value }))} />
                                        <button type="button" disabled={savingC || !formC.nombre.trim()}
                                            onClick={async () => {
                                                if (!formC.nombre.trim()) return;
                                                setSavingC(true);
                                                try {
                                                    const nuevo = await createCliente(formC);
                                                    setClientes(cs => {
                                                        const exists = cs.some(c => c.id === nuevo.id);
                                                        const next = exists ? cs : [...cs, nuevo];
                                                        return next.sort((a,b) => a.nombre.localeCompare(b.nombre));
                                                    });
                                                    handleClienteChange(nuevo.nombre);
                                                    setForm(f => ({
                                                        ...f,
                                                        cliente: nuevo.nombre,
                                                        cliente_ruc: nuevo.ruc || '',
                                                        cliente_email: nuevo.email || '',
                                                        cliente_telefono: nuevo.telefono || '',
                                                    }));
                                                    if (nuevo.reused) setClienteMsg({ type:'ok', text:'El DNI o RUC ya existia. Se selecciono el cliente registrado.' });
                                                    setNuevoC(false);
                                                } catch (err) {
                                                    setClienteMsg({ type:'err', text: err.response?.data?.error || 'Error al crear cliente.' });
                                                } finally {
                                                    setSavingC(false);
                                                }
                                            }}
                                            style={{ padding:'8px', borderRadius:8, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity: savingC ? 0.6 : 1 }}>
                                            {savingC ? 'Guardando...' : 'Crear cliente'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Vendedor + Monto */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 150px', gap: 12 }}>
                                <label style={lbl}>Vendedor *
                                    <select style={{ ...inp, background: tk.inp, color: puedeElegirVendedor ? tk.txt : tk.txt2 }}
                                        required value={form.vendedor_id} disabled={!puedeElegirVendedor}
                                        onChange={e => set('vendedor_id', e.target.value)}>
                                        <option value="">- Seleccionar -</option>
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

                            {/* Botones - siempre en columna izquierda */}
                            <div className="am-foot" style={{ margin: '14px -24px -20px', borderRadius: '0 0 12px 12px' }}>
                                <div className="am-hint">
                                    <kbd>Ctrl</kbd>+<kbd>Enter</kbd> para {actividad ? 'guardar' : 'crear'}
                                </div>
                                <div style={{ display:'inline-flex', gap: 8 }}>
                                    <button type="submit" className="am-create">
                                        <svg viewBox="0 0 10 10" width="10" height="10"><path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                                        {actividad ? 'Guardar cambios' : 'Crear actividad'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/*  Columna derecha - mas opciones (solo cuando expandido)  */}
                        {expanded && (
                            <div style={{ display: 'grid', gap: 16, borderLeft: isMobile ? 'none' : `1px solid ${tk.bdr}`, paddingLeft: isMobile ? 0 : 28, marginTop:isMobile ? 18 : 0 }}>

                                {/* Nombre */}
                                <label style={lbl}>Nombre
                                    <input style={inp} placeholder={`${form.tipo} - ${form.cliente || '...'}`}
                                        value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                                </label>

                                {/* Prioridad */}
                                <div>
                                    <div style={lbl}>Prioridad</div>
                                    <div className="am-seg" style={{ marginTop: 6 }}>
                                        {PRIORIDADES.map(p => {
                                            const active = form.prioridad === p;
                                            return (
                                                <button key={p} type="button" data-p={p}
                                                        className={active ? 'on' : ''}
                                                        onClick={() => set('prioridad', p)}>
                                                    <span className="pd" />{p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Estado */}
                                <div>
                                    <div style={lbl}>Estado</div>
                                    <div className="am-seg" style={{ marginTop: 6 }}>
                                        {estadosDisponibles.map(s => {
                                            const active = form.estado === s;
                                            return (
                                                <button key={s} type="button" data-s={s}
                                                        className={active ? 'on' : ''}
                                                        onClick={() => set('estado', s)}>
                                                    <span className="pd" />{s}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {TIPOS_CON_RESULTADO.includes(form.tipo) && (
                                        <div style={{ fontSize: 10, color: tk.txt3, marginTop: 5 }}>{'Ganada -> aparece en Comisiones'}</div>
                                    )}
                                </div>

                                {/* Fechas */}
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                                    <label style={lbl}>Fecha de inicio
                                        <input style={(!actividad || puedeEditarFechaInicio) ? inp : { ...inp, background: tk.card2, color: tk.txt2 }}
                                            type="date" value={form.fecha}
                                            readOnly={!!actividad && !puedeEditarFechaInicio}
                                            onChange={e => (!actividad || puedeEditarFechaInicio) && handleFechaChange(e.target.value)} />
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
                                                }}>{v.nombre}</button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Checklist */}
                                <div>
                                    <div style={{ ...lbl, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <span>Checklist</span>
                                        {!soloChecklist && (
                                            <button type="button" onClick={addChkItem} style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6, border:'1px dashed #10b981', background:'#10b98118', color:'#10b981', cursor:'pointer' }}>+ Item</button>
                                        )}
                                    </div>
                                    <div style={{ display:'grid', gap:6, marginTop:6 }}>
                                        {(form.checklist || []).length === 0 && (
                                            <div style={{ fontSize:11, color:tk.txt3 }}>Sin items.</div>
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
                                                        <option value="">- Sin asignar -</option>
                                                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                                    </select>
                                                    <span title={created ? `Creado ${new Date(created).toLocaleString('es-PE')}` : 'Sin iniciar'}
                                                        style={{ fontFamily:'monospace', fontSize:11, textAlign:'center', color: it.hecho ? '#27ae60' : tk.txt2 }}>
                                                        {created ? fmtDur(elapsed) : '-'}
                                                    </span>
                                                    {!soloChecklist ? (
                                                        <button type="button" onClick={() => removeChkItem(it.id)} style={{ background:'#e74c3c22', border:'none', borderRadius:6, cursor:'pointer', color:'#e74c3c', fontWeight:700 }}>x</button>
                                                    ) : <span />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Notas */}
                                <label style={lbl}>Notas
                                    <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }}
                                        placeholder="Observaciones, acuerdos, proximos pasos..."
                                        value={form.notas} onChange={e => set('notas', e.target.value)} />
                                </label>

                                {/* Adjuntos - solo actividades existentes */}
                                <div>
                                    <div style={{ ...lbl, marginBottom: 8 }}>Archivos adjuntos</div>
                                    {actividad ? (
                                        <>
                                            {(form.archivos || []).map((a, i) => (
                                                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, padding:'6px 10px', background: tk.card2, borderRadius:7 }}>
                                                    <span style={{ display:'inline-grid', placeItems:'center', color:tk.txt2 }}>
                                                        {a.tipo?.includes('pdf')
                                                            ? <FileIcon size={14} />
                                                            : a.tipo?.includes('image') ? <ImageIcon size={14} /> : <PaperclipIcon size={14} />}
                                                    </span>
                                                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flex:1, fontSize:12, color:'#10b981', textDecoration:'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.nombre}</a>
                                                    <button type="button" onClick={async () => {
                                                        await deleteArchivoActividad(actividad.id, a.url);
                                                        set('archivos', form.archivos.filter((_, idx) => idx !== i));
                                                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', fontSize:14, flexShrink:0 }}>x</button>
                                                </div>
                                            ))}
                                            <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#10b98120', color:'#10b981', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px dashed #10b98180', marginTop:4 }}>
                                                <PaperclipIcon size={14} /> Adjuntar archivo
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
