import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { getEmpresas } from '../api/actividades';
import ProfileModal from './ProfileModal';
import { BuildingIcon, ChartIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, ClipboardIcon, DashboardIcon, PowerIcon, SettingsIcon, TagIcon, TeamIcon } from './Icons';

const DEFAULT_LOGO_FULL = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO.png';
const DEFAULT_LOGO_ISO  = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png';

const RETAIL_URL = `http://192.168.1.51:5173/`;
const GLPI_URL   = 'http://192.168.1.50';
const ODOO_URL   = 'https://store.comutelperu.com/web#cids=1&action=menu';

const VANTIO_LEADS_ICON = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png';
const GLPI_ICON         = 'https://comutelperu.com/correo-cm/Iconos/10156352.png';
const ODOO_ICON         = 'https://comutelperu.com/correo-cm/Iconos/odoo.png';

function canAccessAttendance(user) {
    return user?.is_superadmin || user?.roles?.some(r => ['Admin', 'Gerencia'].includes(r));
}

const BASE_LINKS = [
    { to: '/',             label: 'Dashboard',    icon: DashboardIcon },
    { to: '/equipo',       label: 'Equipo',       icon: TeamIcon },
    { to: '/planificador', label: 'Planificador', icon: ClipboardIcon },
    { to: '/clientes',     label: 'Clientes',     icon: BuildingIcon },
    { to: '/rentabilidad', label: 'Comisiones',   icon: ChartIcon },
];
const ADMIN_LINK = { to: '/admin', label: 'Administración', icon: SettingsIcon };

const PRODUCT_LINK = { to: '/admin?section=productos', label: 'Productos', icon: TagIcon, section: 'productos' };

const external = [
    { href: RETAIL_URL, label: 'Vantio Leads', img: VANTIO_LEADS_ICON },
    { href: GLPI_URL,   label: 'GLPI',         img: GLPI_ICON },
    { href: ODOO_URL,   label: 'Odoo',         img: ODOO_ICON },
];

