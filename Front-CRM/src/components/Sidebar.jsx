import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActividadesContext } from '../context/ActividadesContext';
import { getEmpresas } from '../api/actividades';
import ProfileModal from './ProfileModal';
import { BuildingIcon, ChartIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, ClipboardIcon, DashboardIcon, PowerIcon, SettingsIcon, TagIcon, TeamIcon } from './Icons';
import { getDisplayRoles } from '../utils/roles';

const DEFAULT_LOGO_FULL = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO.png';
const DEFAULT_LOGO_ISO  = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-BLANCO-SHORT.png';

const RETAIL_URL = `http://192.168.1.51:5173/`;
const GLPI_URL   = 'https://comutelperu.us1.glpi-network.cloud/';
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
    const W = collapsed ? 68 : 232;
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
        <aside className={`sidebar-dark app-sidebar ${collapsed ? 'is-collapsed' : ''}`} style={{
            width: W, height: '100vh', background: 'var(--sidebar)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
            position: 'fixed', top: 0, left: 0, zIndex: 100,
            transition: 'width 0.25s ease', overflow: 'hidden',
            borderRight: '1px solid rgba(255,255,255,0.08)',
        }}>
            {/* Logo */}
            <div className="sidebar-brand" style={{ padding: collapsed ? '13px 0' : '14px 16px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: collapsed ? 62 : 92, flexShrink:0 }}>
                {collapsed
                    ? <img src={logoIso} alt={appName} style={{ width: 32, display: 'block', filter:'drop-shadow(0 8px 18px rgba(0,0,0,.24))' }} />
                    : <div style={{ width: '100%', minWidth:0 }}>
                        <img src={logoFull} alt={appName} style={{ width: '100%', maxWidth: 158, display: 'block', filter:'drop-shadow(0 8px 18px rgba(0,0,0,.24))' }} />
                        <div style={{ color: '#9fb4df', fontSize: 11, marginTop: 4, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitulo}</div>
                      </div>
                }
            </div>

            {/* Nav links */}
            <nav className="sidebar-nav" style={{ padding: collapsed ? '8px 8px' : '9px 9px', flex: 1, minHeight:0, overflowY:'auto', overflowX:'hidden' }}>
                {!collapsed && <div className="sidebar-section-label">Operación</div>}
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
                            gap: collapsed ? 0 : 11,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '9px 0' : '8px 11px',
                            borderRadius: 10,
                            marginBottom: 3,
                            color: active ? '#34d399' : '#9fb4df',
                            background: active ? 'linear-gradient(90deg, rgba(16,185,129,0.20), rgba(16,185,129,0.08))' : 'transparent',
                            border: active ? '1px solid rgba(52,211,153,0.34)' : '1px solid transparent',
                            boxShadow: active ? 'inset 3px 0 0 rgba(52,211,153,.95)' : 'none',
                            textDecoration: 'none', fontSize: 13, fontWeight: 700,
                            transition: 'background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s',
                        });}}
                    >
                        <span style={{ width: 20, height: 20, display: 'inline-grid', placeItems: 'center', flexShrink: 0 }}>
                            <LinkIcon size={16} />
                        </span>
                        {!collapsed && <span>{l.label}</span>}
                    </NavLink>
                        );
                    })()
                ))}

                {/* Separador */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: collapsed ? '9px 8px' : '10px 8px 8px' }} />
                {!collapsed && <div className="sidebar-section-label">Accesos</div>}

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
                            gap: collapsed ? 0 : 11,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '8px 0' : '8px 11px',
                            borderRadius: 10,
                            marginBottom: 3,
                            color: '#9fb4df',
                            background: collapsed ? 'transparent' : 'rgba(255,255,255,0.025)',
                            border: '1px solid transparent',
                            textDecoration: 'none', fontSize: 13, fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#9fb4df'}
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
                <div className="sidebar-company-card" style={{ margin: '7px 10px', padding: '9px 10px', borderRadius:10, flexShrink:0 }}>
                    <div style={{ fontSize: 9, color: '#9fb4df', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, letterSpacing:.4 }}>
                        Empresa activa
                    </div>
                    <select
                        value={user.empresa_id || ''}
                        onChange={handleSwitch}
                        disabled={switching}
                        style={{
                            width: '100%', padding: '7px 9px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
                            color: '#fff', fontSize: 12, cursor: 'pointer', outline: 'none',
                        }}
                    >
                        <option value="" disabled>Seleccionar empresa</option>
                        {empresas.map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                    </select>
                    {switching && <div style={{ fontSize: 10, color: '#9fb4df', marginTop: 6 }}>Cambiando...</div>}
                </div>
            )}

            {/* Usuario + logout */}
            {user && (
                <div className="sidebar-user-wrap" style={{ padding: collapsed ? '8px 8px' : '8px 10px 9px', flexShrink:0 }}>
                    {!collapsed && (
                        <button
                            onClick={() => setProfileOpen(true)}
                            title="Ver perfil"
                            style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, width: '100%', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', padding: '7px 8px', borderRadius: 10, textAlign: 'left', transition: 'background 0.15s', minWidth:0 }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.075)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.045)'}
                        >
                            {user.foto_url
                                ? <img src={user.foto_url} alt={user.nombre} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                : <span style={{ width: 30, height: 30, borderRadius: '50%', background: user.color || '#10b981', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {user.iniciales || user.nombre?.[0] || '?'}
                                  </span>
                            }
                            <div style={{ minWidth:0 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.25, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.nombre}</div>
                                <div style={{ fontSize: 10, color: '#9fb4df', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                    {user.is_superadmin ? 'Superadmin' : getDisplayRoles(user).join(', ')}
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
                            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                            color: '#9fb4df', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#9fb4df'}
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
                    gap: 8, padding: collapsed ? '11px 0' : '10px 18px',
                    borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)', border: 'none',
                    color: '#9fb4df', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    width: '100%', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#9fb4df'}
            >
                {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
                {!collapsed && <span>Contraer menú</span>}
            </button>
        </aside>

        {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
        </>
    );
}
