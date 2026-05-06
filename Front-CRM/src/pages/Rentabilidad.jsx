import { useState, useMemo, useEffect } from 'react';
import Avatar from '../components/Avatar';
import { useTheme } from '../context/ThemeContext';
import PeriodoPicker from '../components/PeriodoPicker';
import { filterActs, parseGastos } from '../utils/crm';
import useActividades from '../hooks/useActividades';
import useSocket from '../hooks/useSocket';
import useRolFilter from '../hooks/useRolFilter';
import { useAuth } from '../context/AuthContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { getVendedores, updateVendedorMetas } from '../api/actividades';

// ── Configuración ──────────────────────────────────────────────────────────────
const COMISION_BASE  = 'rentabilidad'; // 'facturacion' | 'rentabilidad'
const MARGEN_MINIMO  = 2;             // %
const MARGEN_MEDIO   = 15;            // %
const MARGEN_ALTO    = 20;            // %
const PCT_BASE       = 0.02;
const PCT_BAJO       = 0.07;
const PCT_ALTO       = 0.08;
// ──────────────────────────────────────────────────────────────────────────────

function calcComision(facturacion, costoBase, sunat = 0, gastos = 0, pctBase = PCT_BASE, pctBajo = PCT_BAJO, pctAlto = PCT_ALTO, base = COMISION_BASE) {
    const rentabilidad_bruta = facturacion - costoBase;
    const rentabilidad   = rentabilidad_bruta - sunat - gastos;
    const margen_pct     = facturacion > 0 ? (rentabilidad / facturacion) * 100 : 0;

    let estado, pct_comision = 0, mensaje = '';

    if (rentabilidad < 0) {
        estado  = 'perdida';
        mensaje = 'Trabajó con pérdida, no aplica comisión';
    } else if (margen_pct < MARGEN_MINIMO) {
        estado  = 'no_margen';
        mensaje = `Sin comisión por no alcanzar el ${MARGEN_MINIMO}% de margen`;
    } else if (margen_pct < MARGEN_MEDIO) {
        estado         = 'cumple_2';
        pct_comision   = pctBase;
        mensaje        = `Comision del ${(pctBase * 100).toFixed(0)}% por margen entre ${MARGEN_MINIMO}% y ${MARGEN_MEDIO - 1}%`;
    } else if (margen_pct < MARGEN_ALTO) {
        estado         = 'cumple_7';
        pct_comision   = pctBajo;
        mensaje        = `Comisión del ${(pctBajo * 100).toFixed(0)}% por cumplir cuota y margen mínimo`;
    } else {
        estado         = 'cumple_8';
        pct_comision   = pctAlto;
        mensaje        = `Comisión del ${(pctAlto * 100).toFixed(0)}% por superar el ${MARGEN_ALTO}% de margen`;
    }

    const base_valor     = base === 'facturacion' ? facturacion : Math.max(0, rentabilidad);
    const monto_comision = base_valor * pct_comision;

    return {
        rentabilidad_bruta,
        utilidad_bruta: rentabilidad_bruta,
        rentabilidad,
        utilidad: rentabilidad,
        margen_pct,
        estado,
        pct_comision,
        monto_comision,
        mensaje,
        base_valor,
    };
}

const ESTADO_LABEL = {
    perdida:   'Trabajó con pérdida',
    no_cuota:  'No cumple cuota',
    no_margen: 'Cumple cuota pero no margen',
    cumple_2:  'Comision base',
    cumple_7:  'Cumple cuota y margen',
    cumple_8:  'Cumple cuota y margen',
};
const ESTADO_COLOR = {
    perdida:   '#e74c3c',
    no_cuota:  '#e67e22',
    no_margen: '#d4ac0d',
    cumple_2:  '#3498db',
    cumple_7:  '#27ae60',
    cumple_8:  '#1e8449',
};

const USD2 = n => new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
}).format(n || 0);

