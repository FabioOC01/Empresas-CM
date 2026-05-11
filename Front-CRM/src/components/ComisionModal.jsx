import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { useAuth } from '../context/AuthContext';
import { updateActividad, updateConfig } from '../api/actividades';
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

const productName = p => p?.nombre || [p?.marca, p?.modelo].filter(Boolean).join(' ') || p?.descripcion || 'Producto';
const productText = p => [p?.marca, p?.modelo, p?.descripcion, p?.nombre].filter(Boolean).join(' ').toLowerCase();
const newProductId = () => `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const productUnits = value => {
    const units = parseFloat(value);
    return Number.isFinite(units) && units > 0 ? units : 1;
};
const productUnitCost = line => parseFloat(line?.costo ?? line?.monto) || 0;
const cleanProduct = (p = {}) => ({
    id: p.id || newProductId(),
    nombre: productName(p),
    marca: p.marca || '',
    modelo: p.modelo || '',
    descripcion: p.descripcion || '',
    costo: parseFloat(p.costo) || 0,
    unidad: productUnits(p.unidad),
    origen: p.origen || 'admin',
});

function zeroCostUnitEstimate(lines, facturacion) {
    const knownCost = lines.reduce((sum, line) => {
        const cost = productUnitCost(line);
        return cost > 0 ? sum + (cost * productUnits(line?.unidad)) : sum;
    }, 0);
    const zeroUnits = lines.reduce((sum, line) => {
        const cost = productUnitCost(line);
        return cost > 0 ? sum : sum + productUnits(line?.unidad);
    }, 0);
    if (!zeroUnits) return 0;
    return (Math.max(0, facturacion - knownCost) / zeroUnits) * 0.9;
}

function effectiveProductCost(line, facturacion, zeroUnitCost = null) {
    const unitCost = productUnitCost(line);
    const base = unitCost > 0 ? unitCost : Math.max(0, zeroUnitCost ?? 0);
    return base * productUnits(line?.unidad);
}

function importCost(line, facturacion, zeroUnitCost = null) {
    if (!line?.importacion) return 0;
    return effectiveProductCost(line, facturacion, zeroUnitCost) * 0.07;
}

function productToLine(product, origen = 'catalogo') {
    const p = cleanProduct(product);
    return {
        tipo_linea: 'producto',
        producto_id: p.id,
        nombre: productName(p),
        marca: p.marca,
        modelo: p.modelo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        costo: p.costo,
        monto: p.costo * productUnits(p.unidad),
        notas: p.descripcion,
        importacion: false,
        importacion_monto: 0,
        origen,
    };
}

function normalizeGastos(gastosOperativos, costoBase = 0) {
    const gastos = parseGastos(gastosOperativos).map(g => ({
        tipo_linea: g.tipo_linea || 'producto',
        producto_id: g.producto_id || '',
        nombre: g.nombre || [g.marca, g.modelo].filter(Boolean).join(' ') || '',
        marca: g.marca || '',
        modelo: g.modelo || g.nombre || '',
        descripcion: g.descripcion || g.notas || '',
        unidad: productUnits(g.unidad),
        costo: String(g.costo ?? g.monto ?? ''),
        monto: String(g.monto ?? g.costo ?? ''),
        notas: g.notas || g.descripcion || '',
        importacion: !!g.importacion,
        importacion_monto: parseFloat(g.importacion_monto) || 0,
        origen: g.origen || (g.tipo_linea === 'producto' ? 'catalogo' : 'manual'),
    }));
    const legacyCosto = parseFloat(costoBase) || 0;
    if (!gastos.length && legacyCosto > 0) {
        return [{ tipo_linea:'producto', producto_id:'', nombre:'Costo real', marca:'', modelo:'Costo real', descripcion:'', unidad:1, costo:String(legacyCosto), monto:String(legacyCosto), notas:'', importacion:false, importacion_monto:0, origen:'manual' }];
    }
    return gastos;
}

export default function ComisionModal({ open, onClose, onSave, actividad, vendedor, moneda = 'USD' }) {
    const tk = useTheme();
    const fmt$ = n => fmtUSD(n, moneda);
    const { config, setConfig } = useActividadesContext();
    const { user } = useAuth();
    const canManageProducts = user?.is_superadmin || user?.roles?.includes('Admin');

    const facturacion = parseFloat(actividad?.precio_venta) || parseFloat(actividad?.monto) || 0;
    const cuota = parseFloat(vendedor?.meta_mensual) || 0;
    const sunatPct = parseFloat(config?.tasa_sunat) > 0 ? parseFloat(config.tasa_sunat) * 100 : 0;
    const initGastos = normalizeGastos(actividad?.gastos_operativos, actividad?.costo_base);

    const [gastos, setGastos] = useState(initGastos);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [productQuery, setProductQuery] = useState('');
    const [newProduct, setNewProduct] = useState(null);
    const productosCatalogo = useMemo(
        () => (config?.productos_catalogo || []).map(cleanProduct),
        [config?.productos_catalogo]
    );
    const productMatches = useMemo(() => {
        const q = productQuery.trim().toLowerCase();
        if (!q) return productosCatalogo.slice(0, 6);
        return productosCatalogo.filter(p => productText(p).includes(q)).slice(0, 6);
    }, [productosCatalogo, productQuery]);

    useEffect(() => {
        if (!open || !actividad) return;
        setGastos(normalizeGastos(actividad.gastos_operativos, actividad.costo_base));
        setSaveMsg(null);
        setProductQuery('');
        setNewProduct(null);
    }, [open, actividad?.id, actividad?.costo_base, actividad?.gastos_operativos]);

    const removeGasto = i => setGastos(g => g.filter((_, idx) => idx !== i));
    const setGasto = (i, field, val) => setGastos(g => g.map((x, idx) => {
        if (idx !== i) return x;
        const next = { ...x, [field]: val };
        if (field === 'unidad') next.unidad = productUnits(val);
        if (['costo', 'unidad', 'importacion'].includes(field)) next.importacion_monto = 0;
        return next;
    }));
    const addProductLine = (product, origen = 'catalogo') => {
        const line = productToLine(product, origen);
        setGastos(g => [...g, line]);
        setProductQuery('');
        setNewProduct(null);
    };
    const createProductFromCalculator = async () => {
        if (!canManageProducts || !newProduct) return;
        const product = cleanProduct({
            ...newProduct,
            nombre: [newProduct.marca, newProduct.modelo].filter(Boolean).join(' ') || newProduct.descripcion || productQuery,
            origen: 'admin',
        });
        const productos = [...productosCatalogo, product];
        const updated = await updateConfig({ productos_catalogo: productos });
        setConfig(prev => ({ ...prev, ...updated }));
        addProductLine(product, 'catalogo');
    };

    const pctBase = parseFloat(vendedor?.pct_comision_base) || 0.02;
    const pctBajo = parseFloat(vendedor?.pct_comision_bajo) || 0.07;
    const pctAlto = parseFloat(vendedor?.pct_comision_alto) || 0.08;
    const zeroUnitCost = zeroCostUnitEstimate(gastos, facturacion);
    const importacionTotal = gastos.reduce((s, g) => s + importCost(g, facturacion, zeroUnitCost), 0);
    const hasImportacion = gastos.some(g => !!g.importacion);
    const productosCostoCero = gastos.filter(g => productUnitCost(g) === 0);
    const productosCostoCeroTotal = productosCostoCero.reduce((s, g) => s + effectiveProductCost(g, facturacion, zeroUnitCost), 0);
    const gastosTotal = gastos.reduce((s, g) => s + effectiveProductCost(g, facturacion, zeroUnitCost) + importCost(g, facturacion, zeroUnitCost), 0);
    const rentabilidadBrutaPreview = facturacion - gastosTotal;

    const calc = useMemo(() => {
        const rentabilidadBruta = facturacion - gastosTotal;
        const sunatMonto = Math.max(0, rentabilidadBruta * (sunatPct / 100));
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
                    .filter(g => g.nombre || g.modelo || g.descripcion || parseFloat(g.monto) > 0 || parseFloat(g.costo) > 0)
                    .map(g => {
                        const costo = effectiveProductCost(g, facturacion, zeroUnitCost);
                        const imp = importCost(g, facturacion, zeroUnitCost);
                        return {
                            tipo_linea: 'producto',
                            producto_id: g.producto_id || '',
                            nombre: g.nombre || [g.marca, g.modelo].filter(Boolean).join(' ') || g.descripcion || 'Producto',
                            marca: g.marca || '',
                            modelo: g.modelo || g.nombre || '',
                            descripcion: g.descripcion || g.notas || '',
                            unidad: productUnits(g.unidad),
                            costo: parseFloat(g.costo ?? g.monto) || 0,
                            monto: costo,
                            notas: g.notas || g.descripcion || '',
                            importacion: !!g.importacion,
                            importacion_monto: imp,
                            origen: g.origen || 'manual',
                        };
                    }),
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
        <div className="cm-overlay">
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
                    grid-template-columns: minmax(0, 1fr) 110px 70px 94px 34px;
                    gap: 8px;
                    margin-bottom: 8px;
                    align-items: center;
                }
                .cm-product-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                .cm-product-name { font-size: 13px; font-weight: 700; color: var(--cm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .cm-product-sub { font-size: 11px; color: var(--cm-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .cm-product-help {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin: -2px 0 10px;
                    color: var(--cm-muted);
                    font-size: 11px;
                }
                .cm-product-help span {
                    display: inline-flex;
                    align-items: center;
                    min-height: 24px;
                    padding: 0 9px;
                    border: 1px solid var(--cm-line);
                    border-radius: 999px;
                    background: var(--cm-panel);
                }
                .cm-product-help strong { color: var(--cm-green); font-weight: 700; }
                .cm-import {
                    height: 36px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    border: 1px solid var(--cm-line);
                    border-radius: 7px;
                    color: var(--cm-muted);
                    background: var(--cm-panel);
                    font-size: 12px;
                    cursor: pointer;
                    user-select: none;
                }
                .cm-import input { accent-color: var(--cm-green-2); }
                .cm-searchbox { position: relative; margin-bottom: 10px; }
                .cm-searchrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
                .cm-new-product {
                    height: 36px;
                    padding: 0 14px;
                    border: 1px solid var(--cm-green-2);
                    border-radius: 7px;
                    background: rgba(0,150,107,.08);
                    color: var(--cm-green);
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .cm-suggest {
                    position: absolute;
                    z-index: 4;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    max-height: 210px;
                    overflow: auto;
                    background: var(--cm-panel);
                    border: 1px solid var(--cm-line);
                    border-radius: 8px;
                    box-shadow: 0 12px 24px rgba(20,20,18,.12);
                }
                .cm-suggest button {
                    width: 100%;
                    border: 0;
                    background: transparent;
                    text-align: left;
                    padding: 9px 11px;
                    color: var(--cm-ink);
                    cursor: pointer;
                }
                .cm-suggest button:hover { background: rgba(0,150,107,.08); }
                .cm-create-product {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    padding: 10px;
                    margin: -2px 0 10px;
                    border: 1px dashed var(--cm-green-2);
                    border-radius: 8px;
                    background: rgba(0,150,107,.06);
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
                .cm-add-row { border-top: 1px solid var(--cm-line); padding-top: 8px; margin-top: 2px; }
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
                    .cm-gasto { grid-template-columns: 1fr 92px 64px 82px 34px; }
                    .cm-create-product { grid-template-columns: 1fr; }
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
                                value={sunatPct > 0 ? `${sunatPct.toFixed(1)}% = ${USD2(Math.max(0, rentabilidadBrutaPreview * (sunatPct / 100)))}` : '0% = USD 0.00'}
                                hint="Configurado en Administracion"
                            />
                        </div>

                        <div className="cm-products-title">Productos de la cotizacion</div>
                        <div className="cm-product-help">
                            <span><strong>Costo 0 (-10%)</strong>&nbsp;reserva 10% de margen del saldo</span>
                            <span><strong>Imp. 7%</strong>&nbsp;aparece al marcar importacion</span>
                            <span><strong>SUNAT</strong>&nbsp;solo se cobra si hay rentabilidad bruta positiva</span>
                        </div>
                        <div className="cm-searchbox">
                            <div className="cm-searchrow">
                                <input
                                    className="cm-input"
                                    placeholder="Buscar producto por marca, modelo o descripcion..."
                                    value={productQuery}
                                    onChange={e => {
                                        setProductQuery(e.target.value);
                                        setNewProduct(null);
                                    }}
                                />
                                {canManageProducts && (
                                    <button type="button" className="cm-new-product" onClick={() => setNewProduct({ marca:'', modelo:productQuery, descripcion:'', costo:'', unidad:1 })}>
                                        Nuevo
                                    </button>
                                )}
                            </div>
                            {productQuery.trim() && (
                                <div className="cm-suggest">
                                    {productMatches.map(p => (
                                        <button key={p.id} type="button" onClick={() => addProductLine(p, 'catalogo')}>
                                            <div style={{ fontWeight:700 }}>{productName(p)}</div>
                                            <div style={{ fontSize:11, color:'var(--cm-muted)' }}>{p.descripcion || 'Sin descripcion'} - {USD2(p.costo)} x {productUnits(p.unidad)}</div>
                                        </button>
                                    ))}
                                    {!productMatches.length && (
                                        <div style={{ padding:'10px 11px', fontSize:12, color:'var(--cm-muted)' }}>
                                            No hay productos con ese texto.
                                        </div>
                                    )}
                                    {canManageProducts && (
                                        <button type="button" onClick={() => setNewProduct({ marca:'', modelo:productQuery, descripcion:'', costo:'', unidad:1 })}>
                                            + Crear producto nuevo
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        {newProduct && (
                            <div className="cm-create-product">
                                <input className="cm-input" placeholder="Marca" value={newProduct.marca} onChange={e => setNewProduct(p => ({ ...p, marca:e.target.value }))} />
                                <input className="cm-input" placeholder="Modelo" value={newProduct.modelo} onChange={e => setNewProduct(p => ({ ...p, modelo:e.target.value }))} />
                                <input className="cm-input" placeholder="Descripcion" value={newProduct.descripcion} onChange={e => setNewProduct(p => ({ ...p, descripcion:e.target.value }))} />
                                <input className="cm-input amount" type="number" min="0" step="0.01" placeholder="Costo unit." value={newProduct.costo} onChange={e => setNewProduct(p => ({ ...p, costo:e.target.value }))} />
                                <input className="cm-input amount" type="number" min="1" step="1" placeholder="Unid." value={newProduct.unidad} onChange={e => setNewProduct(p => ({ ...p, unidad:productUnits(e.target.value) }))} />
                                <button type="button" className="cm-add" onClick={createProductFromCalculator}>Guardar producto</button>
                            </div>
                        )}
                        {gastos.map((g, i) => (
                            <div key={i} className="cm-gasto">
                                <div className="cm-product-main">
                                    <div className="cm-product-name">{g.nombre || [g.marca, g.modelo].filter(Boolean).join(' ') || 'Producto'}</div>
                                    <div className="cm-product-sub">
                                        {[g.marca, g.modelo, g.descripcion || g.notas].filter(Boolean).join(' - ')}
                                        {` - ${USD2(parseFloat(g.costo || g.monto) || 0)} x ${productUnits(g.unidad)}`}
                                        {productUnitCost(g) === 0 ? ` - Costo 0 (-10%): ${USD2(effectiveProductCost(g, facturacion, zeroUnitCost))}` : ''}
                                        {g.importacion ? ` - imp. 7%: ${USD2(importCost(g, facturacion, zeroUnitCost))}` : ''}
                                    </div>
                                </div>
                                <input className="cm-input amount" type="number" min="0" step="0.01" placeholder="Costo unit." value={g.costo}
                                    onChange={e => setGasto(i, 'costo', e.target.value)} />
                                <input className="cm-input amount" type="number" min="1" step="1" placeholder="Unid." value={productUnits(g.unidad)}
                                    onChange={e => setGasto(i, 'unidad', e.target.value)} />
                                <label className="cm-import" title="Importacion: suma 7% del costo calculado de esta linea">
                                    <input type="checkbox" checked={!!g.importacion} onChange={e => setGasto(i, 'importacion', e.target.checked)} />
                                    Imp. 7%
                                </label>
                                <button type="button" className="cm-remove" onClick={() => removeGasto(i)}>x</button>
                            </div>
                        ))}
                        {!gastos.length && (
                            <div className="cm-add-row" style={{ fontSize:12, color:'var(--cm-muted)' }}>
                                Busca un producto para agregarlo al calculo.
                            </div>
                        )}

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
                            {productosCostoCeroTotal > 0 && (
                                <CalcRow label="  Costo 0 (-10%)" value={USD2(productosCostoCeroTotal)} tone="red" />
                            )}
                            {hasImportacion && (
                                <CalcRow label="  Importacion 7%" value={USD2(importacionTotal)} tone={importacionTotal > 0 ? 'red' : undefined} />
                            )}
                            <CalcRow label="= Rentabilidad Bruta" value={USD2(calc.rentabilidad_bruta)} tone={calc.rentabilidad_bruta >= 0 ? 'green' : 'red'} strong />
                            {sunatPct > 0 && (
                                <CalcRow label={`- SUNAT (${sunatPct.toFixed(1)}%)`} value={USD2(calc.sunatMonto)} tone={calc.sunatMonto > 0 ? 'red' : undefined} />
                            )}
                            <div className="cm-rule" />
                            <CalcRow label="= Rentabilidad neta" value={USD2(calc.rentabilidad)} tone={calc.rentabilidad >= 0 ? 'green' : 'red'} strong />
                            <CalcRow label="Margen obtenido" value={`${calc.margen_pct.toFixed(2)}%`} tone={calc.margen_pct >= MARGEN_MINIMO ? 'green' : 'red'} strong />
                            <div className="cm-rule" />
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
                            <CalcRow label="Escala vigente" value="2%-14% = 2%  - 15%-19% = 7% - 20%+ = 8%" />
                            <CalcRow label="Monto de comision" value={fmt$(calc.monto_comision)} tone={calc.monto_comision > 0 ? 'green' : undefined} strong />
                            <div className="cm-message">
                                {calc.pct_comision > 0 ? 'Comision aplicada correctamente segun tramo vigente.' : calc.mensaje}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cm-foot">
                    <div className="cm-esc">Usa <kbd>x</kbd> o guardar para cerrar</div>
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
