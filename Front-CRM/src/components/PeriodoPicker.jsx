import { useState, useRef, useEffect } from 'react';
import { MESES } from '../utils/crm';
import { useTheme } from '../context/ThemeContext';

export default function PeriodoPicker({ trim = '', mes = '', onTrim, onMes }) {
    const tk  = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const label    = trim ? `Q${trim}` : mes ? mes.slice(0, 3) : 'Período';
    const hasFilter = !!(trim || mes);

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
                    <div style={{ fontSize: 10, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Mes</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                        {MESES.map(m => (
                            <button key={m} onClick={() => { onMes(mes === m ? '' : m); onTrim(''); }}
                                style={{
                                    padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 600,
                                    background: mes === m ? '#10b981' : tk.card2,
                                    color: mes === m ? '#fff' : tk.txt,
                                }}>
                                {m.slice(0, 3)}
                            </button>
                        ))}
                    </div>

                    {hasFilter && (
                        <button onClick={() => { onTrim(''); onMes(''); setOpen(false); }}
                            style={{ marginTop: 10, width: '100%', padding: '7px', border: 'none', borderRadius: 7, background: '#e74c3c22', color: '#e74c3c', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            ✕ Limpiar período
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