const PCT  = n => `${n.toFixed(2)}%`;
const ESTADOS_VENTA_CERRADA = new Set(['Ganada']);
function tramoComisionLabel(calc) {
    if (!calc?.pct_comision) return '0%';
    if (calc.margen_pct < MARGEN_MEDIO) return `${(calc.pct_comision * 100).toFixed(0)}% (margen ${MARGEN_MINIMO}-${MARGEN_MEDIO - 1}%)`;
    if (calc.margen_pct < MARGEN_ALTO) return `${(calc.pct_comision * 100).toFixed(0)}% (margen ${MARGEN_MEDIO}-${MARGEN_ALTO - 1}%)`;
    return `${(calc.pct_comision * 100).toFixed(0)}% (margen ${MARGEN_ALTO}%+)`;
}

// ── Test cases estáticos ───────────────────────────────────────────────────────
const CASOS = [
    { label: 'Pérdida',     facturacion: 20000, costo: 20500, gastos: 100 },
    { label: 'Sin margen',  facturacion: 20000, costo: 19300, gastos: 150 },
    { label: 'Comisión 2%', facturacion: 20000, costo: 18000, gastos: 100 },
    { label: 'Comisión 7%', facturacion: 20000, costo: 15500, gastos: 150 },
    { label: 'Comisión 8%', facturacion: 20000, costo: 13500, gastos: 250 },
];

