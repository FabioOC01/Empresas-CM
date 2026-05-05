const crypto = require('crypto');
const { Pool } = require('pg');

const ATTENDANCE_DEFAULT = {
    timezone: 'America/Lima',
    ingreso_esperado: '09:30',
    tolerancia_minutos: 10,
    tardanza_modo: 'primera_entrada',
    almuerzo_inicio: '12:00',
    almuerzo_fin: '16:00',
    almuerzo_minutos: 60,
    sedes: [],
};

let sourcePool = null;

function getAttendanceConfig(config) {
    return {
        ...ATTENDANCE_DEFAULT,
        ...(config || {}),
        tolerancia_minutos: Number(config?.tolerancia_minutos ?? ATTENDANCE_DEFAULT.tolerancia_minutos),
        almuerzo_minutos: Number(config?.almuerzo_minutos ?? ATTENDANCE_DEFAULT.almuerzo_minutos),
        sedes: Array.isArray(config?.sedes) ? config.sedes : ATTENDANCE_DEFAULT.sedes,
    };
}

function pad2(v) {
    return String(v).padStart(2, '0');
}

function getDatePartsInTimezone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') map[part.type] = part.value;
    }
    return map;
}

function formatDateInTimezone(date, timeZone) {
    const parts = getDatePartsInTimezone(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTimeInTimezone(date, timeZone) {
    const parts = getDatePartsInTimezone(date, timeZone);
    return `${parts.hour}:${parts.minute}`;
}

function parseTimeToMinutes(value) {
    if (!value || !value.includes(':')) return 0;
    const [hh, mm] = value.split(':').map(Number);
    return hh * 60 + mm;
}

// Parsea un string "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DDTHH:mm:ss" SIN tz info,
// interpretándolo como hora local de la zona indicada (ej: America/Lima).
// Si el string ya trae 'Z' o '+/-HH:MM', se devuelve un Date estándar.
function parseDateWithTimezone(value, timeZone) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (!value) return null;
    const str = String(value).trim();
    // Si trae info de tz, dejamos que Date la interprete
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) {
        const d = new Date(str);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
        const d = new Date(str);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const [, y, mo, d, h, mi, s] = m;
    // Primer guess: tratar los componentes como si fueran UTC
    const guessUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0));
    // Ver cómo se muestra ese instante UTC en la tz objetivo
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(new Date(guessUtc));
    const map = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    const tzAsUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +(map.hour === '24' ? '00' : map.hour), +map.minute, +map.second);
    // El offset que tiene la tz en esa fecha (ej Lima = -5h => offsetMs = -5*3600000)
    const offsetMs = tzAsUtc - guessUtc;
    // Hora UTC real = guessUtc - offsetMs
    return new Date(guessUtc - offsetMs);
}

function buildExternalKey(row) {
    const base = [
        row.employee_code || '',
        row.event_time || '',
        row.device_name || '',
        row.event_type || '',
    ].join('|');
    return crypto.createHash('sha1').update(base).digest('hex');
}

function normalizeSourceRow(row, timezone) {
    const employeeCode = String(
        row.employee_code ??
        row.emp_code ??
        row.badgenumber ??
        row.pin ??
        row.employee_id ??
        ''
    ).trim();

    const rawDate = row.event_time ?? row.check_time ?? row.punch_time ?? row.timestamp ?? row.created_at;
    const eventAt = rawDate ? parseDateWithTimezone(rawDate, timezone) : null;
    if (!employeeCode || !eventAt || Number.isNaN(eventAt.getTime())) return null;

    const normalized = {
        employee_code: employeeCode,
        event_time: eventAt.toISOString(),
        attendance_date: formatDateInTimezone(eventAt, timezone),
        device_name: row.device_name ?? row.device ?? row.alias ?? row.area ?? row.terminal_alias ?? null,
        event_type: row.event_type ?? row.punch_state ?? row.status ?? row.verify_type ?? null,
        external_key: String(row.external_key ?? row.id ?? row.transaction_id ?? '').trim() || buildExternalKey({
            employee_code: employeeCode,
            event_time: eventAt.toISOString(),
            device_name: row.device_name ?? row.device ?? row.alias ?? row.area ?? row.terminal_alias ?? null,
            event_type: row.event_type ?? row.punch_state ?? row.status ?? row.verify_type ?? null,
        }),
        payload: row && typeof row === 'object' ? row : { value: row },
    };

    return normalized;
}

