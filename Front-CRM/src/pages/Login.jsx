import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LOGO = 'https://comutelperu.com/correo-cm/Vantio/LOGO/VANTIO-CENTER-BLUE.png';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username.trim(), password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <img src={LOGO} alt="Vantio" style={{ width: 180, display: 'inline-block' }} />
            </div>

            <div className="card" style={{ padding: '36px 36px 28px', width: 380 }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-heavy)', textAlign: 'center' }}>
                    Inicie sesion con su cuenta
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Ingrese con su usuario del equipo
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
                    <label style={lbl}>Usuario
                        <input
                            style={inp}
                            type="text"
                            required
                            autoFocus
                            placeholder="erimay.torres"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </label>
                    <label style={lbl}>Contrasena
                        <input
                            style={inp}
                            type="password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>

                    {error && (
                        <div style={{ background: 'var(--color-red-bg)', border: '1px solid var(--color-red)', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: 'var(--color-red)' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 8,
                            padding: '12px',
                            background: loading ? 'var(--accent-glow)' : 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: loading ? 'default' : 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading ? 'Ingresando...' : 'Iniciar sesion'}
                    </button>
                </form>
            </div>

            <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                VANTIO Copyright (C) 2026 Comutel and contributors
            </div>
        </div>
    );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 };
const inp = { padding: '9px 11px', borderRadius: 7, border: '1px solid var(--input-bdr)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
