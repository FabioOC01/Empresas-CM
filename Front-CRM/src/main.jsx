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
import './index.css';

const SIDEBAR_W   = 210;
const COLLAPSED_W = 62;

function RequireAuth({ children }) {
    const { isAuth } = useAuth();
    const location   = useLocation();
    if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
    return children;
}

function RequireRole({ roles, children }) {
    const { user } = useAuth();
    const allowed = user?.is_superadmin || roles.some(r => user?.roles?.includes(r));
    if (!allowed) return <Navigate to="/planificador?view=kanban" replace />;
    return children;
}

function AppLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const { config } = useActividadesContext();
    const { user } = useAuth();
    const tk        = useTheme();
    const copyright = config?.branding?.copyright || 'VANTIO Copyright (C) 2026 Comutel and contributors';
    const ml = collapsed ? COLLAPSED_W : SIDEBAR_W;

    const changelogFlag = user?.id ? `crm_changelog_seen_v${CHANGELOG_VERSION}_${user.id}` : null;
    const [showChangelog, setShowChangelog] = useState(false);
    useEffect(() => {
        if (changelogFlag && !localStorage.getItem(changelogFlag)) setShowChangelog(true);
    }, [changelogFlag]);
    const handleCloseChangelog = () => {
        if (changelogFlag) localStorage.setItem(changelogFlag, '1');
        setShowChangelog(false);
    };

    return (
        <div style={{ display: 'flex', background: tk.bg, minHeight: '100vh' }}>
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
            <main style={{
                marginLeft: ml, flex: 1, padding: '28px 28px 16px',
                minHeight: '100vh', background: tk.bg,
                transition: 'margin-left 0.25s ease',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ flex: 1 }}>
                    <Routes>
                        <Route path="/" element={
                            <RequireRole roles={['Admin','Gerencia']}>
                                <Dashboard />
                            </RequireRole>
                        } />
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
