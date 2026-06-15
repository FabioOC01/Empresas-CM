import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { switchEmpresa as apiSwitch } from '../api/actividades';
import { getApiBaseUrl } from '../utils/apiBase';

const AuthContext = createContext(null);

const TOKEN_KEY = 'crm_token';
const USER_KEY = 'crm_user';

function readStorage() {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        return token && user ? { token, user } : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const saved = readStorage();
    const [token, setToken] = useState(saved?.token || null);
    const [user, setUser] = useState(saved?.user || null);

    const login = useCallback(async (username, password) => {
        const { data } = await axios.post(
            `${getApiBaseUrl()}/api/auth/login`,
            { username, password }
        );
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    const switchEmpresa = useCallback(async (empresa_id) => {
        const data = await apiSwitch(empresa_id);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        window.location.reload();
    }, []);

    const updateUser = useCallback((updates) => {
        setUser((prev) => {
            const next = { ...prev, ...updates };
            localStorage.setItem(USER_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, switchEmpresa, updateUser, isAuth: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