export default function Rentabilidad() {
    const tk     = useTheme();
    const socket = useSocket();
    const { actividades, loading } = useActividades(socket);
    const vendedorForzado = useRolFilter();
    const { user } = useAuth();

    const esAdminGerencia = user?.is_superadmin || user?.roles?.some(r => ['Admin','Gerencia'].includes(r));
    const { config } = useActividadesContext();
    const tasa_sunat = parseFloat(config?.tasa_sunat) || 0;

    const sel = { padding:'8px 12px', borderRadius:8, border:`1px solid ${tk.bdr}`, fontSize:13, color:tk.txt, background:tk.card, cursor:'pointer', outline:'none' };
    const lbl = { display:'flex', flexDirection:'column', gap:5, fontSize:12, color:tk.txt2, fontWeight:600 };
    const inp = { padding:'8px 10px', borderRadius:7, border:`1px solid ${tk.bdr}`, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', background:tk.inp, color:tk.txt };

    const [mes,        setMes]        = useState('');
    const [trimestre,  setTrimestre]  = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [vendedoresData, setVendedoresData] = useState([]);
    const [editingId,  setEditingId]  = useState(null);
    const [metaEdit,   setMetaEdit]   = useState({ meta_mensual: 0, umbral_comision: 0 });
    const [casosOpen,  setCasosOpen]  = useState(false);

    useEffect(() => { getVendedores().then(setVendedoresData); }, []);

    const ventas = useMemo(() => filterActs(actividades, {
        mes, trimestre,
        vendedorId: vendedorForzado || vendedorId,
    }).filter(a => ESTADOS_VENTA_CERRADA.has(a.estado)),
    [actividades, mes, trimestre, vendedorId, vendedorForzado]);

    // Agrupado por vendedor — incluye SUNAT y desglose por actividad
    const porVendedor = useMemo(() => {
        const map = {};
        ventas.forEach(a => {
            const fact       = parseFloat(a.precio_venta) || parseFloat(a.monto) || 0;
            const costoBase  = parseFloat(a.costo_base) || 0;
            const gastosAct  = parseGastos(a.gastos_operativos).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
            const rentabilidadBrutaAct = fact - costoBase;
            const sunatAct   = rentabilidadBrutaAct * tasa_sunat;
            const rentabilidadAct = rentabilidadBrutaAct - sunatAct - gastosAct;
            const costoTotal = costoBase + gastosAct + sunatAct;

            if (!map[a.vendedor_id]) map[a.vendedor_id] = {
                id: a.vendedor_id, nombre: a.vendedor_nombre,
                color: a.color, iniciales: a.iniciales, foto_url: a.foto_url,
                facturacion: 0, costoBase: 0, gastos: 0, sunat: 0, costo: 0,
                actividades: [],
            };
            const row = map[a.vendedor_id];
            row.facturacion += fact;
            row.costoBase   += costoBase;
            row.gastos      += gastosAct;
            row.sunat       += sunatAct;
            row.costo       += costoTotal;
            row.actividades.push({ ...a, _fact: fact, _costoBase: costoBase, _gastos: gastosAct, _sunat: sunatAct, _rentabilidadBruta: rentabilidadBrutaAct, _utilidadBruta: rentabilidadBrutaAct, _util: rentabilidadAct, _costoTotal: costoTotal });
        });
        return Object.values(map).sort((a, b) => b.facturacion - a.facturacion);
    }, [ventas, tasa_sunat]);

    const handleSaveMeta = async (id) => {
        const vd = vendedoresData.find(v => v.id === id);
        const updated = await updateVendedorMetas(id, {
            ...metaEdit,
            umbral_comision:   vd?.umbral_comision   ?? 0,
            pct_comision_base: vd?.pct_comision_base ?? 0.02,
            pct_comision_bajo: vd?.pct_comision_bajo ?? 0.07,
            pct_comision_alto: vd?.pct_comision_alto ?? 0.08,
        });
        setVendedoresData(prev => prev.map(v => v.id === id ? { ...v, ...updated } : v));
        setEditingId(null);
    };

    const allVendedores = useMemo(() => {
        const seen = {};
        actividades.forEach(a => { if (!seen[a.vendedor_id]) seen[a.vendedor_id] = a.vendedor_nombre; });
        return Object.entries(seen).map(([id, nombre]) => ({ id, nombre }));
    }, [actividades]);

    if (loading) return <div style={{ color:'#6b7a8d', fontSize:14 }}>Cargando...</div>;

    return (
        <div style={{ display:'grid', gap:24 }}>

            {/* Filtros */}
            <div style={{ display:'flex', justifyContent:'center', gap:8, alignItems:'center' }}>
                <PeriodoPicker trim={trimestre} mes={mes} onTrim={setTrimestre} onMes={setMes} />
                {!vendedorForzado && (
                    <select style={sel} value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                        <option value="">Todos los vendedores</option>
                        {allVendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                )}
            </div>

            {/* Sin datos */}
            {porVendedor.length === 0 && (
                <div style={{ background:tk.card, borderRadius:12, padding:40, textAlign:'center', color:tk.txt3, boxShadow:tk.shadow }}>
                    Sin ventas con datos de rentabilidad para el período seleccionado.
                </div>
            )}

            {/* Tarjetas por vendedor */}
            {porVendedor.map(v => {
                const vData      = vendedoresData.find(x => x.id === v.id);
                const cuota      = vData?.meta_mensual ?? 0;
                const pctBase    = parseFloat(vData?.pct_comision_base) || PCT_BASE;
                const pctBajo    = parseFloat(vData?.pct_comision_bajo) || PCT_BAJO;
                const pctAlto    = parseFloat(vData?.pct_comision_alto) || PCT_ALTO;
                const calc       = calcComision(v.facturacion, v.costoBase, v.sunat, v.gastos, pctBase, pctBajo, pctAlto);
                const ec         = ESTADO_COLOR[calc.estado];
                const isEditing  = editingId === v.id;
                const rentabilidadBrutaTotal = v.facturacion - v.costoBase;
                const metaPct    = cuota > 0 ? Math.min((rentabilidadBrutaTotal / cuota) * 100, 100) : 0;
                const metaHit    = cuota > 0 && rentabilidadBrutaTotal >= cuota;
                const ventasDetalle = v.actividades.map((a) => ({
                    ...a,
                    calc: calcComision(a._fact, a._costoBase, a._sunat, a._gastos, pctBase, pctBajo, pctAlto),
                }));
                const comisionTotalSuma = ventasDetalle.reduce((sum, venta) => sum + venta.calc.monto_comision, 0);

                return (
                    <div key={v.id}>
                        {/* Cabecera del vendedor */}
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                            <Avatar vendedor={v} size="lg" />
                            <div style={{ flex:1 }}>
                                <div style={{ fontSize:16, fontWeight:800, color:tk.txt }}>{v.nombre}</div>
                                <div style={{ fontSize:11, color:tk.txt3 }}>{ventas.filter(a => a.vendedor_id === v.id).length} venta(s) en el período</div>
                            </div>
                            {esAdminGerencia && (
                                <button
                                    onClick={() => { setEditingId(isEditing ? null : v.id); setMetaEdit({ meta_mensual: cuota, umbral_comision: vData?.umbral_comision ?? 0 }); }}
                                    style={{ border:`1px solid ${tk.bdr}`, background: isEditing ? '#e74c3c22' : tk.card2, cursor:'pointer', fontSize:12, color: isEditing ? '#e74c3c' : tk.txt2, padding:'5px 12px', borderRadius:7, fontWeight:600 }}>
                                    {isEditing ? '✕ Cancelar' : '✏ Editar cuota'}
                                </button>
                            )}
                        </div>

                        {/* Edit cuota inline */}
                        {isEditing && esAdminGerencia && (
                            <div style={{ background:tk.card2, borderRadius:10, padding:14, marginBottom:12, display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'end' }}>
                                <label style={lbl}>Cuota de Rentabilidad Bruta mensual (USD)
                                    <input style={inp} type="number" min="0" value={metaEdit.meta_mensual}
                                        onChange={e => setMetaEdit(m => ({ ...m, meta_mensual: parseFloat(e.target.value) || 0 }))} />
                                </label>
                                <button onClick={() => handleSaveMeta(v.id)}
                                    style={{ padding:'9px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                                    Guardar
                                </button>
                            </div>
                        )}

                        {/* Dos cuadros */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

                            {/* CUADRO 1 — meta de rentabilidad bruta */}
                            <div style={{ background:tk.card, borderRadius:12, boxShadow:tk.shadow, overflow:'hidden', borderTop:`3px solid ${ec}` }}>
                                <div style={{ padding:'14px 20px', borderBottom:`1px solid ${tk.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                    <span style={{ fontSize:13, fontWeight:700, color:tk.txt }}>Meta de Rentabilidad Bruta</span>
                                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: metaHit ? '#10b98122' : '#e67e2222', color: metaHit ? '#10b981' : '#e67e22' }}>
                                        {metaHit ? 'Meta alcanzada' : 'Meta pendiente'}
                                    </span>
                                </div>
                                <div style={{ padding:'16px 20px', display:'grid', gap:9 }}>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                        <div style={{ background:tk.card2, borderRadius:10, padding:'12px 14px' }}>
                                            <div style={{ fontSize:11, color:tk.txt3, marginBottom:4 }}>Rentabilidad Bruta</div>
                                            <div style={{ fontSize:24, fontWeight:800, color:tk.txt }}>{USD2(rentabilidadBrutaTotal)}</div>
                                        </div>
                                        <div style={{ background:tk.card2, borderRadius:10, padding:'12px 14px' }}>
                                            <div style={{ fontSize:11, color:tk.txt3, marginBottom:4 }}>Meta mensual</div>
                                            <div style={{ fontSize:24, fontWeight:800, color:tk.txt }}>{USD2(cuota)}</div>
                                        </div>
                                    </div>
                                    <div style={{ background:tk.card2, borderRadius:12, padding:'14px 16px' }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                                            <span style={{ fontSize:12, color:tk.txt2, fontWeight:700 }}>Avance de meta</span>
                                            <span style={{ fontSize:18, fontWeight:900, color:metaHit ? '#10b981' : '#e67e22' }}>{metaPct.toFixed(1)}%</span>
                                        </div>
                                        <div style={{ height:12, background:tk.bg, borderRadius:999, overflow:'hidden', border:`1px solid ${tk.bdr}` }}>
                                            <div style={{ height:'100%', width:`${metaPct}%`, background:metaHit ? 'linear-gradient(90deg,#10b981,#27ae60)' : 'linear-gradient(90deg,#e67e22,#f1c40f)' }} />
                                        </div>
                                    </div>
                                    <Row label="Cuota de Rentabilidad Bruta requerida"    value={USD2(cuota)}               color={tk.txt2} />
                                    <Row label="Rentabilidad Bruta lograda"               value={USD2(rentabilidadBrutaTotal)} color={metaHit ? '#10b981' : tk.txt2} bold />
                                    <Row label="Diferencia vs meta"                       value={USD2(rentabilidadBrutaTotal - cuota)} color={rentabilidadBrutaTotal - cuota >= 0 ? '#10b981' : '#e74c3c'} bold />
                                </div>
                            </div>

                            {/* CUADRO 2 — comisión por venta */}
                            <div style={{ background:tk.card, borderRadius:12, boxShadow:tk.shadow, overflow:'hidden', borderTop:`3px solid ${calc.pct_comision > 0 ? '#10b981' : '#8899aa'}` }}>
                                <div style={{ padding:'14px 20px', borderBottom:`1px solid ${tk.bdr}` }}>
                                    <span style={{ fontSize:13, fontWeight:700, color:tk.txt }}>Comisión aplicada</span>
                                </div>
                                <div style={{ padding:'20px', display:'grid', gap:14 }}>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                        <div style={{ background:tk.card2, borderRadius:10, padding:'12px 14px' }}>
                                            <div style={{ fontSize:11, color:tk.txt3, marginBottom:4 }}>Margen total</div>
                                            <div style={{ fontSize:24, fontWeight:800, color:calc.margen_pct >= MARGEN_MINIMO ? '#10b981' : '#e74c3c' }}>{PCT(calc.margen_pct)}</div>
                                        </div>
                                        <div style={{ background:tk.card2, borderRadius:10, padding:'12px 14px' }}>
                                            <div style={{ fontSize:11, color:tk.txt3, marginBottom:4 }}>Margen de comisión</div>
                                            <div style={{ fontSize:24, fontWeight:800, color:calc.pct_comision > 0 ? '#10b981' : tk.txt3 }}>{(calc.pct_comision * 100).toFixed(0)}%</div>
                                            <div style={{ fontSize:10, color:tk.txt3, marginTop:3 }}>{tramoComisionLabel(calc)}</div>
                                        </div>
                                    </div>
                                    <div style={{ background:tk.card2, borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                                        <div>
                                            <div style={{ fontSize:11, color:tk.txt3, marginBottom:4 }}>Comisión total ganada</div>
                                            <div style={{ fontSize:13, color:tk.txt2 }}>Base: rentabilidad neta</div>
                                        </div>
                                        <div style={{ fontSize:24, fontWeight:800, color:comisionTotalSuma > 0 ? '#10b981' : tk.txt3 }}>{USD2(comisionTotalSuma)}</div>
                                    </div>
                                    <div style={{ borderTop:`1px solid ${tk.bdr}` }} />
                                    <div style={{ display:'grid', gap:8 }}>
                                        {ventasDetalle.map((venta) => (
                                            <div key={venta.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px 120px', gap:10, alignItems:'center', background:tk.card2, borderRadius:10, padding:'10px 12px' }}>
                                                <div style={{ minWidth:0 }}>
                                                    <div style={{ fontSize:12, fontWeight:700, color:tk.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{venta.nombre}</div>
                                                    <div style={{ fontSize:10, color:tk.txt3 }}>{venta.cliente}</div>
                                                </div>
                                                <div style={{ textAlign:'right' }}>
                                                    <div style={{ fontSize:10, color:tk.txt3 }}>Margen</div>
                                                    <div style={{ fontSize:13, fontWeight:800, color:venta.calc.margen_pct >= MARGEN_MINIMO ? '#10b981' : '#e74c3c' }}>{PCT(venta.calc.margen_pct)}</div>
                                                    <div style={{ fontSize:9, color:tk.txt3 }}>{tramoComisionLabel(venta.calc)}</div>
                                                </div>
                                                <div style={{ textAlign:'right' }}>
                                                    <div style={{ fontSize:10, color:tk.txt3 }}>Comisión</div>
                                                    <div style={{ fontSize:13, fontWeight:800, color:venta.calc.monto_comision > 0 ? '#10b981' : tk.txt3 }}>
                                                        {USD2(venta.calc.monto_comision)}
                                                    </div>
                                                    {!metaHit && venta.calc.monto_comision > 0 && (
                                                        <div style={{ fontSize:9, color:'#e67e22', fontWeight:700, textAlign:'right', marginTop:2 }}>PENDIENTE</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop:4, padding:'10px 14px', borderRadius:8,
                                        background: calc.pct_comision > 0 ? '#10b98118' : ec + '18',
                                        color: calc.pct_comision > 0 ? '#10b981' : ec,
                                        fontSize:12, fontWeight:600, lineHeight:1.4 }}>
                                        {metaHit
                                            ? `${calc.mensaje}. La comisión por venta ya cuenta porque la meta sí fue alcanzada.`
                                            : 'La meta de Rentabilidad Bruta aún no se alcanza; por ahora la comisión ganada por venta se muestra en 0.'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actividades individuales */}
                        <div style={{ background:tk.card, borderRadius:12, boxShadow:tk.shadow, overflow:'hidden' }}>
                            <div style={{ padding:'11px 18px', borderBottom:`1px solid ${tk.bdr}`, fontSize:12, fontWeight:700, color:tk.txt2, textTransform:'uppercase', letterSpacing:0.5 }}>
                                Cotizaciones ganadas — detalle
                            </div>
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                                    <thead>
                                        <tr style={{ background:tk.bg }}>
                                            {['Actividad','Cliente','Mes','Facturación','Costo real','Rentabilidad Bruta','SUNAT','Gastos','Rentabilidad neta','Margen','Margen comisión','Comisión'].map(h => (
                                                <th key={h} style={{ padding:'8px 14px', textAlign: h==='Actividad'||h==='Cliente'||h==='Mes' ? 'left' : 'right', fontWeight:700, color:tk.txt3, fontSize:11, textTransform:'uppercase', letterSpacing:0.4, whiteSpace:'nowrap', borderBottom:`1px solid ${tk.bdr}` }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {v.actividades.map((a, idx) => {
                                            const ventaCalc = calcComision(a._fact, a._costoBase, a._sunat, a._gastos, pctBase, pctBajo, pctAlto);
                                            return (
                                                <tr key={a.id} style={{ borderBottom:`1px solid ${tk.bdr}`, background: idx % 2 === 1 ? tk.card2 : 'transparent' }}>
                                                    <td style={{ padding:'9px 14px', color:tk.txt, fontWeight:600, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</td>
                                                    <td style={{ padding:'9px 14px', color:tk.txt2, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.cliente}</td>
                                                    <td style={{ padding:'9px 14px', color:tk.txt2, whiteSpace:'nowrap' }}>{a.mes}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', color:tk.txt, fontWeight:600, fontFamily:'monospace' }}>{USD2(a._fact)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', color:tk.txt2, fontFamily:'monospace' }}>{USD2(a._costoBase)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', color:a._rentabilidadBruta >= 0 ? '#27ae60' : '#e74c3c', fontFamily:'monospace', fontWeight:700 }}>{USD2(a._rentabilidadBruta)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', color:tk.txt2, fontFamily:'monospace' }}>{USD2(a._sunat)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', color:tk.txt2, fontFamily:'monospace' }}>{USD2(a._gastos)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, fontFamily:'monospace', color: a._util >= 0 ? '#27ae60' : '#e74c3c' }}>{USD2(a._util)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, fontFamily:'monospace', color: ventaCalc.margen_pct >= MARGEN_MINIMO ? '#27ae60' : '#e74c3c' }}>{PCT(ventaCalc.margen_pct)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, color: ventaCalc.pct_comision > 0 ? '#10b981' : tk.txt3, whiteSpace:'nowrap' }}>{tramoComisionLabel(ventaCalc)}</td>
                                                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, fontFamily:'monospace', color: ventaCalc.monto_comision > 0 ? '#10b981' : tk.txt3 }}>{USD2(ventaCalc.monto_comision)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Totales */}
                                        <tr style={{ background: tk.isDark ? '#1a2744' : '#f0f5ff', borderTop:`2px solid ${tk.bdr}` }}>
                                            <td colSpan={3} style={{ padding:'9px 14px', fontWeight:700, color:tk.txt, fontSize:12 }}>TOTAL</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, color:tk.txt, fontFamily:'monospace' }}>{USD2(v.facturacion)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, color:tk.txt2, fontFamily:'monospace' }}>{USD2(v.costoBase)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, color:v.facturacion - v.costoBase >= 0 ? '#27ae60' : '#e74c3c', fontFamily:'monospace' }}>{USD2(v.facturacion - v.costoBase)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, color:tk.txt2, fontFamily:'monospace' }}>{USD2(v.sunat)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, color:tk.txt2, fontFamily:'monospace' }}>{USD2(v.gastos)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, fontFamily:'monospace', color: calc.utilidad >= 0 ? '#27ae60' : '#e74c3c' }}>{USD2(calc.utilidad)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, fontFamily:'monospace', color: calc.margen_pct >= MARGEN_MINIMO ? '#27ae60' : '#e74c3c' }}>{PCT(calc.margen_pct)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, color: calc.pct_comision > 0 ? '#10b981' : tk.txt3, whiteSpace:'nowrap' }}>{tramoComisionLabel(calc)}</td>
                                            <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:800, fontFamily:'monospace', color: comisionTotalSuma > 0 ? '#10b981' : tk.txt3 }}>{USD2(comisionTotalSuma)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Casos de prueba */}
            <div style={{ background:tk.card, borderRadius:12, boxShadow:tk.shadow, overflow:'hidden' }}>
                <button type="button"
                    onClick={() => setCasosOpen(x => !x)}
                    style={{ width:'100%', padding:'14px 20px', background:'none', border:'none', borderBottom: casosOpen ? `1px solid ${tk.bdr}` : 'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:tk.txt }}>Casos de prueba</span>
                    <span style={{ fontSize:11, color:tk.txt3 }}>{casosOpen ? '▲ Cerrar' : '▼ Ver ejemplos'}</span>
                </button>

                {casosOpen && (
                    <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                                <tr style={{ background:tk.card2 }}>
                                    {['Caso','Facturación','Costo','Rent. Bruta','SUNAT','Gastos','Rent. neta','Margen','Estado','Margen comisión','Monto comisión'].map(h => (
                                        <th key={h} style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:tk.txt2, whiteSpace:'nowrap', borderBottom:`2px solid ${tk.bdr}`, fontSize:11, textTransform:'uppercase', letterSpacing:0.4 }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {CASOS.map((c, idx) => {
                                    const rentabilidadBruta = c.facturacion - c.costo;
                                    const sunat = rentabilidadBruta * tasa_sunat;
                                    const gastos = c.gastos || 0;
                                    const r  = calcComision(c.facturacion, c.costo, sunat, gastos);
                                    const ec = ESTADO_COLOR[r.estado];
                                    return (
                                        <tr key={idx} style={{ borderBottom:`1px solid ${tk.bdr}`, background: idx % 2 === 1 ? tk.card2 : 'transparent' }}>
                                            <td style={{ padding:'10px 14px', fontWeight:700, color:tk.txt2 }}>{c.label}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color:tk.txt, fontWeight:600 }}>{USD2(c.facturacion)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color:tk.txt2 }}>{USD2(c.costo)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color: r.rentabilidad_bruta >= 0 ? '#27ae60' : '#e74c3c', fontWeight:600 }}>{USD2(r.rentabilidad_bruta)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color:tk.txt2 }}>{USD2(sunat)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color:tk.txt2 }}>{USD2(gastos)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color: r.rentabilidad >= 0 ? '#27ae60' : '#e74c3c', fontWeight:600 }}>{USD2(r.rentabilidad)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', color: r.margen_pct >= MARGEN_MINIMO ? '#27ae60' : '#e74c3c', fontWeight:600 }}>{PCT(r.margen_pct)}</td>
                                            <td style={{ padding:'10px 14px', textAlign:'right' }}>
                                                <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: ec + '22', color: ec, whiteSpace:'nowrap' }}>
                                                    {ESTADO_LABEL[r.estado]}
                                                </span>
                                            </td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, color: r.pct_comision > 0 ? '#10b981' : tk.txt3 }}>
                                                {tramoComisionLabel(r)}
                                            </td>
                                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, color: r.monto_comision > 0 ? '#10b981' : tk.txt3 }}>
                                                {USD2(r.monto_comision)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({ label, value, color, bold, big }) {
    const tk = useTheme();
    return (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12, color:tk.txt2 }}>{label}</span>
            <span style={{ fontSize: big ? 18 : 13, fontWeight: bold || big ? 700 : 400, color: color || tk.txt, fontFamily:'monospace', flexShrink:0 }}>
                {value}
            </span>
        </div>
    );
}
