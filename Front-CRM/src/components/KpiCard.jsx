const VARIANTS = {
    accent: { color: 'var(--accent)',  bg: 'var(--accent-glow)',  border: 'var(--accent-border)' },
    blue:   { color: 'var(--blue)',    bg: 'var(--blue-glow)',    border: 'var(--blue-glow)' },
    purple: { color: 'var(--purple)',  bg: 'var(--purple-glow)',  border: 'var(--purple-glow)' },
    orange: { color: 'var(--orange)',  bg: 'rgba(251,146,60,0.13)', border: 'rgba(251,146,60,0.25)' },
    warning:{ color: 'var(--warning)', bg: 'var(--color-yellow-bg)', border: 'var(--color-yellow)' },
    danger: { color: 'var(--danger)',  bg: 'var(--danger-glow)',  border: 'var(--color-red)' },
};

export default function KpiCard({ label, value, sub, icon, variant = 'accent', accent }) {
    // Compat: si pasan `accent` hex, lo usamos como color plano
    const v = VARIANTS[variant] || VARIANTS.accent;
    const plain = accent && !VARIANTS[variant];
    const color   = plain ? accent : v.color;
    const bg      = plain ? accent + '22' : v.bg;
    const border  = plain ? accent + '55' : v.border;

    return (
        <div className="card kpi-card" style={{
            padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
            borderLeft: `3px solid ${color}`,
        }}>
            {icon && (
                <div className="kpi-icon" style={{
                    background: bg,
                    color,
                    border: `1px solid ${border}`,
                }}>{icon}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heavy)', margin: '4px 0 2px', letterSpacing: -0.3 }}>
                    {value}
                </div>
                {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
            </div>
        </div>
    );
}
