export default function Avatar({ vendedor, size = 'sm' }) {
    if (!vendedor) return null;
    const dim = size === 'xl' ? 56 : size === 'lg' ? 44 : 28;
    const baseStyle = {
        width: dim, height: dim, borderRadius: '50%',
        flexShrink: 0, display: 'inline-flex',
    };

    if (vendedor.foto_url) {
        return (
            <img
                src={vendedor.foto_url}
                alt={vendedor.nombre}
                style={{ ...baseStyle, objectFit: 'cover' }}
            />
        );
    }

    return (
        <span style={{
            ...baseStyle,
            alignItems: 'center', justifyContent: 'center',
            background: vendedor.color, color: '#fff',
            fontWeight: 700, fontSize: size === 'xl' ? 18 : size === 'lg' ? 15 : 11,
        }}>
            {vendedor.iniciales}
        </span>
    );
}
