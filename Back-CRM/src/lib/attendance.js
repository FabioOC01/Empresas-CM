const crypto = require('crypto');
const { Pool } = require('pg');

const ATTENDANCE_DEFAULT = {
    timezone: 'America/Lima',
    ingreso_esperado: '09:30',
    tolerancia_minutos: 10,
    tardanza_modo: 'primera_entrada',
    sedes: [],
};

let sourcePool = null;

function getAttendanceConfig(config) {
    return {
        ...ATTENDANCE_DEFAULT,
        ...(config || {}),
        tolerancia_minutos: Number(config?.tolerancia_minutos ?? ATTENDANCE_DEFAULT.tolerancia_minutos),
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
    const eventAt = rawDate ? new Date(rawDate) : null;
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

function computeAttendanceStatus(row, attendanceConfig) {
    if (!row.zkbio_employee_code) {
        return { estado: 'Sin vincular', minutos_tardanza: null };
    }
    if (!row.primera_entrada) {
        return { estado: 'Ausente', minutos_tardanza: null };
    }

    const tz = attendanceConfig.timezone;
    const firstTime = formatTimeInTimezone(new Date(row.primera_entrada), tz);
    const lateMinutes = Math.max(
        0,
        parseTimeToMinutes(firstTime) -
        parseTimeToMinutes(attendanceConfig.ingreso_esperado) -
        Number(attendanceConfig.tolerancia_minutos || 0)
    );

    if ((row.total_marcaciones || 0) < 2) {
        return { estado: 'Sin marcación de salida', minutos_tardanza: lateMinutes || 0 };
    }
    if (lateMinutes > 0) {
        return { estado: 'Tardanza', minutos_tardanza: lateMinutes };
    }
    return { estado: 'A tiempo', minutos_tardanza: 0 };
}

function getTodayInTimezone(timeZone) {
    return formatDateInTimezone(new Date(), timeZone);
}

module.exports = {
    ATTENDANCE_DEFAULT,
    computeAttendanceStatus,
    fetchZKBioEvents,
    formatDateInTimezone,
    formatTimeInTimezone,
    getAttendanceConfig,
    getTodayInTimezone,
};
