import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Adjunta el JWT en cada request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('crm_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
});

// Si el token expiró, limpia sesión y redirige al login
api.interceptors.response.use(
    r => r,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('crm_token');
            localStorage.removeItem('crm_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export const getActividades = (params = {}) =>
    api.get('/api/actividades', { params }).then(r => r.data);

export const createActividad = (data) =>
    api.post('/api/actividades', data).then(r => r.data);

export const updateActividad = (id, data) =>
    api.put(`/api/actividades/${id}`, data).then(r => r.data);

export const updateElapsed = (id, elapsed) =>
    api.put(`/api/actividades/${id}/elapsed`, { elapsed }).then(r => r.data);

export const deleteActividad = (id) =>
    api.delete(`/api/actividades/${id}`).then(r => r.data);

export const getVendedores = () =>
    api.get('/api/vendedores').then(r => r.data);

export const updateRoles = (id, roles) =>
    api.put(`/api/vendedores/${id}/roles`, { roles }).then(r => r.data);

export const createVendedor = (data) =>
    api.post('/api/vendedores', data).then(r => r.data);

export const updateVendedor = (id, data) =>
    api.put(`/api/vendedores/${id}`, data).then(r => r.data);

export const updateVendedorMetas = (id, data) =>
    api.put(`/api/vendedores/${id}/metas`, data).then(r => r.data);

export const getEmpresas = () =>
    api.get('/api/empresas').then(r => r.data);

export const getClientes = (q = '') =>
    api.get('/api/clientes', { params: q ? { q } : {} }).then(r => r.data);

export const createCliente = (data) =>
    api.post('/api/clientes', data).then(r => r.data);

export const updateCliente = (id, data) =>
    api.put(`/api/clientes/${id}`, data).then(r => r.data);

export const lookupRuc = (ruc) =>
    api.post('/api/clientes/sunat/ruc', { ruc }).then(r => r.data);

export const lookupDni = (dni) =>
    api.post('/api/clientes/sunat/dni', { dni }).then(r => r.data);

export const switchEmpresa = (empresa_id) =>
    api.post('/api/auth/switch', { empresa_id }).then(r => r.data);

export const getConfig    = ()     => api.get('/api/config').then(r => r.data);
export const updateConfig = (data) => api.put('/api/config', data).then(r => r.data);

export const getAttendanceSummary = (params = {}) =>
    api.get('/api/asistencia/resumen', { params }).then(r => r.data);

export const getAttendanceVendorHistory = (id, params = {}) =>
    api.get(`/api/asistencia/vendedor/${id}`, { params }).then(r => r.data);

export const syncAttendance = (data) =>
    api.post('/api/asistencia/sync', data).then(r => r.data);

export const getAttendanceHealth = () =>
    api.get('/api/asistencia/health').then(r => r.data);

export const getAttendanceUnmapped = () =>
    api.get('/api/asistencia/unmapped').then(r => r.data);

export const uploadFotoVendedor = (id, file) => {
    const fd = new FormData();
    fd.append('foto', file);
    return api.post(`/api/vendedores/${id}/foto`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};

export const uploadArchivoActividad = (id, file) => {
    const fd = new FormData();
    fd.append('archivo', file);
    return api.post(`/api/actividades/${id}/archivos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};

export const deleteArchivoActividad = (id, url) =>
    api.delete(`/api/actividades/${id}/archivos`, { data: { url } }).then(r => r.data);

export const changePassword = (current_password, new_password) =>
    api.put('/api/auth/change-password', { current_password, new_password }).then(r => r.data);

export const uploadFotoPropia = (file) => {
    const fd = new FormData();
    fd.append('foto', file);
    return api.post('/api/auth/foto', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};
