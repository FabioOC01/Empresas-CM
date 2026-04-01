import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Equipo from './pages/Equipo';
import Planificador from './pages/Planificador';
import './index.css';

const SIDEBAR_W  = 210;
const COLLAPSED_W = 62;

function PageTitle({ children }) {
    return <h1 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#1e2a3b' }}>{children}</h1>;
}

function App() {
    const [collapsed, setCollapsed] = useState(false);
    const ml = collapsed ? COLLAPSED_W : SIDEBAR_W;

    return (
        <BrowserRouter>
            <div style={{ display: 'flex' }}>
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
                <main style={{
                    marginLeft: ml, flex: 1, padding: '28px',
                    minHeight: '100vh', background: '#f0f2f5',
                    transition: 'margin-left 0.25s ease',
                }}>
                    <Routes>
                        <Route path="/"             element={<><PageTitle>Dashboard</PageTitle><Dashboard /></>} />
                        <Route path="/equipo"       element={<><PageTitle>Equipo</PageTitle><Equipo /></>} />
                        <Route path="/planificador" element={<><PageTitle>Planificador</PageTitle><Planificador /></>} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

createRoot(document.getElementById('root')).render(<App />);
