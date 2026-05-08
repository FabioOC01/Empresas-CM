import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { useAuth } from '../context/AuthContext';
import { updateActividad } from '../api/actividades';
import { fmtUSD, parseGastos } from '../utils/crm';

// ── Configuración ──────────────────────────────────────────────────────────
const COMISION_BASE = 'rentabilidad'; // 'facturacion' | 'rentabilidad'
const MARGEN_MINIMO = 2;
const MARGEN_MEDIO  = 15;
const MARGEN_ALTO   = 20;
// ──────────────────────────────────────────────────────────────────────────

function calcComision(facturacion, costoBase, sunatMonto, gastosTotal, cuota, pctBase = 0.02, pctBajo = 0.07, pctAlto = 0.08) {
    const rentabilidad_bruta = facturacion - costoBase;
    const rentabilidad   = rentabilidad_bruta - sunatMonto - gastosTotal;
    const margen_pct     = facturacion > 0 ? (rentabilidad / facturacion) * 100 : 0;
    const util_minima = cuota * (MARGEN_MINIMO / 100);

    let estado, pct_comision = 0, mensaje = '';

    if (rentabilidad < 0) {
        estado  = 'perdida';
        mensaje = 'Trabajó con pérdida, no aplica comisión';
    } else if (rentabilidad_bruta < cuota) {
        estado  = 'no_cuota';
        mensaje = 'Sin comisión por no alcanzar la cuota de Rentabilidad Bruta';
    } else if (margen_pct < MARGEN_MINIMO) {
        estado  = 'no_margen';
        mensaje = `Sin comisión por no alcanzar el ${MARGEN_MINIMO}% de margen`;
    } else if (margen_pct < MARGEN_MEDIO) {
        estado       = 'cumple_2';
        pct_comision = pctBase;
        mensaje      = `Comision del ${(pctBase * 100).toFixed(0)}% por margen entre ${MARGEN_MINIMO}% y ${MARGEN_MEDIO - 1}%`;
    } else if (margen_pct < MARGEN_ALTO) {
        estado       = 'cumple_7';
        pct_comision = pctBajo;
        mensaje      = `Comision del ${(pctBajo * 100).toFixed(0)}% por margen desde ${MARGEN_MEDIO}%`;
    } else {
        estado       = 'cumple_8';
        pct_comision = pctAlto;
        mensaje      = `Comision del ${(pctAlto * 100).toFixed(0)}% por margen desde ${MARGEN_ALTO}%`;
    }

    const base_valor     = COMISION_BASE === 'facturacion' ? facturacion : Math.max(0, rentabilidad);
    const monto_comision = base_valor * pct_comision;
    return {
        rentabilidad_bruta,
        utilidad_bruta: rentabilidad_bruta,
        rentabilidad,
        utilidad: rentabilidad,
        margen_pct,
        util_minima,
        costoTotal: costoBase + sunatMonto + gastosTotal,
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
    perdida:'#e74c3c', no_cuota:'#e67e22', no_margen:'#d4ac0d', cumple_2:'#3498db', cumple_7:'#27ae60', cumple_8:'#1e8449',
};

const USD2 = n => new Intl.NumberFormat('es-PE', {
    style:'currency', currency:'USD', minimumFractionDigits:2,
}).format(n || 0);

export default function ComisionModal({ open, onClose, onSave, actividad, vendedor, moneda = 'USD' }) {
    const tk     = useTheme();
    const fmt$   = n => fmtUSD(n, moneda);
    const { config } = useActividadesContext();
    // eslint-disable-next-line no-unused-vars
    const { user } = useAuth();

    // Valores fijos (Admin/Gerencia pueden editarlos; vendedor solo los ve)
    const facturacion = parseFloat(actividad?.precio_venta) || parseFloat(actividad?.monto) || 0;
    const cuota       = parseFloat(vendedor?.meta_mensual) || 0;
    const sunatPct    = parseFloat(config?.tasa_sunat) > 0 ? parseFloat(config.tasa_sunat) * 100 : 0;

    const initCostoBase = parseFloat(actividad?.costo_base) || 0;
    const initGastos    = parseGastos(actividad?.gastos_operativos).map(g => ({ nombre: g.nombre || '', monto: String(g.monto || '') }));

    const [costoBase,   setCostoBase]   = useState(initCostoBase);
    const [gastos,      setGastos]      = useState(initGastos);
    const [saving,      setSaving]      = useState(false);
    const [saveMsg,     setSaveMsg]     = useState(null);

    useEffect(() => {
        if (!open || !actividad) return;
        setCostoBase(parseFloat(actividad.costo_base) || 0);
        setGastos(parseGastos(actividad.gastos_operativos).map(g => ({ nombre: g.nombre || '', monto: String(g.monto || '') })));
        setSaveMsg(null);
    }, [open, actividad?.id, actividad?.costo_base, actividad?.gastos_operativos]);

    const addGasto    = () => setGastos(g => [...g, { nombre:'', monto:'' }]);
    const removeGasto = i  => setGastos(g => g.filter((_, idx) => idx !== i));
    const setGasto    = (i, field, val) => setGastos(g => g.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

    const pctBase = parseFloat(vendedor?.pct_comision_base) || 0.02;
    const pctBajo = parseFloat(vendedor?.pct_comision_bajo) || 0.07;
    const pctAlto = parseFloat(vendedor?.pct_comision_alto) || 0.08;
    const rentabilidadBrutaPreview = facturacion - costoBase;

    const calc = useMemo(() => {
        const rentabilidadBruta = facturacion - costoBase;
        const sunatMonto  = rentabilidadBruta * (sunatPct / 100);
        const gastosTotal = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
        return { ...calcComision(facturacion, costoBase, sunatMonto, gastosTotal, cuota, pctBase, pctBajo, pctAlto), sunatMonto, gastosTotal };
    }, [facturacion, costoBase, sunatPct, gastos, cuota, pctBase, pctBajo, pctAlto]);

    const ec = ESTADO_COLOR[calc.estado];

    const handleSave = async () => {
        setSaving(true); setSaveMsg(null);
        try {
            const payload = {
                costo_base:        costoBase,
                gastos_operativos: gastos.filter(g => g.nombre || parseFloat(g.monto) > 0),
            };
            const updated = onSave
                ? await onSave({ id: actividad.id, ...payload })
                : await updateActividad(actividad.id, payload);
            setSaveMsg({ type:'ok', text:'Costo guardado correctamente.' });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type:'err', text:'Error al guardar.' });
        } finally {
            setSaving(false);
        }
    };

    const inp = {
        padding:'7px 10px', borderRadius:7, border:`1px solid ${tk.bdr}`,
        fontSize:13, outline:'none', background:tk.inp, color:tk.txt,
        fontFamily:'inherit', width:'100%', boxSizing:'border-box',
    };

    if (!open || !actividad) return null;

    return (
        <div onClick={onClose} style={{
            position:'fixed', inset:0, background:'rgba(7,13,25,0.65)', backdropFilter:'blur(3px)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100,
        }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{
                borderRadius:14,
                width:'min(820px,96vw)', maxHeight:'92vh', overflowY:'auto',
                boxShadow:'0 24px 64px rgba(0,0,0,0.35)',
                display:'flex', flexDirection:'column',
            }}>
                {/* Header */}
                <div style={{ padding:'18px 24px 14px', borderBottom:`1px solid ${tk.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
                    <div>
                        <div style={{ fontSize:11, fontWeight:700, color:tk.txt3, textTransform:'uppercase', letterSpacing:0.8, marginBottom:3 }}>Calculadora de comisión</div>
                        <div style={{ fontSize:15, fontWeight:700, color:tk.txt }}>{actividad.nombre}</div>
                        <div style={{ fontSize:12, color:tk.txt3, marginTop:2 }}>{actividad.cliente} · {vendedor?.nombre}</div>
                    </div>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:tk.txt3, padding:'2px 8px', lineHeight:1 }}>✕</button>
                </div>

                <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

                    {/* ── Columna izquierda: inputs ── */}
                    <div style={{ display:'grid', gap:14 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, textTransform:'uppercase', letterSpacing:0.6 }}>Datos de la operación</div>

                        {/* Facturación — siempre read-only */}
                        <Field label="Facturación real" color="#10b981">
                            <ReadonlyVal value={USD2(facturacion)} hint="Tomado del monto de la actividad" />
                        </Field>

                        {/* Cuota — siempre read-only */}
                        <Field label="Cuota mensual asignada" color="#8e44ad">
                            <ReadonlyVal value={USD2(cuota)} hint={cuota > 0 ? 'Configurada en Administración' : 'Sin cuota asignada'} />
                        </Field>

                        <div style={{ borderTop:`1px solid ${tk.bdr}`, margin:'2px 0' }} />
                        <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, textTransform:'uppercase', letterSpacing:0.6 }}>Costos</div>

                        {/* Costo real */}
                        <Field label="Costo real">
                            <input style={inp} type="number" min="0" step="0.01" placeholder="0.00"
                                value={costoBase} onChange={e => setCostoBase(parseFloat(e.target.value) || 0)} />
                        </Field>

                        {/* SUNAT — read-only */}
                        <Field label="SUNAT">
                            <ReadonlyVal
                                value={sunatPct > 0 ? `${sunatPct.toFixed(1)}% = ${USD2(rentabilidadBrutaPreview * (sunatPct / 100))}` : '0% — no configurado'}
                                hint="Configurado en Administración" />
                        </Field>

                        {/* Gastos adicionales */}
                        <div>
                            <div style={{ fontSize:12, color:tk.txt2, fontWeight:600, marginBottom:8 }}>Gastos adicionales</div>
                            {gastos.map((g, i) => (
                                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 110px 28px', gap:6, marginBottom:6 }}>
                                    <input style={inp} placeholder="Ej: Transporte, flete…" value={g.nombre}
                                        onChange={e => setGasto(i, 'nombre', e.target.value)} />
                                    <input style={inp} type="number" min="0" step="0.01" placeholder="Monto" value={g.monto}
                                        onChange={e => setGasto(i, 'monto', e.target.value)} />
                                    <button type="button" onClick={() => removeGasto(i)}
                                        style={{ background:'#e74c3c18', border:'none', borderRadius:7, cursor:'pointer', color:'#e74c3c', fontWeight:700, fontSize:15 }}>×</button>
                                </div>
                            ))}
                            <button type="button" onClick={addGasto}
                                style={{ fontSize:12, color:'#10b981', background:'none', border:'1px dashed #10b98180', borderRadius:7, padding:'5px 14px', cursor:'pointer', width:'100%' }}>
                                + Agregar gasto
                            </button>
                        </div>

                        {/* Guardar costo */}
                        <div style={{ borderTop:`1px solid ${tk.bdr}`, paddingTop:12, display:'flex', gap:10, alignItems:'center' }}>
                            <button onClick={handleSave} disabled={saving}
                                style={{ padding:'9px 20px', background: saving ? '#a0b8e8' : '#27ae60', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor: saving ? 'default' : 'pointer' }}>
                                {saving ? 'Guardando...' : 'Guardar costo real'}
                            </button>
                            {saveMsg && (
                                <span style={{ fontSize:12, fontWeight:600, color: saveMsg.type==='ok' ? '#27ae60' : '#e74c3c' }}>
                                    {saveMsg.type==='ok' ? '✓' : '⚠'} {saveMsg.text}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Columna derecha: resultados ── */}
                    <div style={{ display:'grid', gap:14 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:tk.txt2, textTransform:'uppercase', letterSpacing:0.6 }}>Resultado</div>

                        {/* Cuadro 1 — cascada de rentabilidad */}
                        <div style={{ background:tk.card2, borderRadius:12, overflow:'hidden', borderTop:`3px solid ${ec}` }}>
                            <div style={{ padding:'11px 16px', borderBottom:`1px solid ${tk.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:12, fontWeight:700, color:tk.txt }}>Rentabilidad Bruta</span>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:ec+'22', color:ec, whiteSpace:'nowrap' }}>
                                    {ESTADO_LABEL[calc.estado]}
                                </span>
                            </div>
                            <div style={{ padding:'12px 16px', display:'grid', gap:8 }}>
                                {/* Formula: facturacion - costo = rentabilidad bruta; luego SUNAT/gastos = rentabilidad neta. */}
                                <ResRow label="Facturación real"                        value={USD2(facturacion)}             color={tk.txt} bold />
                                <ResRow label="− Costo real"                            value={USD2(costoBase)}               color='#e74c3c' />
                                <ResRow label="= Rentabilidad Bruta"
                                    value={USD2(calc.rentabilidad_bruta)}
                                    color={calc.rentabilidad_bruta >= 0 ? '#27ae60' : '#e74c3c'} bold />
                                {calc.sunatMonto > 0 && (
                                    <ResRow label={`− SUNAT (${sunatPct.toFixed(1)}%)`} value={USD2(calc.sunatMonto)}         color='#e74c3c' />
                                )}
                                {calc.gastosTotal > 0 && (
                                    <ResRow label="− Gastos adicionales"                value={USD2(calc.gastosTotal)}        color='#e74c3c' />
                                )}
                                <div style={{ borderTop:`1px solid ${tk.bdr}`, margin:'2px 0' }} />
                                <ResRow label="= Rentabilidad neta"
                                    value={USD2(calc.rentabilidad)}
                                    color={calc.rentabilidad >= 0 ? '#27ae60' : '#e74c3c'} bold />
                                <ResRow label="Margen obtenido"
                                    value={`${calc.margen_pct.toFixed(2)}%`}
                                    color={calc.margen_pct >= MARGEN_MINIMO ? '#27ae60' : '#e74c3c'} bold />

                                <div style={{ borderTop:`1px solid ${tk.bdr}`, margin:'2px 0' }} />
                                <ResRow label="Cuota de Rentabilidad Bruta requerida"   value={USD2(cuota)}                   color={tk.txt2} />
                                <ResRow label={`Margen mínimo comisionable (${MARGEN_MINIMO}%)`} value={`${MARGEN_MINIMO}%`} color={tk.txt2} />
                                <ResRow label="Escala de comisión"                      value="2% / 7% / 8%"                  color={tk.txt2} />
                            </div>
                        </div>

                        {/* Cuadro 2 */}
                        <div style={{ background:tk.card2, borderRadius:12, overflow:'hidden', borderTop:`3px solid ${calc.pct_comision > 0 ? '#10b981' : '#8899aa'}` }}>
                            <div style={{ padding:'11px 16px', borderBottom:`1px solid ${tk.bdr}` }}>
                                <span style={{ fontSize:12, fontWeight:700, color:tk.txt }}>Comisión aplicada</span>
                            </div>
                            <div style={{ padding:'14px 16px', display:'grid', gap:12 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                                    <div style={{ fontSize:44, fontWeight:900, lineHeight:1, color: calc.pct_comision > 0 ? '#10b981' : tk.txt3 }}>
                                        {calc.pct_comision > 0 ? `${(calc.pct_comision * 100).toFixed(0)}%` : '0%'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize:10, color:tk.txt3 }}>tramo aplicado</div>
                                        <div style={{ fontSize:11, color:tk.txt2, marginTop:2 }}>
                                            base: {COMISION_BASE === 'facturacion' ? 'facturación' : 'rentabilidad'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ borderTop:`1px solid ${tk.bdr}` }} />
                                <ResRow label="Base de cálculo" value={USD2(calc.base_valor)} color={tk.txt} />
                                <ResRow label="Escala vigente" value="2%-14% = 2% · 15%-19% = 7% · 20%+ = 8%" color={tk.txt2} />
                                <ResRow label="Monto de comisión" value={fmt$(calc.monto_comision)}
                                    color={calc.monto_comision > 0 ? '#10b981' : tk.txt3} bold big />
                                <div style={{ padding:'10px 12px', borderRadius:8,
                                    background: calc.pct_comision > 0 ? '#10b98118' : ec+'18',
                                    color: calc.pct_comision > 0 ? '#10b981' : ec,
                                    fontSize:12, fontWeight:600, lineHeight:1.4 }}>
                                    {calc.mensaje}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, color, children }) {
    const tk = useTheme();
    return (
        <div>
            <div style={{ fontSize:12, color: color || tk.txt2, fontWeight:600, marginBottom:5 }}>{label}</div>
            {children}
        </div>
    );
}


function ResRow({ label, value, color, bold, big }) {
    const tk = useTheme();
    return (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:tk.txt2 }}>{label}</span>
            <span style={{ fontSize: big ? 17 : 13, fontWeight: bold || big ? 700 : 400, color: color || tk.txt, fontFamily:'monospace', flexShrink:0 }}>
                {value}
            </span>
        </div>
    );
}

function ReadonlyVal({ value, hint }) {
    const tk = useTheme();
    return (
        <div style={{ padding:'8px 12px', borderRadius:7, background:tk.bg, border:`1px solid ${tk.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:tk.txt, fontFamily:'monospace' }}>{value}</span>
            {hint && <span style={{ fontSize:10, color:tk.txt3, flexShrink:0 }}>{hint}</span>}
        </div>
    );
}



