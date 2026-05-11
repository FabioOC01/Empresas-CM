import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { updateActividad } from '../api/actividades';
import { fmtUSD, parseGastos } from '../utils/crm';

const COMISION_BASE = 'rentabilidad';
const MARGEN_MINIMO = 2;
const MARGEN_MEDIO = 15;
const MARGEN_ALTO = 20;

function calcComision(facturacion, costoBase, sunatMonto, gastosTotal, cuota, pctBase = 0.02, pctBajo = 0.07, pctAlto = 0.08) {
    const rentabilidad_bruta = facturacion - costoBase;
    const rentabilidad = rentabilidad_bruta - sunatMonto - gastosTotal;
    const margen_pct = facturacion > 0 ? (rentabilidad / facturacion) * 100 : 0;
    const util_minima = cuota * (MARGEN_MINIMO / 100);

    let estado, pct_comision = 0, mensaje = '';

    if (rentabilidad < 0) {
        estado = 'perdida';
        mensaje = 'Trabajo con perdida, no aplica comision';
    } else if (rentabilidad_bruta < cuota) {
        estado = 'no_cuota';
        mensaje = 'Sin comision por no alcanzar la cuota de Rentabilidad Bruta';
    } else if (margen_pct < MARGEN_MINIMO) {
        estado = 'no_margen';
        mensaje = `Sin comision por no alcanzar el ${MARGEN_MINIMO}% de margen`;
    } else if (margen_pct < MARGEN_MEDIO) {
        estado = 'cumple_2';
        pct_comision = pctBase;
        mensaje = `Comision del ${(pctBase * 100).toFixed(0)}% por margen entre ${MARGEN_MINIMO}% y ${MARGEN_MEDIO - 1}%`;
    } else if (margen_pct < MARGEN_ALTO) {
        estado = 'cumple_7';
        pct_comision = pctBajo;
        mensaje = `Comision del ${(pctBajo * 100).toFixed(0)}% por margen desde ${MARGEN_MEDIO}%`;
    } else {
        estado = 'cumple_8';
        pct_comision = pctAlto;
        mensaje = `Comision del ${(pctAlto * 100).toFixed(0)}% por margen desde ${MARGEN_ALTO}%`;
    }

    const base_valor = COMISION_BASE === 'facturacion' ? facturacion : Math.max(0, rentabilidad);
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
    perdida: 'Trabajo con perdida',
    no_cuota: 'No cumple cuota',
    no_margen: 'Cumple cuota pero no margen',
    cumple_2: 'Cumple cuota',
    cumple_7: 'Cumple cuota',
    cumple_8: 'Cumple cuota',
};

const USD2 = n => new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
}).format(n || 0);

function normalizeGastos(gastosOperativos, costoBase = 0) {
    const gastos = parseGastos(gastosOperativos).map(g => ({
        nombre: g.nombre || '',
        monto: String(g.monto ?? ''),
        notas: g.notas || '',
    }));
    const legacyCosto = parseFloat(costoBase) || 0;
    if (!gastos.length && legacyCosto > 0) {
        return [{ nombre: 'Costo real', monto: String(legacyCosto), notas: '' }];
    }
    return gastos;
}

