import { useState, useRef, useEffect } from 'react';
import { MESES, Q_MAP } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';

const PULSE_KEYFRAMES = `
@keyframes ppPulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
  70%  { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(16,185,129,0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(16,185,129,0); }
}`;

export default function PeriodoPicker({ trim = '', mes = '', año = '', onTrim, onMes, onAño, showAño = false }) {
    const tk  = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const label    = mes ? mes.slice(0, 3) : trim ? `Q${trim}${año ? ' '+año : ''}` : año ? año : 'Período';
    const hasFilter = !!(trim || mes || año);

    // Q actual
    const mesActualIdx = new Date().getMonth();
    const qActual = Object.entries(Q_MAP).find(([, idxs]) => idxs.includes(mesActualIdx))?.[0];

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${hasFilter ? '#10b981' : tk.bdr}`,
                    background: hasFilter ? '#10b98120' : tk.card,
                    color: hasFilter ? '#10b981' : tk.txt2,
                    fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}
            >
                📅 {label} {open ? '▴' : '▾'}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                    background: tk.card, border: `1px solid ${tk.bdr}`, borderRadius: 10,
                    padding: '14px', boxShadow: tk.isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)', minWidth: 280,
                }}>
                    {showAño && (
                        <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Año</div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                                {['2026'].map(y => (
                                    <button key={y} onClick={() => { onAño && onAño(año === y ? '' : y); }}
                                        style={{
                                            flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                                            fontWeight: 700, fontSize: 13,
                                            background: año === y ? '#10b981' : tk.card2,
                                            color: año === y ? '#fff' : tk.txt,
                                        }}>
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Q */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Trimestre</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        {['1','2','3','4'].map(q => (
                            <button key={q} onClick={() => { onTrim(trim === q ? '' : q); onMes(''); }}
                                style={{
                                    flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                                    fontWeight: 700, fontSize: 13,
                                    background: trim === q ? '#10b981' : tk.card2,
                                    color: trim === q ? '#fff' : tk.txt,
                                }}>
                                Q{q}
                            </button>
                        ))}
                    </div>

                    {/* Mes */}
                    <style>{PULSE_KEYFRAMES}</style>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mes</div>
                        {qActual && (
                            <div style={{
                                fontSize: 10, fontWeight: 800, color: '#fff',
                                background: '#10b981', padding: '3px 9px', borderRadius: 12,
                                letterSpacing: 0.5,
                                animation: 'ppPulse 1.8s ease-in-out infinite',
                            }}>
                                Q{qActual}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                        {MESES.map((m, i) => {
                            const enQActual = qActual && Q_MAP[qActual].includes(i);
                            return (
                                <button key={m} onClick={() => { onMes(mes === m ? '' : m); onTrim(''); }}
                                    style={{
                                        padding: '5px 0', borderRadius: 6, border: enQActual ? '1px solid #10b981' : 'none', cursor: 'pointer',
                                        fontSize: 11, fontWeight: 600,
                                        background: mes === m ? '#10b981' : (enQActual ? '#10b98118' : tk.card2),
                                        color: mes === m ? '#fff' : tk.txt,
                                    }}>
                                    {m.slice(0, 3)}
                                </button>
                            );
                        })}
                    </div>

                    {hasFilter && (
                        <button onClick={() => { onTrim(''); onMes(''); onAño && onAño(''); setOpen(false); }}
                            style={{ marginTop: 10, width: '100%', padding: '7px', border: 'none', borderRadius: 7, background: '#e74c3c22', color: '#e74c3c', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            ✕ Limpiar período
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
