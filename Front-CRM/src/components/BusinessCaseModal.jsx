import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
    BC_BLOCKS,
    calculateBusinessCase,
    emptyBusinessCase,
    lineCosto,
    linePrecio,
    linePrecioUnit,
    newBusinessCaseLine,
    normalizeBusinessCase,
    sampleBusinessCase,
    toStoredBusinessCase,
} from '../utils/businessCase';

const USD2 = n => new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
}).format(Number(n) || 0);

const PCT1 = n => `${(Number(n) || 0).toFixed(1)}%`;

function readBusinessCase(value) {
    if (typeof value === 'string') {
        try { return normalizeBusinessCase(JSON.parse(value)); } catch { return emptyBusinessCase(); }
    }
    return normalizeBusinessCase(value);
}

export default function BusinessCaseModal({ open, actividad, vendedor, moneda = 'USD', readOnly = false, onClose, onSave }) {
    const tk = useTheme();
    const [draft, setDraft] = useState(emptyBusinessCase);
    const [collapsed, setCollapsed] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        if (!open) return;
        setDraft(readBusinessCase(actividad?.business_case));
        setCollapsed({});
        setMsg(null);
    }, [open, actividad?.id, actividad?.business_case]);

    const calc = useMemo(() => calculateBusinessCase(draft), [draft]);
    const fmt = n => moneda === 'USD' ? USD2(n) : `${moneda} ${(Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!open || !actividad) return null;

    const setField = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));
    const setLine = (block, id, field, value) => setDraft(prev => ({
        ...prev,
        bloques: {
            ...prev.bloques,
            [block]: prev.bloques[block].map(line => line.id === id ? { ...line, [field]: value } : line),
        },
    }));
    const addLine = (block) => setDraft(prev => ({
        ...prev,
        bloques: {
            ...prev.bloques,
            [block]: [...prev.bloques[block], newBusinessCaseLine()],
        },
    }));
    const removeLine = (block, id) => setDraft(prev => ({
        ...prev,
        bloques: {
            ...prev.bloques,
            [block]: prev.bloques[block].filter(line => line.id !== id),
        },
    }));
    const toggleCollapsed = block => setCollapsed(prev => ({ ...prev, [block]: !prev[block] }));

    const handleSave = async () => {
        if (readOnly || !onSave) return;
        const stored = toStoredBusinessCase(draft);
        setSaving(true);
        setMsg(null);
        try {
            await onSave({
                id: actividad.id,
                business_case: stored,
                monto: stored.snapshot.precioTotal,
                precio_venta: stored.snapshot.precioTotal,
            });
            setDraft(stored);
            setMsg({ type: 'ok', text: 'BC guardado y monto actualizado.' });
            setTimeout(() => setMsg(null), 2800);
        } catch {
            setMsg({ type: 'err', text: 'No se pudo guardar el BC.' });
        } finally {
            setSaving(false);
        }
    };

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify(toStoredBusinessCase(draft), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `business-case-${actividad.id}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 100);
    };

    const exportPDF = () => printBusinessCase({
        actividad,
        vendedor,
        calc,
        moneda,
        fmt,
    });

    const discountInfo = block => {
        if (block === 'plataforma' || block === 'licencias') return { all: calc.descLicAll, label: 'Desc. lic.' };
        if (block === 'servicios') return { all: calc.descSrvAll, label: 'Desc. serv.' };
        return null;
    };

    return (
        <div className="bc-ovl">
            <style>{`
                .bc-ovl {
                    position: fixed;
                    inset: 0;
                    z-index: 1120;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px;
                    background: rgba(17,23,22,.44);
                    backdrop-filter: blur(4px);
                }
                .bc-md {
                    --bc-bg: #f6f7f4;
                    --bc-panel: #fff;
                    --bc-panel-2: #fbfbf8;
                    --bc-line: #e4e5de;
                    --bc-line-2: #cde8dc;
                    --bc-ink: #171816;
                    --bc-muted: #6f756d;
                    --bc-faint: #92978e;
                    --bc-green: #087f5b;
                    --bc-green-2: #10b981;
                    --bc-red: #c0392b;
                    --bc-blue: #2f6bd1;
                    width: min(1240px, calc(100vw - 16px));
                    max-height: calc(100vh - 16px);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: var(--bc-bg);
                    color: var(--bc-ink);
                    border: 1px solid var(--bc-line-2);
                    border-radius: 11px;
                    box-shadow: 0 24px 70px rgba(0,0,0,.34);
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                [data-theme="dark"] .bc-md {
                    --bc-bg: ${tk.bg};
                    --bc-panel: ${tk.card};
                    --bc-panel-2: ${tk.card2};
                    --bc-line: ${tk.bdr};
                    --bc-line-2: ${tk.bdr};
                    --bc-ink: ${tk.txt};
                    --bc-muted: ${tk.txt2};
                    --bc-faint: ${tk.txt3};
                    --bc-green: #34d399;
                    --bc-green-2: #10b981;
                    --bc-blue: #7aa2ff;
                }
                .bc-md * { box-sizing: border-box; }
                .bc-head {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 12px;
                    align-items: center;
                    padding: 14px 18px;
                    border-bottom: 1px solid var(--bc-line-2);
                    background: linear-gradient(180deg, #ecfdf5 0%, #f7fffb 100%);
                }
                [data-theme="dark"] .bc-head { background: var(--bc-panel-2); }
                .bc-eyebrow {
                    color: var(--bc-green);
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: .08em;
                    text-transform: uppercase;
                }
                .bc-title {
                    margin-top: 3px;
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--bc-ink);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .bc-sub { margin-top: 4px; font-size: 12px; color: var(--bc-muted); }
                .bc-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
                .bc-btn {
                    height: 34px;
                    padding: 0 12px;
                    border: 1px solid var(--bc-line);
                    border-radius: 8px;
                    background: var(--bc-panel);
                    color: var(--bc-ink);
                    font: inherit;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .bc-btn:hover { border-color: var(--bc-green-2); color: var(--bc-green); }
                .bc-btn.primary {
                    border-color: var(--bc-green-2);
                    background: linear-gradient(180deg, #10b981, #05845f);
                    color: #fff;
                    box-shadow: 0 8px 16px rgba(5,132,95,.22);
                }
                .bc-btn.danger { color: var(--bc-red); }
                .bc-btn:disabled { opacity: .58; cursor: default; }
                .bc-x {
                    width: 34px;
                    padding: 0;
                    font-size: 18px;
                    line-height: 1;
                }
                .bc-kpis {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--bc-line);
                    background: var(--bc-panel-2);
                }
                .bc-kpi {
                    min-width: 0;
                    padding: 10px 12px;
                    border: 1px solid var(--bc-line);
                    border-radius: 8px;
                    background: var(--bc-panel);
                    box-shadow: 0 8px 22px rgba(20,20,18,.055);
                }
                [data-theme="dark"] .bc-kpi { box-shadow: none; }
                .bc-kpi .lbl {
                    font-size: 10px;
                    color: var(--bc-faint);
                    text-transform: uppercase;
                    letter-spacing: .06em;
                    font-weight: 800;
                    margin-bottom: 3px;
                }
                .bc-kpi .val {
                    color: var(--bc-ink);
                    font-size: 18px;
                    font-weight: 800;
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .bc-kpi.profit .val { color: var(--bc-green); }
                .bc-body {
                    min-height: 0;
                    overflow: auto;
                    display: grid;
                    grid-template-columns: minmax(420px, .92fr) minmax(500px, 1.08fr);
                    gap: 0;
                }
                .bc-left, .bc-right { padding: 14px; min-width: 0; }
                .bc-right { border-left: 1px solid var(--bc-line); }
                .bc-globals {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 8px;
                    margin-bottom: 10px;
                }
                .bc-field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0;
                }
                .bc-field label {
                    color: var(--bc-muted);
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: .05em;
                }
                .bc-input {
                    width: 100%;
                    height: 34px;
                    padding: 0 9px;
                    border: 1px solid var(--bc-line);
                    border-radius: 7px;
                    background: var(--bc-panel);
                    color: var(--bc-ink);
                    font: inherit;
                    font-size: 13px;
                    outline: none;
                }
                .bc-input:focus { border-color: var(--bc-green-2); box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
                .bc-check {
                    height: 34px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    border: 1px solid var(--bc-line);
                    border-radius: 7px;
                    background: var(--bc-panel);
                    color: var(--bc-muted);
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    user-select: none;
                }
                .bc-check.on {
                    border-color: var(--bc-green-2);
                    background: rgba(16,185,129,.12);
                    color: var(--bc-green);
                }
                .bc-card {
                    margin-bottom: 9px;
                    border: 1px solid var(--bc-line);
                    border-radius: 9px;
                    overflow: hidden;
                    background: var(--bc-panel);
                }
                .bc-card-h {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    min-height: 38px;
                    padding: 0 12px;
                    border-left: 4px solid var(--accent);
                    cursor: pointer;
                    background: var(--bc-panel);
                }
                .bc-card-h strong {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: var(--bc-ink);
                }
                .bc-card-h strong::before {
                    content: "";
                    width: 8px;
                    height: 8px;
                    border-radius: 2px;
                    background: var(--accent);
                }
                .bc-count {
                    color: var(--bc-faint);
                    font-size: 11px;
                    font-weight: 800;
                    background: var(--bc-panel-2);
                    border-radius: 999px;
                    padding: 3px 8px;
                }
                .bc-card-b { padding: 10px; }
                .bc-line {
                    display: grid;
                    grid-template-columns: minmax(150px, 1fr) 86px 66px 74px auto 28px;
                    gap: 6px;
                    align-items: center;
                    padding: 7px;
                    border: 1px solid var(--bc-line);
                    border-radius: 8px;
                    background: var(--bc-panel-2);
                    margin-bottom: 7px;
                }
                .bc-line .bc-input { height: 30px; font-size: 12px; }
                .bc-line .num { text-align: right; font-variant-numeric: tabular-nums; }
                .bc-del {
                    width: 28px;
                    height: 28px;
                    border: 0;
                    border-radius: 7px;
                    background: transparent;
                    color: var(--bc-faint);
                    cursor: pointer;
                    font-weight: 900;
                }
                .bc-del:hover { background: rgba(192,57,43,.12); color: var(--bc-red); }
                .bc-add {
                    width: 100%;
                    height: 32px;
                    border: 1px dashed var(--accent);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--accent);
                    font: inherit;
                    font-size: 12px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .bc-empty {
                    padding: 18px;
                    text-align: center;
                    color: var(--bc-faint);
                    font-size: 12px;
                    border: 1px dashed var(--bc-line);
                    border-radius: 8px;
                    margin-bottom: 7px;
                }
                .bc-quote {
                    width: 100%;
                    border-collapse: collapse;
                    font-variant-numeric: tabular-nums;
                    background: var(--bc-panel);
                    border: 1px solid var(--bc-line);
                    border-radius: 9px;
                    overflow: hidden;
                }
                .bc-quote th {
                    padding: 9px 10px;
                    text-align: left;
                    color: #fff;
                    background: #31363d;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: .05em;
                }
                .bc-quote th.r, .bc-quote td.r { text-align: right; }
                .bc-quote th.c, .bc-quote td.c { text-align: center; }
                .bc-quote td {
                    padding: 7px 10px;
                    border-bottom: 1px solid var(--bc-line);
                    color: var(--bc-ink);
                    font-size: 12px;
                }
                .bc-quote .section td {
                    color: #fff;
                    background: var(--accent);
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: .06em;
                    font-size: 10px;
                    border-bottom: 0;
                }
                .bc-quote .subtotal td { background: var(--bc-panel-2); font-weight: 800; }
                .bc-quote .discount td { background: rgba(192,57,43,.10); color: var(--bc-red); font-weight: 800; }
                .bc-quote .total td { background: rgba(16,185,129,.13); color: var(--bc-green); font-weight: 900; }
                .bc-quote .grand td { background: #31363d; color: #fff; font-weight: 900; font-size: 13px; }
                .bc-quote .profit td { background: #10b981; color: #fff; font-weight: 900; font-size: 13px; }
                .bc-msg { font-size: 12px; font-weight: 800; }
                .bc-msg.ok { color: var(--bc-green); }
                .bc-msg.err { color: var(--bc-red); }
                @media (max-width: 980px) {
                    .bc-body { grid-template-columns: 1fr; }
                    .bc-right { border-left: 0; border-top: 1px solid var(--bc-line); }
                    .bc-globals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .bc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 620px) {
                    .bc-head { grid-template-columns: 1fr; }
                    .bc-actions { justify-content: flex-start; }
                    .bc-line { grid-template-columns: 1fr 72px 54px 62px; }
                    .bc-line .bc-check, .bc-line .bc-del { grid-column: span 2; width: 100%; }
                }
            `}</style>
            <div className="bc-md" onClick={e => e.stopPropagation()}>
                <div className="bc-head">
                    <div>
                        <div className="bc-eyebrow">Business Case ITAM / ITSM</div>
                        <div className="bc-title">{actividad.nombre}</div>
                        <div className="bc-sub">{actividad.cliente || 'Sin cliente'} · {vendedor?.nombre || 'Sin vendedor'} · {readOnly ? 'Solo lectura' : 'Editable'}</div>
                    </div>
                    <div className="bc-actions">
                        {!readOnly && <button type="button" className="bc-btn" onClick={() => setDraft(sampleBusinessCase())}>Cargar ejemplo</button>}
                        {!readOnly && <button type="button" className="bc-btn danger" onClick={() => setDraft(emptyBusinessCase())}>Vaciar</button>}
                        <button type="button" className="bc-btn" onClick={exportJSON}>JSON</button>
                        <button type="button" className="bc-btn" onClick={exportPDF}>PDF</button>
                        {!readOnly && <button type="button" className="bc-btn primary" disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar BC'}</button>}
                        <button type="button" className="bc-btn bc-x" onClick={onClose} aria-label="Cerrar">x</button>
                    </div>
                    {msg && <div className={`bc-msg ${msg.type}`}>{msg.text}</div>}
                </div>

                <div className="bc-kpis">
                    <Kpi label="Costo real total" value={fmt(calc.snapshot.costoTotal)} />
                    <Kpi label="Precio total cliente" value={fmt(calc.snapshot.precioTotal)} />
                    <Kpi label="Profit" value={fmt(calc.snapshot.profit)} tone="profit" />
                    <Kpi label="Margen efectivo" value={PCT1(calc.snapshot.margenEf)} />
                </div>

                <div className="bc-body">
                    <div className="bc-left">
                        <div className="bc-globals">
                            <Field label="Meses">
                                <input className="bc-input" type="number" min="1" step="1" value={draft.meses} disabled={readOnly} onChange={e => setField('meses', e.target.value)} />
                            </Field>
                            <Field label="Activos">
                                <input className="bc-input" type="number" min="0" step="1" value={draft.activos} disabled={readOnly} onChange={e => setField('activos', e.target.value)} />
                            </Field>
                            <Field label="Desc. lic. %">
                                <input className="bc-input" type="number" min="0" max="100" step="0.1" value={draft.descLic} disabled={readOnly} onChange={e => setField('descLic', e.target.value)} />
                            </Field>
                            <Field label="Desc. serv. %">
                                <input className="bc-input" type="number" min="0" max="100" step="0.1" value={draft.descSrv} disabled={readOnly} onChange={e => setField('descSrv', e.target.value)} />
                            </Field>
                            <Field label="Licenciamiento">
                                <Check checked={draft.descLicAll} disabled={readOnly} onChange={v => setField('descLicAll', v)}>Aplicar a todo</Check>
                            </Field>
                            <Field label="Servicios">
                                <Check checked={draft.descSrvAll} disabled={readOnly} onChange={v => setField('descSrvAll', v)}>Aplicar a todo</Check>
                            </Field>
                        </div>

                        {BC_BLOCKS.map(block => {
                            const lines = draft.bloques[block.key] || [];
                            const desc = discountInfo(block.key);
                            return (
                                <div key={block.key} className="bc-card" style={{ '--accent': block.color }}>
                                    <div className="bc-card-h" onClick={() => toggleCollapsed(block.key)}>
                                        <strong>{block.label}</strong>
                                        <span className="bc-count">{lines.length} items</span>
                                    </div>
                                    {!collapsed[block.key] && (
                                        <div className="bc-card-b">
                                            {!lines.length && <div className="bc-empty">Sin lineas agregadas</div>}
                                            {lines.map(line => (
                                                <div key={line.id} className="bc-line">
                                                    <input className="bc-input" placeholder="Concepto" value={line.nombre} disabled={readOnly} onChange={e => setLine(block.key, line.id, 'nombre', e.target.value)} />
                                                    <input className="bc-input num" type="number" min="0" step="0.01" value={line.costo} disabled={readOnly} onChange={e => setLine(block.key, line.id, 'costo', e.target.value)} />
                                                    <input className="bc-input num" type="number" min="0" step="1" value={line.qty} disabled={readOnly} onChange={e => setLine(block.key, line.id, 'qty', e.target.value)} />
                                                    <input className="bc-input num" type="number" min="0" max="99" step="0.1" value={line.margen} disabled={readOnly} onChange={e => setLine(block.key, line.id, 'margen', e.target.value)} />
                                                    <div style={{ display:'flex', gap:6 }}>
                                                        <Check checked={line.rec} disabled={readOnly} onChange={v => setLine(block.key, line.id, 'rec', v)}>Meses</Check>
                                                        {desc && !desc.all && <Check checked={line.desc !== false} disabled={readOnly} onChange={v => setLine(block.key, line.id, 'desc', v)}>{desc.label}</Check>}
                                                    </div>
                                                    {!readOnly && <button type="button" className="bc-del" onClick={() => removeLine(block.key, line.id)}>x</button>}
                                                </div>
                                            ))}
                                            {!readOnly && <button type="button" className="bc-add" onClick={() => addLine(block.key)}>+ Agregar linea</button>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="bc-right">
                        <Quote calc={calc} fmt={fmt} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return <div className="bc-field"><label>{label}</label>{children}</div>;
}

function Check({ checked, disabled, onChange, children }) {
    return (
        <label className={`bc-check ${checked ? 'on' : ''}`}>
            <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
            {children}
        </label>
    );
}

function Kpi({ label, value, tone }) {
    return <div className={`bc-kpi ${tone || ''}`}><div className="lbl">{label}</div><div className="val">{value}</div></div>;
}

function Quote({ calc, fmt }) {
    return (
        <table className="bc-quote">
            <thead>
                <tr>
                    <th>Concepto</th>
                    <th className="r">Costo</th>
                    <th className="c">Margen</th>
                    <th className="r">Precio c/ margen</th>
                    <th className="r">Precio unitario</th>
                </tr>
            </thead>
            <tbody>
                {BC_BLOCKS.filter(b => b.key !== 'personal').map(block => (
                    <BlockRows key={block.key} block={block} calc={calc} fmt={fmt} />
                ))}
                {(calc.dLicMonto > 0 || calc.dSrvMonto > 0) && (
                    <>
                        <tr className="section" style={{ '--accent': '#C0392B' }}><td colSpan="5">Descuentos comerciales</td></tr>
                        {calc.dLicMonto > 0 && <tr className="discount"><td>Desc. licenciamiento ({calc.descLic}% s/ base {fmt(calc.baseLicDesc)})</td><td className="r">-{fmt(calc.dLicMonto)}</td><td /><td className="r">-{fmt(calc.dLicMonto)}</td><td /></tr>}
                        {calc.dSrvMonto > 0 && <tr className="discount"><td>Desc. servicios ({calc.descSrv}% s/ base {fmt(calc.baseSrvDesc)})</td><td className="r">-{fmt(calc.dSrvMonto)}</td><td /><td className="r">-{fmt(calc.dSrvMonto)}</td><td /></tr>}
                    </>
                )}
                <tr className="subtotal"><td>Subtotal (Plataforma + Licencias + Servicios)</td><td className="r">{fmt(calc.totGlpiCosto)}</td><td /><td className="r">{fmt(calc.totGlpiPrecio)}</td><td /></tr>
                <tr className="total"><td>TOTAL</td><td className="r">{fmt(calc.totGlpiCosto)}</td><td /><td className="r">{fmt(calc.totGlpiPrecio)}</td><td /></tr>
                <BlockRows block={BC_BLOCKS.find(b => b.key === 'personal')} calc={calc} fmt={fmt} />
                <tr className="grand"><td>PRECIO TOTAL CLIENTE</td><td className="r">{fmt(calc.snapshot.costoTotal)}</td><td /><td className="r">{fmt(calc.snapshot.precioTotal)}</td><td /></tr>
                <tr className="profit"><td>PROFIT</td><td colSpan="3" className="r">{fmt(calc.snapshot.profit)}</td><td className="r">{PCT1(calc.snapshot.margenEf)}</td></tr>
            </tbody>
        </table>
    );
}

function BlockRows({ block, calc, fmt }) {
    const lines = calc.bloques[block.key] || [];
    return (
        <>
            <tr className="section" style={{ '--accent': block.color }}><td colSpan="5">{block.label}</td></tr>
            {lines.length ? lines.map(line => (
                <tr key={line.id}>
                    <td>{line.nombre || <i style={{ color:'var(--bc-faint)' }}>sin nombre</i>}{line.rec ? <span style={{ color:'var(--bc-faint)', fontSize:11 }}> x{calc.meses}m</span> : null}</td>
                    <td className="r">{fmt(lineCosto(line, calc.meses))}</td>
                    <td className="c">{PCT1(line.margen)}</td>
                    <td className="r">{fmt(linePrecio(line, calc.meses))}</td>
                    <td className="r">{fmt(linePrecioUnit(line))}</td>
                </tr>
            )) : <tr><td colSpan="5" style={{ color:'var(--bc-faint)', textAlign:'center', fontStyle:'italic' }}>Sin lineas agregadas</td></tr>}
            {lines.length > 0 && (
                <tr className="subtotal">
                    <td>Subtotal {block.label}</td>
                    <td className="r">{fmt(calc.totals[block.key]?.costo || 0)}</td>
                    <td />
                    <td className="r">{fmt(calc.totals[block.key]?.precio || 0)}</td>
                    <td />
                </tr>
            )}
        </>
    );
}

function printBusinessCase({ actividad, vendedor, calc, moneda, fmt }) {
    const fecha = new Date().toLocaleDateString('es-PE', { year:'numeric', month:'long', day:'numeric' });
    const rows = [];
    BC_BLOCKS.filter(b => b.key !== 'personal').forEach(block => addPrintBlock(rows, block, calc, fmt));
    if (calc.dLicMonto > 0 || calc.dSrvMonto > 0) {
        rows.push(`<tr class="section discount-h"><td colspan="5">Descuentos comerciales</td></tr>`);
        if (calc.dLicMonto > 0) rows.push(`<tr class="discount"><td>Desc. licenciamiento (${calc.descLic}% s/ base ${fmt(calc.baseLicDesc)})</td><td class="r">-${fmt(calc.dLicMonto)}</td><td></td><td class="r">-${fmt(calc.dLicMonto)}</td><td></td></tr>`);
        if (calc.dSrvMonto > 0) rows.push(`<tr class="discount"><td>Desc. servicios (${calc.descSrv}% s/ base ${fmt(calc.baseSrvDesc)})</td><td class="r">-${fmt(calc.dSrvMonto)}</td><td></td><td class="r">-${fmt(calc.dSrvMonto)}</td><td></td></tr>`);
    }
    rows.push(`<tr class="subtotal"><td>Subtotal (Plataforma + Licencias + Servicios)</td><td class="r">${fmt(calc.totGlpiCosto)}</td><td></td><td class="r">${fmt(calc.totGlpiPrecio)}</td><td></td></tr>`);
    rows.push(`<tr class="total"><td>TOTAL</td><td class="r">${fmt(calc.totGlpiCosto)}</td><td></td><td class="r">${fmt(calc.totGlpiPrecio)}</td><td></td></tr>`);
    addPrintBlock(rows, BC_BLOCKS.find(b => b.key === 'personal'), calc, fmt);
    rows.push(`<tr class="grand"><td>PRECIO TOTAL CLIENTE</td><td class="r">${fmt(calc.snapshot.costoTotal)}</td><td></td><td class="r">${fmt(calc.snapshot.precioTotal)}</td><td></td></tr>`);
    rows.push(`<tr class="profit"><td>PROFIT</td><td colspan="3" class="r">${fmt(calc.snapshot.profit)}</td><td class="r">${PCT1(calc.snapshot.margenEf)}</td></tr>`);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Business Case</title><style>
        *{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;background:#fff;font-size:12px}
        .head{background:linear-gradient(135deg,#12385f,#2f6bd1);color:#fff;padding:24px 32px}
        .brand{font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.7}.title{font-size:26px;font-weight:800;margin-top:4px}.sub{opacity:.78;margin-top:6px}
        .meta{display:flex;gap:24px;border-top:1px solid rgba(255,255,255,.22);margin-top:16px;padding-top:12px}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e5e7eb}.kpi{padding:14px 20px;border-right:1px solid #e5e7eb}.kpi:last-child{border-right:0}.lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.val{font-size:18px;font-weight:800;margin-top:4px}
        .wrap{padding:22px 32px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{background:#2d3748;color:#fff;text-align:left;padding:9px 11px;font-size:9px;text-transform:uppercase;letter-spacing:.06em}td{padding:7px 11px;border-bottom:1px solid #edf2f7}td.r,th.r{text-align:right}td.c,th.c{text-align:center}
        .section td{background:var(--accent);color:#fff;font-weight:800;text-transform:uppercase;font-size:9px;letter-spacing:.07em}.discount-h td{background:#fee2e2;color:#b91c1c}.subtotal td{background:#f3f4f6;font-weight:800}.discount td{background:#fff5f5;color:#c53030;font-weight:700}.total td{background:#dcfce7;color:#166534;font-weight:800}.grand td{background:#1f2937;color:#fff;font-weight:900;font-size:13px}.profit td{background:#10b981;color:#fff;font-weight:900;font-size:13px}
        .foot{margin:0 32px;padding:12px 0;border-top:1px solid #e5e7eb;color:#94a3b8;display:flex;justify-content:space-between}
        @media print{@page{margin:8mm 10mm;size:A4}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body>
        <div class="head"><div class="brand">Business Case · ITAM / ITSM</div><div class="title">Cotización Comercial</div><div class="sub">${escapeHtml(actividad.nombre)} · ${escapeHtml(actividad.cliente || 'Sin cliente')} · ${escapeHtml(vendedor?.nombre || 'Sin vendedor')}</div><div class="meta"><span>Periodo: <b>${calc.meses} meses</b></span><span>Activos: <b>${Number(calc.activos || 0).toLocaleString('es-PE')}</b></span><span>Moneda: <b>${escapeHtml(moneda)}</b></span></div></div>
        <div class="kpis"><div class="kpi"><div class="lbl">Costo real total</div><div class="val">${fmt(calc.snapshot.costoTotal)}</div></div><div class="kpi"><div class="lbl">Precio total cliente</div><div class="val">${fmt(calc.snapshot.precioTotal)}</div></div><div class="kpi"><div class="lbl">Profit</div><div class="val">${fmt(calc.snapshot.profit)}</div></div><div class="kpi"><div class="lbl">Margen efectivo</div><div class="val">${PCT1(calc.snapshot.margenEf)}</div></div></div>
        <div class="wrap"><table><thead><tr><th>Concepto</th><th class="r">Costo</th><th class="c">Margen</th><th class="r">Precio c/ margen</th><th class="r">Precio unitario</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
        <div class="foot"><span>Calculadora BC</span><span>Generado el ${fecha}</span></div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 350);
}

function addPrintBlock(rows, block, calc, fmt) {
    const lines = calc.bloques[block.key] || [];
    rows.push(`<tr class="section" style="--accent:${block.color}"><td colspan="5">${escapeHtml(block.label)}</td></tr>`);
    if (!lines.length) rows.push('<tr><td colspan="5" class="c"><i>Sin lineas agregadas</i></td></tr>');
    lines.forEach(line => {
        rows.push(`<tr><td>${escapeHtml(line.nombre || 'sin nombre')}${line.rec ? ` <span style="color:#94a3b8;font-size:10px">x${calc.meses}m</span>` : ''}</td><td class="r">${fmt(lineCosto(line, calc.meses))}</td><td class="c">${PCT1(line.margen)}</td><td class="r">${fmt(linePrecio(line, calc.meses))}</td><td class="r">${fmt(linePrecioUnit(line))}</td></tr>`);
    });
    if (lines.length) rows.push(`<tr class="subtotal"><td>Subtotal ${escapeHtml(block.label)}</td><td class="r">${fmt(calc.totals[block.key]?.costo || 0)}</td><td></td><td class="r">${fmt(calc.totals[block.key]?.precio || 0)}</td><td></td></tr>`);
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[ch]));
}
