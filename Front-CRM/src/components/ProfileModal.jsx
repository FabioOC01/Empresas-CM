import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { changePassword, uploadFotoPropia } from '../api/actividades';

export default function ProfileModal({ onClose }) {
    const { user, updateUser } = useAuth();
    const tk = useTheme();

    // Password form
    const [pwForm,    setPwForm]    = useState({ current: '', next: '', confirm: '' });
    const [pwMsg,     setPwMsg]     = useState(null);
    const [pwSaving,  setPwSaving]  = useState(false);

    // Photo
    const [photoMsg,  setPhotoMsg]  = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const fileRef = useRef();

    const inp = {
        padding: '9px 11px', borderRadius: 7,
        border: `1px solid ${tk.bdr}`, fontSize: 13,
        outline: 'none', width: '100%', boxSizing: 'border-box',
        fontFamily: 'inherit', background: tk.inp, color: tk.txt,
    };
    const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: tk.txt2, fontWeight: 600 };

    const handlePwSubmit = async (e) => {
        e.preventDefault();
        if (pwForm.next !== pwForm.confirm)
            return setPwMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden.' });
        if (pwForm.next.length < 6)
            return setPwMsg({ type: 'err', text: 'Mínimo 6 caracteres.' });
        setPwSaving(true); setPwMsg(null);
        try {
            await changePassword(pwForm.current, pwForm.next);
            setPwMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
            setPwForm({ current: '', next: '', confirm: '' });
        } catch (err) {
            setPwMsg({ type: 'err', text: err.response?.data?.error || 'Error al cambiar contraseña.' });
        } finally {
            setPwSaving(false);
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoLoading(true); setPhotoMsg(null);
        try {
            const { foto_url } = await uploadFotoPropia(file);
            updateUser({ foto_url });
            setPhotoMsg({ type: 'ok', text: 'Foto actualizada.' });
        } catch (err) {
            setPhotoMsg({ type: 'err', text: err.response?.data?.error || 'Error al subir foto.' });
        } finally {
            setPhotoLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(7,13,25,0.65)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="card" style={{ borderRadius: 14, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${tk.bdr}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                    {user.foto_url
                        ? <img src={user.foto_url} alt={user.nombre} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <span style={{ width: 48, height: 48, borderRadius: '50%', background: user.color || '#10b981', color: '#fff', fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {user.iniciales || user.nombre?.[0] || '?'}
                          </span>
                    }
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: tk.txt }}>{user.nombre}</div>
                        <div style={{ fontSize: 12, color: tk.txt2 }}>{user.email}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: tk.txt3, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Modo oscuro */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Apariencia</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: tk.card2, borderRadius: 8, border: `1px solid ${tk.bdr}` }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: tk.txt }}>Modo oscuro</div>
                                <div style={{ fontSize: 11, color: tk.txt2, marginTop: 2 }}>Preferencia personal</div>
                            </div>
                            <button
                                type="button"
                                onClick={tk.toggleDark}
                                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: tk.isDark ? '#10b981' : '#dde1e8', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                            >
                                <span style={{ position: 'absolute', top: 3, left: tk.isDark ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                            </button>
                        </div>
                    </div>

                    {/* Foto de perfil */}
                    {!user.is_superadmin && (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Foto de perfil</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: tk.card2, borderRadius: 8, border: `1px solid ${tk.bdr}` }}>
                                {user.foto_url
                                    ? <img src={user.foto_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    : <span style={{ width: 44, height: 44, borderRadius: '50%', background: user.color || '#10b981', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {user.iniciales || user.nombre?.[0] || '?'}
                                      </span>
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        style={{ display: 'none' }}
                                        onChange={handlePhotoChange}
                                    />
                                    <button
                                        type="button"
                                        disabled={photoLoading}
                                        onClick={() => fileRef.current?.click()}
                                        style={{ padding: '7px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: photoLoading ? 'default' : 'pointer', opacity: photoLoading ? 0.6 : 1 }}
                                    >
                                        {photoLoading ? 'Subiendo...' : user.foto_url ? 'Cambiar foto' : 'Subir foto'}
                                    </button>
                                    <div style={{ fontSize: 11, color: tk.txt3, marginTop: 4 }}>JPG, PNG o WebP · máx. 5 MB</div>
                                </div>
                            </div>
                            {photoMsg && (
                                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 7, fontSize: 12, background: photoMsg.type === 'ok' ? '#e8f8ee' : '#fff0f0', border: `1px solid ${photoMsg.type === 'ok' ? '#a8ddb8' : '#fcc'}`, color: photoMsg.type === 'ok' ? '#1a7a3c' : '#c0392b' }}>
                                    {photoMsg.type === 'ok' ? 'Listo: ' : 'Error: '}{photoMsg.text}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cambiar contraseña */}
                    {!user.is_superadmin && (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: tk.txt2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Cambiar contraseña</div>
                            <form onSubmit={handlePwSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <label style={lbl}>Contraseña actual
                                    <input style={inp} type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} autoComplete="current-password" />
                                </label>
                                <label style={lbl}>Nueva contraseña
                                    <input style={inp} type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} autoComplete="new-password" />
                                </label>
                                <label style={lbl}>Confirmar nueva contraseña
                                    <input style={inp} type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" />
                                </label>

                                {pwMsg && (
                                    <div style={{ padding: '8px 12px', borderRadius: 7, fontSize: 12, background: pwMsg.type === 'ok' ? '#e8f8ee' : '#fff0f0', border: `1px solid ${pwMsg.type === 'ok' ? '#a8ddb8' : '#fcc'}`, color: pwMsg.type === 'ok' ? '#1a7a3c' : '#c0392b' }}>
                                        {pwMsg.type === 'ok' ? 'Listo: ' : 'Error: '}{pwMsg.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={pwSaving}
                                    style={{ padding: '10px 20px', background: pwSaving ? '#a0b8e8' : '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: pwSaving ? 'default' : 'pointer', alignSelf: 'flex-start' }}
                                >
                                    {pwSaving ? 'Guardando...' : 'Cambiar contraseña'}
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
