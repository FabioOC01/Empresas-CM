import { MESES, Q_MAP } from './crm';

export const ESTADOS_META_ACTIVIDAD = new Set(['Completado', 'Ganada']);

export function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function weeksInMonthIndex(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const firstWeekStart = startOfWeek(first);
    const lastWeekStart = startOfWeek(last);
    return Math.max(1, Math.round((lastWeekStart - firstWeekStart) / 604800000) + 1);
}

export function isCurrentWeek(fecha, now = new Date()) {
    if (!fecha) return false;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return false;
    return startOfWeek(d).getTime() === startOfWeek(now).getTime();
}

export function countActivityGoalWeeks({ mes, trimestre, anio }) {
    const year = parseInt(anio, 10) || new Date().getFullYear();
    if (mes) {
        const monthIndex = MESES.indexOf(mes);
        return monthIndex >= 0 ? weeksInMonthIndex(year, monthIndex) : 1;
    }
    if (trimestre && Q_MAP[trimestre]) {
        return Q_MAP[trimestre].reduce((sum, monthIndex) => sum + weeksInMonthIndex(year, monthIndex), 0);
    }
    if (anio) return 52;
    return 1;
}

export function filterActivitiesForGoal(actividades, { mes, trimestre, anio }) {
    const base = actividades.filter((a) => ESTADOS_META_ACTIVIDAD.has(a.estado));
    if (mes || trimestre || anio) return base;
    return base.filter((a) => isCurrentWeek(a.fecha));
}