function getSourceMode() {
    return (process.env.ZKBIO_SOURCE || '').trim().toLowerCase();
}

function getSourcePool() {
    const mode = getSourceMode();
    if (mode !== 'postgres') return null;
    if (sourcePool) return sourcePool;

    const poolConfig = process.env.ZKBIO_DB_URL
        ? { connectionString: process.env.ZKBIO_DB_URL }
        : {
            host: process.env.ZKBIO_DB_HOST,
            port: process.env.ZKBIO_DB_PORT ? Number(process.env.ZKBIO_DB_PORT) : undefined,
            database: process.env.ZKBIO_DB_NAME,
            user: process.env.ZKBIO_DB_USER,
            password: process.env.ZKBIO_DB_PASSWORD,
        };

    sourcePool = new Pool(poolConfig);
    return sourcePool;
}

async function fetchZKBioEvents({ desde, hasta, timezone }) {
    const mode = getSourceMode();
    if (!mode) {
        const error = new Error('Integracion ZKBio no configurada. Define ZKBIO_SOURCE y la consulta de sincronizacion.');
        error.status = 503;
        throw error;
    }

    if (mode === 'biotime_api') {
        const { fetchTransactions } = require('./biotimeClient');
        const rows = await fetchTransactions({ desde, hasta });
        return rows
            .map(row => normalizeSourceRow(row, timezone))
            .filter(Boolean);
    }

    if (mode === 'postgres') {
        const sql = process.env.ZKBIO_SYNC_QUERY;
        if (!sql) {
            const error = new Error('Falta ZKBIO_SYNC_QUERY para leer marcaciones desde la fuente ZKBio.');
            error.status = 503;
            throw error;
        }
        const pool = getSourcePool();
        const { rows } = await pool.query(sql, [desde, hasta]);
        return rows
            .map(row => normalizeSourceRow(row, timezone))
            .filter(Boolean);
    }

    const error = new Error(`Modo de integracion ZKBio no soportado: ${mode}`);
    error.status = 400;
    throw error;
}

// Encuentra entrada {dia, inicio, fin} para un día de la semana (0=Dom..6=Sáb).
// vendorHorario tiene prioridad; si no, empresaHorario; si ninguno, null.
function pickHorarioPorDia(diaSemana, vendorHorario, empresaHorario) {
    const arr = Array.isArray(vendorHorario) && vendorHorario.length
        ? vendorHorario
        : (Array.isArray(empresaHorario) ? empresaHorario : []);
    return arr.find(x => Number(x?.dia) === Number(diaSemana)) || null;
}

function getDayOfWeekInTimezone(date, timeZone) {
    // Devuelve 0=Domingo..6=Sábado en la zona horaria indicada
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[fmt.format(date)] ?? 0;
}

