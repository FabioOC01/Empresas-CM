export default function KpiCard({ label, value, sub, accent }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 10, padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            borderLeft: `4px solid ${accent || '#2f6fd4'}`,
        }}>
            <div style={{ fontSize: 11, color: '#6b7a8d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2a3b', margin: '6px 0 2px' }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 12, color: '#8899aa' }}>{sub}</div>}
        </div>
    );
}
