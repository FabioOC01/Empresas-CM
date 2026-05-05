import { useTheme } from '../context/ThemeContext';

export const CHANGELOG_VERSION = 1;

const CHANGES = [
    { icon: '🎯', text: 'Nuevo filtro de período con resaltado del trimestre actual (Q animado).' },
    { icon: '📅', text: 'Mes actual por defecto + arrastre automático de actividades "En Progreso" del mes anterior.' },
    { icon: '🏁', text: 'Campo "Posible fecha de término" en cada actividad.' },
    { icon: '✅', text: 'Checklist con cronómetro por ítem (arranca al guardar la actividad).' },
    { icon: '👥', text: 'Avatares de colaboradores en tarjetas Kanban y tabla.' },
    { icon: '🗂', text: 'Kanban con columnas Ganada / Perdida (colapsables, ocultas por defecto).' },
    { icon: '🔒', text: 'Solo Admin/Gerencia pueden eliminar actividades y editar la fecha de creación.' },
    { icon: '🧭', text: 'Matriz de Equipo dividida por rol cuando un vendedor tiene múltiples roles.' },
];

export default function ChangelogModal({ open, onClose }) {
    const tk = useTheme();
    if (!open) return null;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(7,13,25,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500,
        }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{
                borderRadius: 14, width: 520, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    background: tk.isDark ? tk.card2 : '#10b98118',
                    padding: '20px 24px 16px',
                    borderRadius: '14px 14px 0 0',
                    borderBottom: `2px solid #10b98144`,
                }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                        Novedades
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tk.txt }}>
                        ¡Hay cambios nuevos! 🚀
                    </div>
                    <div style={{ fontSize: 12, color: tk.txt2, marginTop: 4 }}>
                        Estos son los últimos cambios incorporados al sistema.
                    </div>
                </div>

                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {CHANGES.map((c, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            padding: '10px 12px', background: tk.card2, borderRadius: 8,
                        }}>
                            <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{c.icon}</span>
                            <span style={{ fontSize: 13, color: tk.txt, lineHeight: 1.5 }}>{c.text}</span>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 28px', background: '#10b981', color: '#fff',
                        border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        boxShadow: '0 4px 12px #10b98144',
                    }}>
                        Entendido ✓
                    </button>
                </div>
            </div>
        </div>
    );
}
