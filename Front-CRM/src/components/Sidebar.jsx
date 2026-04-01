import { NavLink } from 'react-router-dom';

const LOGO_FULL = 'https://comutelperu.com/correo-cm/Logo/LOGO-BLANCO.png';
const LOGO_ISO  = 'https://comutelperu.com/correo-cm/Logo/ISO%20BLANCO.png';

const RETAIL_URL = `http://${window.location.hostname}:5173`;
// hostname se resuelve dinámicamente → funciona tanto en 172.17.0.1 como en cualquier otra IP
const GLPI_URL   = 'http://192.168.1.50';

const links = [
    { to: '/',             label: 'Dashboard',    icon: '📊' },
    { to: '/equipo',       label: 'Equipo',       icon: '👥' },
    { to: '/planificador', label: 'Planificador', icon: '📋' },
];

const external = [
    { href: RETAIL_URL, label: 'Dashboard Retail', icon: '🏪' },
    { href: GLPI_URL,   label: 'GLPI',             icon: '🛠' },
];

export default function Sidebar({ collapsed, onToggle }) {
    const W = collapsed ? 62 : 210;

    return (
        <aside style={{
            width: W, minHeight: '100vh', background: '#1e2a3b',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
            position: 'fixed', top: 0, left: 0, zIndex: 100,
            transition: 'width 0.25s ease', overflow: 'hidden',
        }}>
            {/* Logo */}
            <div style={{ padding: collapsed ? '16px 0' : '16px', borderBottom: '1px solid #2d3d52', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 64 }}>
                {collapsed
                    ? <img src={LOGO_ISO} alt="Comutel" style={{ width: 36, display: 'block' }} />
                    : <div style={{ width: '100%' }}>
                        <img src={LOGO_FULL} alt="Comutel" style={{ width: '100%', maxWidth: 160, display: 'block' }} />
                        <div style={{ color: '#8899aa', fontSize: 11, marginTop: 6 }}>Leads Empresas</div>
                      </div>
                }
            </div>

            {/* Nav links */}
            <nav style={{ padding: collapsed ? '12px 0' : '12px 8px', flex: 1 }}>
                {links.map(l => (
                    <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.to === '/'}
                        title={collapsed ? l.label : undefined}
                        style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '10px 0' : '9px 12px',
                            borderRadius: collapsed ? 0 : 8,
                            marginBottom: 4,
                            color: isActive ? '#fff' : '#8899aa',
                            background: isActive ? '#2f6fd4' : 'transparent',
                            textDecoration: 'none', fontSize: 13, fontWeight: 500,
                            transition: 'all 0.15s',
                        })}
                    >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{l.icon}</span>
                        {!collapsed && <span>{l.label}</span>}
                    </NavLink>
                ))}

                {/* Separador */}
                <div style={{ borderTop: '1px solid #2d3d52', margin: '12px 8px' }} />

                {/* Links externos */}
                {external.map(e => (
                    <a
                        key={e.href}
                        href={e.href}
                        target="_blank"
                        rel="noreferrer"
                        title={collapsed ? e.label : undefined}
                        style={{
                            display: 'flex', alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '10px 0' : '9px 12px',
                            borderRadius: collapsed ? 0 : 8,
                            marginBottom: 4,
                            color: '#8899aa',
                            textDecoration: 'none', fontSize: 13, fontWeight: 500,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#8899aa'}
                    >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{e.icon}</span>
                        {!collapsed && <span>{e.label}</span>}
                    </a>
                ))}
            </nav>

            {/* Botón contraer */}
            <button
                onClick={onToggle}
                title={collapsed ? 'Expandir menú' : 'Contraer menú'}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 8, padding: collapsed ? '14px 0' : '14px 20px',
                    borderTop: '1px solid #2d3d52', background: 'none', border: 'none',
                    color: '#8899aa', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    width: '100%', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#8899aa'}
            >
                <span style={{ fontSize: 16 }}>{collapsed ? '»' : '«'}</span>
                {!collapsed && <span>Contraer menú</span>}
            </button>
        </aside>
    );
}
