export default function Avatar({ vendedor, size = 'sm' }) {
    if (!vendedor) return null;
    const dim = size === 'lg' ? 44 : 28;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: dim, height: dim, borderRadius: '50%',
            background: vendedor.color, color: '#fff',
            fontWeight: 700, fontSize: size === 'lg' ? 15 : 11,
            flexShrink: 0,
        }}>
            {vendedor.iniciales}
        </span>
    );
}
