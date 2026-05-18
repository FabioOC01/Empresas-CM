import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActividadesProvider, useActividadesContext } from './context/ActividadesContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ChangelogModal, { CHANGELOG_VERSION } from './components/ChangelogModal';
import Dashboard from './pages/Dashboard';
import Equipo from './pages/Equipo';
import Planificador from './pages/Planificador';
import Asistencia from './pages/Asistencia';
import Rentabilidad from './pages/Rentabilidad';
import Admin from './pages/Admin';
import Clientes from './pages/Clientes';
import Login from './pages/Login';
import { canViewAll, hasEffectiveRole } from './utils/roles';
import './index.css';

const SIDEBAR_W   = 232;
const COLLAPSED_W = 68;

function RequireAuth({ children }) {
    const { isAuth } = useAuth();
    const location   = useLocation();
    if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
    return children;
}

function RequireRole({ roles, children }) {
    const { user } = useAuth();
    const allowed = user?.is_superadmin || roles.some(r => hasEffectiveRole(user, r));
    if (!allowed) return <Navigate to="/equipo" replace />;
    return children;
}

function HomeRoute() {
    const { user } = useAuth();
    return canViewAll(user) ? <Dashboard /> : <Equipo />;
}

function AppLayout() {
    const [collapsed, setCollapsed] = useState(true);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
    const { config } = useActividadesContext();
    const { user } = useAuth();
    const tk        = useTheme();
    const copyright = config?.branding?.copyright || 'VANTIO Copyright (C) 2026 Comutel and contributors';
    const ml = isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 760);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const changelogFlag = user?.id ? `crm_changelog_seen_v${CHANGELOG_VERSION}_${user.id}` : null;
    const [dismissedChangelogFlag, setDismissedChangelogFlag] = useState(null);
    const showChangelog = !!changelogFlag
        && dismissedChangelogFlag !== changelogFlag
        && !localStorage.getItem(changelogFlag);
    const handleCloseChangelog = () => {
        if (changelogFlag) localStorage.setItem(changelogFlag, '1');
        setDismissedChangelogFlag(changelogFlag);
    };

    return (
        <div style={{ display: 'flex', background: tk.bg, minHeight: '100vh' }}>
            <Sidebar collapsed={isMobile ? true : collapsed} isMobile={isMobile} onToggle={() => setCollapsed(c => !c)} />
            <main style={{
                marginLeft: ml, flex: 1, padding: isMobile ? '76px 12px 14px' : '28px 28px 16px',
                minHeight: '100vh', background: tk.bg,
                transition: 'margin-left 0.25s ease',
                display: 'flex', flexDirection: 'column',
                minWidth: 0, overflowX: 'hidden',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Routes>
                        <Route path="/"             element={<HomeRoute />} />
                        <Route path="/equipo"       element={<Equipo />} />
                        <Route path="/planificador" element={<Planificador />} />
                        <Route path="/asistencia"   element={<Asistencia />} />
                        <Route path="/rentabilidad" element={<Rentabilidad />} />
                        <Route path="/clientes"     element={<Clientes />} />
                        <Route path="/admin"        element={<Admin />} />
                        <Route path="*"             element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
                <footer style={{ marginTop: 32, paddingTop: 12, borderTop: `1px solid ${tk.bdr}`, textAlign: 'center', fontSize: 11, color: tk.txt3 }}>
                    {copyright}
                </footer>
            </main>
            <ChangelogModal open={showChangelog} onClose={handleCloseChangelog} />
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/*" element={
                        <RequireAuth>
                            <ActividadesProvider>
                                <ThemeProvider>
                                <AppLayout />
                                    </ThemeProvider>
                        </ActividadesProvider>
                        </RequireAuth>
                    } />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

createRoot(document.getElementById('root')).render(<App />);