export default function Sidebar({ collapsed, isMobile = false, onToggle }) {
    const W = collapsed ? 62 : 210;
    const { user, logout, switchEmpresa } = useAuth();
    const { config } = useActividadesContext();
    const branding   = config?.branding || {};
    const logoFull   = branding.logo_sidebar || DEFAULT_LOGO_FULL;
    const logoIso    = branding.logo_iso     || DEFAULT_LOGO_ISO;
    const appName    = branding.app_name || 'Vantio';
    const subtitulo  = config?.nombre    || branding.subtitulo || 'CRM Empresas';
    const navigate = useNavigate();
    const location = useLocation();
    const [empresas,    setEmpresas]    = useState([]);
    const [switching,   setSwitching]   = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        if (user?.is_superadmin) getEmpresas().then(setEmpresas).catch(() => {});
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const handleSwitch = async (e) => {
        const id = e.target.value;
        if (!id) return;
        setSwitching(true);
        try { await switchEmpresa(id); } finally { setSwitching(false); }
    };

    const attendanceLink = {
        to: '/asistencia',
        label: canAccessAttendance(user) ? 'Asistencia' : 'Próximamente',
        icon: ClockIcon,
    };
    const links = user?.is_superadmin || user?.roles?.includes('Admin')
        ? [...BASE_LINKS.slice(0, 3), attendanceLink, BASE_LINKS[3], PRODUCT_LINK, ...BASE_LINKS.slice(4), ADMIN_LINK]
        : [...BASE_LINKS.slice(0, 3), attendanceLink, ...BASE_LINKS.slice(3)];
    const sectionParam = new URLSearchParams(location.search).get('section');
    const linkActive = (l, isActive) => {
        if (l.section) return location.pathname === '/admin' && sectionParam === l.section;
        if (l.to === '/admin') return location.pathname === '/admin' && sectionParam !== 'productos';
        return isActive;
    };

    if (isMobile) {
        return (
            <>
            <aside className="sidebar-dark" style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 62, zIndex: 100,
                background: 'var(--sidebar)', borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                overflowX: 'auto', overflowY: 'hidden',
            }}>
                <img src={logoIso} alt={appName} style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
                <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflowX: 'auto', paddingBottom: 2 }}>
                    {links.map(l => (
                        (() => {
                            const LinkIcon = l.icon;
                            return (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            end={l.to === '/'}
                            title={l.label}
                            className="nav-item"
                            style={({ isActive }) => {
                                const active = linkActive(l, isActive);
                                return ({
                                minWidth: 42, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 9, color: active ? '#10b981' : '#8b9cbf',
                                background: active ? 'rgba(16,185,129,0.13)' : 'transparent',
                                border: active ? '1px solid rgba(16,185,129,0.30)' : '1px solid transparent',
                                textDecoration: 'none', fontSize: 17, flexShrink: 0,
                            });}}
                        >
                            <LinkIcon size={17} />
                        </NavLink>
                            );
                        })()
                    ))}
                </nav>
                {user && (
                    <button onClick={() => setProfileOpen(true)} title={user.nombre}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: user.color || '#10b981', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                        {user.iniciales || user.nombre?.[0] || '?'}
                    </button>
                )}
            </aside>
            {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
            </>
        );
    }

    return (
        <>
        <aside className="sidebar-dark" style={{
            width: W, minHeight: '100vh', background: 'var(--sidebar)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
            position: 'fixed', top: 0, left: 0, zIndex: 100,
            transition: 'width 0.25s ease', overflow: 'hidden',
            borderRight: '1px solid rgba(255,255,255,0.04)',
        }}>
            {/* Logo */}
            <div style={{ padding: collapsed ? '16px 0' : '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 64 }}>
                {collapsed
                    ? <img src={logoIso} alt={appName} style={{ width: 36, display: 'block' }} />
                    : <div style={{ width: '100%' }}>
                        <img src={logoFull} alt={appName} style={{ width: '100%', maxWidth: 160, display: 'block' }} />
                        <div style={{ color: '#8b9cbf', fontSize: 11, marginTop: 6 }}>{subtitulo}</div>
                      </div>
                }
            </div>

            {/* Nav links */}
            <nav style={{ padding: collapsed ? '12px 0' : '12px 8px', flex: 1 }}>
                {links.map(l => (
                    (() => {
                        const LinkIcon = l.icon;
                        return (
                    <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.to === '/'}
                        title={collapsed ? l.label : undefined}
                        className="nav-item"
                        style={({ isActive }) => {
                            const active = linkActive(l, isActive);
                            return ({
                            display: 'flex', alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '10px 0' : '9px 12px',
                            borderRadius: collapsed ? 0 : 8,
                            marginBottom: 4,
                            color: active ? '#10b981' : '#8b9cbf',
                            background: active ? 'rgba(16,185,129,0.13)' : 'transparent',
                            border: active ? '1px solid rgba(16,185,129,0.30)' : '1px solid transparent',
                            textDecoration: 'none', fontSize: 13, fontWeight: 600,
                            transition: 'all 0.15s',
                        });}}
                    >
                        <span style={{ width: 18, height: 18, display: 'inline-grid', placeItems: 'center', flexShrink: 0 }}>
                            <LinkIcon size={16} />
                        </span>
                        {!collapsed && <span>{l.label}</span>}
                    </NavLink>
                        );
                    })()
                ))}

                {/* Separador */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 8px' }} />

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
                            color: '#8b9cbf',
                            textDecoration: 'none', fontSize: 13, fontWeight: 500,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#8b9cbf'}
                    >
                        {e.img
                            ? <img src={e.img} alt={e.label} style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                            : <span style={{ fontSize: 16, flexShrink: 0 }}>{e.icon}</span>}
                        {!collapsed && <span>{e.label}</span>}
                    </a>
                ))}
            </nav>

            {/* Selector de empresa — solo superadmin */}
            {user?.is_superadmin && !collapsed && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: '#8b9cbf', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                        Empresa activa
                    </div>
                    <select
                        value={user.empresa_id || ''}
                        onChange={handleSwitch}
                        disabled={switching}
                        style={{
                            width: '100%', padding: '7px 8px', borderRadius: 7,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#fff', fontSize: 12, cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="" disabled>— Seleccionar empresa —</option>
                        {empresas.map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                    </select>
                    {switching && <div style={{ fontSize: 10, color: '#8b9cbf', marginTop: 4 }}>Cambiando...</div>}
                </div>
            )}

            {/* Usuario + logout */}
            {user && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: collapsed ? '12px 0' : '12px 14px' }}>
                    {!collapsed && (
                        <button
                            onClick={() => setProfileOpen(true)}
                            title="Ver perfil"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', borderRadius: 7, textAlign: 'left', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            {user.foto_url
                                ? <img src={user.foto_url} alt={user.nombre} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                : <span style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {user.iniciales || user.nombre?.[0] || '?'}
                                  </span>
                            }
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{user.nombre}</div>
                                <div style={{ fontSize: 10, color: '#8b9cbf' }}>
                                    {user.is_superadmin ? 'Superadmin' : user.roles?.join(', ')}
                                </div>
                            </div>
                        </button>
                    )}
                    {collapsed && (
                        <button
                            onClick={() => setProfileOpen(true)}
                            title={user.nombre}
                            style={{ display: 'flex', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}
                        >
                            {user.foto_url
                                ? <img src={user.foto_url} alt={user.nombre} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                : <span style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {user.iniciales || user.nombre?.[0] || '?'}
                                  </span>
                            }
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 8, padding: collapsed ? '8px 0' : '7px 10px', width: '100%',
                            background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7,
                            color: '#8b9cbf', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#8b9cbf'}
                    >
                        <PowerIcon size={14} />
                        {!collapsed && <span>Cerrar sesión</span>}
                    </button>
                </div>
            )}

            {/* Botón contraer */}
            <button
                onClick={onToggle}
                title={collapsed ? 'Expandir menú' : 'Contraer menú'}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 8, padding: collapsed ? '14px 0' : '14px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.06)', background: 'none', border: 'none',
                    color: '#8b9cbf', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    width: '100%', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#8b9cbf'}
            >
                {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
                {!collapsed && <span>Contraer menú</span>}
            </button>
        </aside>

        {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
        </>
    );
}
