import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

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