function computeAttendanceStatus(row, attendanceConfig, opts = {}) {
    if (!row.zkbio_employee_code) {
        return { estado: 'Sin vincular', minutos_tardanza: null };
    }

    const tz = attendanceConfig.timezone;
    const tolerancia = Number(attendanceConfig.tolerancia_minutos || 0);
    const horarioEmpresa = opts.empresaHorario || null;
    const horarioVendor  = row.horario_dias || opts.vendorHorario || null;

    // Determinar día de la semana del registro (usar fecha si existe; sino hoy)
    const fechaRef = row.fecha instanceof Date ? formatDateInTimezone(row.fecha, tz) : row.fecha;
    const refDate = row.primera_entrada
        ? new Date(row.primera_entrada)
        : (fechaRef ? new Date(`${fechaRef}T12:00:00Z`) : new Date());
    const dia = getDayOfWeekInTimezone(refDate, tz);
    const horarioDia = pickHorarioPorDia(dia, horarioVendor, horarioEmpresa);

    // Día no laborable según horario
    if (!horarioDia) {
        if (!row.primera_entrada) return { estado: 'Día libre', minutos_tardanza: null };
        return { estado: 'A tiempo', minutos_tardanza: 0 };
    }

    if (!row.primera_entrada) {
        return { estado: 'Ausente', minutos_tardanza: null };
    }

    const ingresoEsperado = horarioDia.inicio || attendanceConfig.ingreso_esperado;
    const firstTime = formatTimeInTimezone(new Date(row.primera_entrada), tz);
    const lateMinutes = Math.max(
        0,
        parseTimeToMinutes(firstTime) -
        parseTimeToMinutes(ingresoEsperado) -
        tolerancia
    );

    if ((row.total_marcaciones || 0) < 2) {
        return { estado: 'Sin marcación de salida', minutos_tardanza: lateMinutes || 0 };
    }
    if (lateMinutes > 0) {
        return { estado: 'Tardanza', minutos_tardanza: lateMinutes };
    }
    return { estado: 'A tiempo', minutos_tardanza: 0 };
}

function normalizeEventTimes(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => item instanceof Date ? item : new Date(item))
        .filter(item => !Number.isNaN(item.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
}

function computeLunchBreak(row, attendanceConfig) {
    const events = normalizeEventTimes(row.marcaciones);
    if (events.length < 3) {
        return {
            salida_almuerzo: null,
            retorno_almuerzo: null,
            salida_almuerzo_hora: null,
            retorno_almuerzo_hora: null,
            minutos_almuerzo: null,
            minutos_almuerzo_exceso: null,
        };
    }

    const tz = attendanceConfig.timezone;
    const windowStart = parseTimeToMinutes(attendanceConfig.almuerzo_inicio || ATTENDANCE_DEFAULT.almuerzo_inicio);
    const windowEnd = parseTimeToMinutes(attendanceConfig.almuerzo_fin || ATTENDANCE_DEFAULT.almuerzo_fin);
    const expected = Number(attendanceConfig.almuerzo_minutos || ATTENDANCE_DEFAULT.almuerzo_minutos);

    const candidates = [];
    for (let idx = 0; idx < events.length - 1; idx += 1) {
        const salida = events[idx];
        const retorno = events[idx + 1];
        const salidaMin = parseTimeToMinutes(formatTimeInTimezone(salida, tz));
        const duration = Math.round((retorno.getTime() - salida.getTime()) / 60000);
        if (salidaMin < windowStart || salidaMin > windowEnd || duration <= 0) continue;
        candidates.push({
            salida,
            retorno,
            duration,
            score: Math.abs(duration - expected),
        });
    }

    if (!candidates.length) {
        return {
            salida_almuerzo: null,
            retorno_almuerzo: null,
            salida_almuerzo_hora: null,
            retorno_almuerzo_hora: null,
            minutos_almuerzo: null,
            minutos_almuerzo_exceso: null,
        };
    }

    candidates.sort((a, b) => a.score - b.score || b.duration - a.duration);
    const lunch = candidates[0];
    return {
        salida_almuerzo: lunch.salida.toISOString(),
        retorno_almuerzo: lunch.retorno.toISOString(),
        salida_almuerzo_hora: formatTimeInTimezone(lunch.salida, tz),
        retorno_almuerzo_hora: formatTimeInTimezone(lunch.retorno, tz),
        minutos_almuerzo: lunch.duration,
        minutos_almuerzo_exceso: Math.max(0, lunch.duration - expected),
    };
}

function getTodayInTimezone(timeZone) {
    return formatDateInTimezone(new Date(), timeZone);
}

module.exports = {
    ATTENDANCE_DEFAULT,
    computeLunchBreak,
    computeAttendanceStatus,
    fetchZKBioEvents,
    formatDateInTimezone,
    formatTimeInTimezone,
    getAttendanceConfig,
    getTodayInTimezone,
    getDayOfWeekInTimezone,
    pickHorarioPorDia,
};
