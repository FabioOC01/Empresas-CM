import { useTheme } from '../context/ThemeContext';

export const CHANGELOG_VERSION = 6;

const VANTIO_2_URL = 'http://192.168.1.51:5176/';

const CHANGES = [
    { label: 'Dashboard', text: 'Resumen por vendedor, filtros por rol o vendedor y avance de metas mas facil de leer.' },
    { label: 'Planificador', text: 'Busqueda, ordenamiento y lectura de actividades mas rapida para el trabajo diario.' },
    { label: 'Comisiones', text: 'Calculadora revisada con catalogo de productos y detalles de rentabilidad mas claros.' },
    { label: 'Rentabilidad', text: 'Mejor adaptacion a pantallas pequenas, con tarjetas de detalle para evitar tablas incomodas.' },
];

export default function ChangelogModal({ open, onClose }) {
    const tk = useTheme();
    if (!open) return null;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(7,13,25,0.68)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500,
            padding: 14,
        }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{
                borderRadius: 14, width: 560, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto',
                boxShadow: '0 24px 70px rgba(0,0,0,0.38)',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #0f766e 0%, #0f4c81 100%)',
                    padding: '24px 26px 22px',
                    borderRadius: '14px 14px 0 0',
                    color: '#fff',
                }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', border: '1px solid rgba(255,255,255,0.32)',
                        borderRadius: 999, background: 'rgba(255,255,255,0.12)',
                        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
                        marginBottom: 14,
                    }}>
                        Marcha blanca
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: 0 }}>
                        VANTIO 2.0
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>
                        Ya esta disponible para pruebas
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 12, color: 'rgba(255,255,255,0.88)', maxWidth: 470 }}>
                        Pueden ingresar, recorrer la nueva version y enviarnos su feedback. Sus comentarios nos ayudan a priorizar las mejoras finales.
                    </div>
                </div>

                <div style={{ padding: '18px 24px 8px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: tk.txt2, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>
                        Tambien encontraras
                    </div>
                    <div style={{ display: 'grid', gap: 9 }}>
                        {CHANGES.map((c) => (
                            <div key={c.label} style={{
                                display: 'grid', gridTemplateColumns: '106px 1fr', gap: 10, alignItems: 'start',
                                padding: '10px 12px', background: tk.card2, borderRadius: 8,
                                border: `1px solid ${tk.bdr}`,
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 900, color: '#0f766e', lineHeight: 1.45 }}>{c.label}</span>
                                <span style={{ fontSize: 13, color: tk.txt, lineHeight: 1.45 }}>{c.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '16px 24px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 18px', background: tk.card2, color: tk.txt,
                        border: `1px solid ${tk.bdr}`, borderRadius: 9, fontWeight: 800, fontSize: 13,
                        cursor: 'pointer',
                    }}>
                        Luego
                    </button>
                    <a href={VANTIO_2_URL} target="_blank" rel="noreferrer" style={{
                        padding: '10px 20px', background: '#0f766e', color: '#fff',
                        border: '1px solid #0f766e', borderRadius: 9, fontWeight: 900, fontSize: 13,
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 18px rgba(15,118,110,0.28)',
                    }}>
                        Probar Vantio 2.0
                    </a>
                </div>
            </div>
        </div>
    );
}