export default function ComisionModal({ open, onClose, onSave, actividad, vendedor, moneda = 'USD' }) {
    const tk = useTheme();
    const fmt$ = n => fmtUSD(n, moneda);
    const { config } = useActividadesContext();

    const facturacion = parseFloat(actividad?.precio_venta) || parseFloat(actividad?.monto) || 0;
    const cuota = parseFloat(vendedor?.meta_mensual) || 0;
    const sunatPct = parseFloat(config?.tasa_sunat) > 0 ? parseFloat(config.tasa_sunat) * 100 : 0;
    const initGastos = normalizeGastos(actividad?.gastos_operativos, actividad?.costo_base);

    const [gastos, setGastos] = useState(initGastos);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);

    useEffect(() => {
        if (!open || !actividad) return;
        setGastos(normalizeGastos(actividad.gastos_operativos, actividad.costo_base));
        setSaveMsg(null);
    }, [open, actividad?.id, actividad?.costo_base, actividad?.gastos_operativos]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const addGasto = () => setGastos(g => [...g, { nombre: '', monto: '', notas: '' }]);
    const removeGasto = i => setGastos(g => g.filter((_, idx) => idx !== i));
    const setGasto = (i, field, val) => setGastos(g => g.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

    const pctBase = parseFloat(vendedor?.pct_comision_base) || 0.02;
    const pctBajo = parseFloat(vendedor?.pct_comision_bajo) || 0.07;
    const pctAlto = parseFloat(vendedor?.pct_comision_alto) || 0.08;
    const gastosTotal = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
    const rentabilidadBrutaPreview = facturacion - gastosTotal;

    const calc = useMemo(() => {
        const rentabilidadBruta = facturacion - gastosTotal;
        const sunatMonto = rentabilidadBruta * (sunatPct / 100);
        return { ...calcComision(facturacion, gastosTotal, sunatMonto, 0, cuota, pctBase, pctBajo, pctAlto), sunatMonto, gastosTotal };
    }, [facturacion, gastosTotal, sunatPct, cuota, pctBase, pctBajo, pctAlto]);

    const handleSave = async () => {
        if (!actividad?.id) return;
        setSaving(true);
        setSaveMsg(null);
        try {
            const payload = {
                costo_base: 0,
                gastos_operativos: gastos
                    .filter(g => g.nombre || g.notas || parseFloat(g.monto) > 0)
                    .map(g => ({ nombre: g.nombre, monto: parseFloat(g.monto) || 0, notas: g.notas || '' })),
            };
            if (onSave) await onSave({ id: actividad.id, ...payload });
            else await updateActividad(actividad.id, payload);
            setSaveMsg({ type: 'ok', text: 'Gastos guardados correctamente.' });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type: 'err', text: 'Error al guardar.' });
        } finally {
            setSaving(false);
        }
    };

    if (!open || !actividad) return null;

    return (
        <div className="cm-overlay" onClick={onClose}>
            <style>{`
                .cm-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 1100;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px;
                    background: rgba(17, 23, 22, .42);
                    backdrop-filter: blur(4px);
                }
                .cm-modal {
                    --cm-bg: #fafbf8;
                    --cm-panel: #ffffff;
                    --cm-line: #e5e6e0;
                    --cm-line-strong: #bfe9d6;
                    --cm-ink: #171816;
                    --cm-muted: #777b73;
                    --cm-faint: #8d9088;
                    --cm-green: #007a57;
                    --cm-green-2: #00966b;
                    --cm-red: #d7352a;
                    --cm-purple: #7047b9;
                    width: min(960px, calc(100vw - 16px));
                    max-height: calc(100vh - 10px);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background: var(--cm-bg);
                    color: var(--cm-ink);
                    border: 1px solid var(--cm-line-strong);
                    border-radius: 10px;
                    box-shadow: 0 24px 70px rgba(0,0,0,.32);
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                [data-theme="dark"] .cm-modal {
                    --cm-bg: ${tk.card};
                    --cm-panel: ${tk.card};
                    --cm-line: ${tk.bdr};
                    --cm-line-strong: ${tk.bdr};
                    --cm-ink: ${tk.txt};
                    --cm-muted: ${tk.txt2};
                    --cm-faint: ${tk.txt3};
                }
                .cm-head {
                    position: relative;
                    min-height: 82px;
                    padding: 13px 62px 12px 18px;
                    border-bottom: 1px solid var(--cm-line-strong);
                    background: #f0fff8;
                }
                [data-theme="dark"] .cm-head { background: ${tk.card2}; }
                .cm-eyebrow {
                    color: var(--cm-green);
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0;
                    margin-bottom: 4px;
                }
                .cm-title {
                    font-size: 18px;
                    line-height: 1.15;
                    font-weight: 600;
                    color: var(--cm-ink);
                    margin-bottom: 8px;
                }
                .cm-sub {
                    font-size: 13px;
                    color: var(--cm-muted);
                }
                .cm-close-small {
                    position: absolute;
                    right: 20px;
                    top: 26px;
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--cm-line);
                    border-radius: 8px;
                    background: var(--cm-panel);
                    color: var(--cm-muted);
                    cursor: pointer;
                    font-size: 18px;
                    line-height: 1;
                }
                .cm-body {
                    overflow: auto;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr);
                    align-items: stretch;
                    min-height: 0;
                }
                .cm-col {
                    padding: 18px;
                    min-width: 0;
                }
                .cm-col + .cm-col {
                    border-left: 1px solid var(--cm-line);
                }
                .cm-section-title,
                .cm-divider {
                    color: var(--cm-faint);
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                }
                .cm-section-title { margin-bottom: 14px; }
                .cm-divider { margin: 18px 0 14px; }
                .cm-field { margin-bottom: 13px; }
                .cm-label {
                    display: block;
                    margin-bottom: 8px;
                    color: var(--cm-ink);
                    font-size: 14px;
                    font-weight: 700;
                }
                .cm-label.green { color: var(--cm-green); }
                .cm-label.purple { color: var(--cm-purple); }
                .cm-readonly {
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 0 14px;
                    border: 1px solid var(--cm-line);
                    border-radius: 7px;
                    background: #f1f1ee;
                    color: var(--cm-ink);
                }
                [data-theme="dark"] .cm-readonly { background: ${tk.bg}; }
                .cm-currency {
                    color: var(--cm-faint);
                    font-size: 12px;
                    font-weight: 600;
                    margin-right: 8px;
                }
                .cm-money {
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                }
                .cm-hint {
                    color: var(--cm-faint);
                    font-size: 12px;
                    white-space: nowrap;
                }
                .cm-products-title {
                    color: #4b4d48;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 7px;
                }
                [data-theme="dark"] .cm-products-title { color: var(--cm-muted); }
                .cm-gasto {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 165px 34px;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .cm-input {
                    width: 100%;
                    box-sizing: border-box;
                    border: 1px solid var(--cm-line);
                    border-radius: 7px;
                    background: var(--cm-panel);
                    color: var(--cm-ink);
                    font: inherit;
                    font-size: 14px;
                    outline: 0;
                }
                .cm-input {
                    height: 36px;
                    padding: 0 12px;
                }
                .cm-input.amount {
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }
                .cm-remove {
                    width: 34px;
                    height: 36px;
                    border: 1px solid var(--cm-line);
                    border-radius: 7px;
                    background: var(--cm-panel);
                    color: var(--cm-red);
                    cursor: pointer;
                    font-size: 20px;
                    line-height: 1;
                }
                .cm-add {
                    width: 100%;
                    height: 38px;
                    border: 1px dashed var(--cm-green-2);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--cm-green);
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 700;
                }
                .cm-save-gastos,
                .cm-save-main {
                    height: 38px;
                    border: 0;
                    border-radius: 8px;
                    background: linear-gradient(180deg, #10b981, #05845f);
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 700;
                    box-shadow: 0 9px 16px rgba(5,132,95,.25);
                }
                .cm-save-gastos {
                    margin-top: 16px;
                    padding: 0 18px;
                }
                .cm-save-gastos:disabled,
                .cm-save-main:disabled {
                    opacity: .6;
                    cursor: default;
                }
                .cm-result-card {
                    background: var(--cm-panel);
                    border: 1px solid var(--cm-line);
                    border-radius: 10px;
                    border-top: 3px solid var(--cm-green-2);
                    padding: 14px 18px;
                    margin-bottom: 18px;
                }
                .cm-card-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 10px;
                    font-weight: 700;
                    font-size: 16px;
                }
                .cm-pill {
                    border-radius: 5px;
                    padding: 5px 10px;
                    background: #e6f8ef;
                    color: var(--cm-green);
                    font-size: 12px;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .cm-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 18px;
                    align-items: baseline;
                    padding: 5px 0;
                    color: #4e514b;
                    font-size: 14px;
                }
                [data-theme="dark"] .cm-row { color: var(--cm-muted); }
                .cm-row strong,
                .cm-value {
                    color: var(--cm-ink);
                    font-weight: 600;
                }
                .cm-value {
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                }
                .cm-value.green { color: var(--cm-green); }
                .cm-value.red { color: var(--cm-red); }
                .cm-rule {
                    border-top: 1px solid var(--cm-line);
                    margin: 9px 0 6px;
                }
                .cm-commission {
                    display: flex;
                    align-items: flex-end;
                    gap: 12px;
                    margin: 6px 0 16px;
                }
                .cm-percent {
                    color: var(--cm-green);
                    font-size: 44px;
                    line-height: .9;
                    font-weight: 700;
                    letter-spacing: 0;
                }
                .cm-percent-note {
                    color: var(--cm-muted);
                    font-size: 12px;
                    line-height: 1.5;
                    padding-bottom: 3px;
                }
                .cm-message {
                    margin-top: 10px;
                    padding: 10px 14px;
                    border: 1px solid #abe8cd;
                    border-radius: 8px;
                    background: #e9fbf2;
                    color: var(--cm-green);
                    font-size: 14px;
                }
                .cm-msg-inline {
                    margin-left: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .cm-msg-inline.ok { color: var(--cm-green); }
                .cm-msg-inline.err { color: var(--cm-red); }
                .cm-foot {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 10px 18px;
                    border-top: 1px solid var(--cm-line);
                    background: var(--cm-panel);
                    flex-shrink: 0;
                }
                .cm-esc {
                    color: var(--cm-muted);
                    font-size: 13px;
                }
                .cm-esc kbd {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    height: 20px;
                    min-width: 25px;
                    padding: 0 5px;
                    border: 1px solid var(--cm-line);
                    border-radius: 5px;
                    background: var(--cm-panel);
                    color: var(--cm-ink);
                    font-size: 12px;
                    margin-right: 6px;
                }
                .cm-actions {
                    display: flex;
                    gap: 10px;
                }
                .cm-close-foot {
                    height: 39px;
                    padding: 0 18px;
                    border: 1px solid var(--cm-line);
                    border-radius: 8px;
                    background: var(--cm-panel);
                    color: var(--cm-ink);
                    cursor: pointer;
                    font-size: 14px;
                }
                .cm-save-main {
                    padding: 0 18px;
                }
                @media (max-width: 860px) {
                    .cm-overlay { align-items: stretch; }
                    .cm-modal { max-height: calc(100vh - 16px); }
                    .cm-head { min-height: auto; padding: 16px 54px 16px 18px; }
                    .cm-close-small { top: 18px; right: 16px; }
                    .cm-body { grid-template-columns: 1fr; }
                    .cm-col + .cm-col { border-left: 0; border-top: 1px solid var(--cm-line); }
                    .cm-gasto { grid-template-columns: 1fr 118px 34px; }
                    .cm-foot { flex-direction: column; align-items: stretch; }
                    .cm-actions { width: 100%; }
                    .cm-close-foot, .cm-save-main { flex: 1; }
                }
            `}</style>
            <div onClick={e => e.stopPropagation()} className="cm-modal">
                <div className="cm-head">
                    <div className="cm-eyebrow">Calculadora de comision</div>
                    <div className="cm-title">{actividad.nombre}</div>
                    <div className="cm-sub">{actividad.cliente} - {vendedor?.nombre || 'Sin vendedor'}</div>
                    <button type="button" onClick={onClose} className="cm-close-small" aria-label="Cerrar">x</button>
                </div>

                <div className="cm-body">
                    <div className="cm-col">
                        <div className="cm-section-title">Datos de la operacion</div>

                        <div className="cm-field">
                            <label className="cm-label green">Facturacion real</label>
                            <ReadonlyBox value={USD2(facturacion)} hint="Tomado del monto de la actividad" />
                        </div>

                        <div className="cm-field">
                            <label className="cm-label purple">Cuota mensual asignada</label>
                            <ReadonlyBox value={USD2(cuota)} hint={cuota > 0 ? 'Configurada en Administracion' : 'Sin cuota asignada'} />
                        </div>

                        <div className="cm-divider">Gastos adicionales</div>

                        <div className="cm-field">
                            <label className="cm-label">SUNAT</label>
                            <ReadonlyBox
                                value={sunatPct > 0 ? `${sunatPct.toFixed(1)}% = ${USD2(rentabilidadBrutaPreview * (sunatPct / 100))}` : '0% = USD 0.00'}
                                hint="Configurado en Administracion"
                            />
                        </div>

                        <div className="cm-products-title">Productos, costos o gastos de la cotizacion</div>
                        {gastos.map((g, i) => (
                            <div key={i} className="cm-gasto">
                                <input className="cm-input" placeholder="Producto o gasto" value={g.nombre}
                                    onChange={e => setGasto(i, 'nombre', e.target.value)} />
                                <input className="cm-input amount" type="number" min="0" step="0.01" placeholder="Monto" value={g.monto}
                                    onChange={e => setGasto(i, 'monto', e.target.value)} />
                                <button type="button" className="cm-remove" onClick={() => removeGasto(i)}>x</button>
                            </div>
                        ))}
                        <button type="button" className="cm-add" onClick={addGasto}>+ Agregar producto o gasto</button>

                        <button type="button" className="cm-save-gastos" onClick={handleSave} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar gastos'}
                        </button>
                        {saveMsg && (
                            <span className={`cm-msg-inline ${saveMsg.type === 'ok' ? 'ok' : 'err'}`}>
                                {saveMsg.text}
                            </span>
                        )}
                    </div>

                    <div className="cm-col">
                        <div className="cm-section-title">Resultado</div>

                        <div className="cm-result-card">
                            <div className="cm-card-head">
                                <span>Rentabilidad Bruta</span>
                                <span className="cm-pill">{ESTADO_LABEL[calc.estado]}</span>
                            </div>
                            <CalcRow label="Facturacion real" value={USD2(facturacion)} />
                            <CalcRow label="- Gastos adicionales" value={USD2(calc.gastosTotal)} tone="red" />
                            <CalcRow label="= Rentabilidad Bruta" value={USD2(calc.rentabilidad_bruta)} tone={calc.rentabilidad_bruta >= 0 ? 'green' : 'red'} strong />
                            {calc.sunatMonto > 0 && (
                                <CalcRow label={`- SUNAT (${sunatPct.toFixed(1)}%)`} value={USD2(calc.sunatMonto)} tone="red" />
                            )}
                            <div className="cm-rule" />
                            <CalcRow label="= Rentabilidad neta" value={USD2(calc.rentabilidad)} tone={calc.rentabilidad >= 0 ? 'green' : 'red'} strong />
                            <CalcRow label="Margen obtenido" value={`${calc.margen_pct.toFixed(2)}%`} tone={calc.margen_pct >= MARGEN_MINIMO ? 'green' : 'red'} strong />
                            <div className="cm-rule" />
                            <CalcRow label="Cuota de Rentabilidad Bruta requerida" value={USD2(cuota)} />
                            <CalcRow label={`Margen minimo comisionable (${MARGEN_MINIMO}%)`} value={`${MARGEN_MINIMO}%`} />
                            <CalcRow label="Escala de comision" value="2% / 7% / 8%" />
                        </div>

                        <div className="cm-result-card" style={{ borderTopColor: calc.pct_comision > 0 ? '#2f6bd1' : '#8899aa' }}>
                            <div className="cm-card-head">
                                <span>Comision aplicada</span>
                            </div>
                            <div className="cm-commission">
                                <div className="cm-percent">{calc.pct_comision > 0 ? `${(calc.pct_comision * 100).toFixed(0)}%` : '0%'}</div>
                                <div className="cm-percent-note">
                                    <div>tramo aplicado</div>
                                    <div>base: {COMISION_BASE === 'facturacion' ? 'facturacion' : 'rentabilidad'}</div>
                                </div>
                            </div>
                            <CalcRow label="Base de calculo" value={USD2(calc.base_valor)} />
                            <CalcRow label="Escala vigente" value="2%-14% = 2% - 15%-19% = 7% - 20%+ = 8%" />
                            <CalcRow label="Monto de comision" value={fmt$(calc.monto_comision)} tone={calc.monto_comision > 0 ? 'green' : undefined} strong />
                            <div className="cm-message">
                                {calc.pct_comision > 0 ? 'Comision aplicada correctamente segun tramo vigente.' : calc.mensaje}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cm-foot">
                    <div className="cm-esc"><kbd>Esc</kbd> para cerrar</div>
                    <div className="cm-actions">
                        <button type="button" className="cm-close-foot" onClick={onClose}>Cerrar</button>
                        <button type="button" className="cm-save-main" onClick={handleSave} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar calculo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReadonlyBox({ value, hint }) {
    const parts = String(value).split(' ');
    const currency = parts.length > 1 ? parts[0] : 'USD';
    const amount = parts.length > 1 ? parts.slice(1).join(' ') : value;
    return (
        <div className="cm-readonly">
            <span>
                <span className="cm-currency">{currency}</span>
                <span className="cm-money">{amount}</span>
            </span>
            {hint && <span className="cm-hint">{hint}</span>}
        </div>
    );
}

function CalcRow({ label, value, tone, strong }) {
    return (
        <div className="cm-row">
            <span>{strong ? <strong>{label}</strong> : label}</span>
            <span className={`cm-value ${tone || ''}`}>{value}</span>
        </div>
    );
}
