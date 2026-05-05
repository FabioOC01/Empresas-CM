const router = require('express').Router();
const pool = require('../db/pool');
const {
    computeAttendanceStatus,
    fetchZKBioEvents,
    formatTimeInTimezone,
    getAttendanceConfig,
    getTodayInTimezone,
} = require('../lib/attendance');

function canManageAttendance(user) {
    return user?.is_superadmin || user?.roles?.some(r => ['Admin', 'Gerencia'].includes(r));
}

async function getEmpresaAttendanceConfig(empresaId) {
    const { rows } = await pool.query(
        'SELECT attendance_config FROM empresas WHERE id = $1',
        [empresaId]
    );
    return getAttendanceConfig(rows[0]?.attendance_config);
}

router.get('/resumen', async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;
        const attendanceConfig = await getEmpresaAttendanceConfig(empresaId);
        const fecha = req.query.fecha || getTodayInTimezone(attendanceConfig.timezone);
        const requestedVendorId = req.query.vendedorId;
        const forceVendorId = canManageAttendance(req.user) ? null : req.user.id;
        const vendedorId = forceVendorId || requestedVendorId || null;

        const params = [empresaId, fecha];
        let where = 'WHERE v.empresa_id = $1 AND v.asistencia_activa = TRUE';
        if (vendedorId) {
            params.push(vendedorId);
            where += ` AND v.id = $${params.length}`;
        }

        const { rows } = await pool.query(`
            SELECT
                v.id AS vendedor_id,
                v.nombre,
                v.iniciales,
                v.color,
                v.foto_url,
                v.cargo,
                v.zkbio_employee_code,
                v.zkbio_device_name,
                r.fecha,
                r.primera_entrada,
                r.ultima_salida,
                r.ultima_marcacion,
                r.total_marcaciones,
                r.sede
            FROM vendedores v
            LEFT JOIN asistencia_resumen_diario r
              ON r.empresa_id = v.empresa_id
             AND r.zkbio_employee_code = v.zkbio_employee_code
             AND r.fecha = $2
            ${where}
            ORDER BY v.nombre
        `, params);

        let summary = rows.map(row => {
            const status = computeAttendanceStatus(row, attendanceConfig);
            return {
                vendedor_id: row.vendedor_id,
                nombre: row.nombre,
                iniciales: row.iniciales,
                color: row.color,
                foto_url: row.foto_url,
                cargo: row.cargo,
                zkbio_employee_code: row.zkbio_employee_code,
                zkbio_device_name: row.zkbio_device_name,
                fecha,
                sede: row.sede || row.zkbio_device_name || null,
                primera_entrada: row.primera_entrada,
                primera_entrada_hora: row.primera_entrada ? formatTimeInTimezone(new Date(row.primera_entrada), attendanceConfig.timezone) : null,
                ultima_salida: row.ultima_salida,
                ultima_salida_hora: row.ultima_salida ? formatTimeInTimezone(new Date(row.ultima_salida), attendanceConfig.timezone) : null,
                ultima_marcacion: row.ultima_marcacion,
                ultima_marcacion_hora: row.ultima_marcacion ? formatTimeInTimezone(new Date(row.ultima_marcacion), attendanceConfig.timezone) : null,
                total_marcaciones: Number(row.total_marcaciones || 0),
                estado: status.estado,
                minutos_tardanza: status.minutos_tardanza,
            };
        });

        if (req.query.estado) summary = summary.filter(row => row.estado === req.query.estado);
        if (req.query.sede) summary = summary.filter(row => (row.sede || '') === req.query.sede);

        res.json({
            fecha,
            config: attendanceConfig,
            rows: summary,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/vendedor/:id', async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;
        const attendanceConfig = await getEmpresaAttendanceConfig(empresaId);
        const forceVendorId = canManageAttendance(req.user) ? null : req.user.id;
        const vendedorId = forceVendorId || req.params.id;
        const desde = req.query.desde || getTodayInTimezone(attendanceConfig.timezone);
        const hasta = req.query.hasta || desde;

        const { rows: vendorRows } = await pool.query(`
            SELECT id, nombre, iniciales, color, foto_url, cargo,
                   zkbio_employee_code, zkbio_device_name, asistencia_activa
            FROM vendedores
            WHERE id = $1 AND empresa_id = $2
        `, [vendedorId, empresaId]);

        if (!vendorRows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });

        const vendor = vendorRows[0];
        const { rows } = await pool.query(`
            SELECT attendance_date, event_at, device_name, event_type, source_payload
            FROM asistencia_marcaciones
            WHERE empresa_id = $1
              AND zkbio_employee_code = $2
              AND attendance_date BETWEEN $3 AND $4
            ORDER BY event_at DESC
        `, [empresaId, vendor.zkbio_employee_code || '__sin_codigo__', desde, hasta]);

        res.json({
            vendedor: vendor,
            config: attendanceConfig,
            rows: rows.map(row => ({
                ...row,
                event_time_hora: formatTimeInTimezone(new Date(row.event_at), attendanceConfig.timezone),
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/unmapped', async (req, res) => {
    if (!canManageAttendance(req.user))
        return res.status(403).json({ error: 'Se requiere rol Admin o Gerencia' });

    try {
        const { rows } = await pool.query(`
            SELECT
                m.zkbio_employee_code,
                MAX(m.device_name) AS sede,
                MAX(m.event_at) AS ultima_marcacion,
                COUNT(*) AS total_marcaciones
            FROM asistencia_marcaciones m
            LEFT JOIN vendedores v
              ON v.empresa_id = m.empresa_id
             AND v.zkbio_employee_code = m.zkbio_employee_code
            WHERE m.empresa_id = $1
              AND v.id IS NULL
            GROUP BY m.zkbio_employee_code
            ORDER BY MAX(m.event_at) DESC
        `, [req.user.empresa_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/health', async (req, res) => {
    try {
        const [logResult, unmappedResult] = await Promise.all([
            pool.query(`
                SELECT started_at, finished_at, desde, hasta, status,
                       records_fetched, records_inserted, error_message
                FROM asistencia_sync_log
                WHERE empresa_id = $1
                ORDER BY started_at DESC
                LIMIT 1
            `, [req.user.empresa_id]),
            pool.query(`
                SELECT COUNT(DISTINCT m.zkbio_employee_code) AS unmapped_codes
                FROM asistencia_marcaciones m
                LEFT JOIN vendedores v
                  ON v.empresa_id = m.empresa_id
                 AND v.zkbio_employee_code = m.zkbio_employee_code
                WHERE m.empresa_id = $1
                  AND v.id IS NULL
            `, [req.user.empresa_id]),
        ]);

        res.json({
            last_sync: logResult.rows[0] || null,
            unmapped_codes: Number(unmappedResult.rows[0]?.unmapped_codes || 0),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/sync', async (req, res) => {
    if (!canManageAttendance(req.user))
        return res.status(403).json({ error: 'Se requiere rol Admin o Gerencia' });

    const empresaId = req.user.empresa_id;
    let logId = null;

    try {
        const attendanceConfig = await getEmpresaAttendanceConfig(empresaId);
        const hoy = getTodayInTimezone(attendanceConfig.timezone);
        // Default: últimos 7 días si no se especifica nada
        const haceUnaSemana = (() => {
            const d = new Date(`${hoy}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - 6);
            return d.toISOString().slice(0, 10);
        })();
        const desde = req.body?.desde || haceUnaSemana;
        const hasta = req.body?.hasta || hoy;

        const { rows: logRows } = await pool.query(`
            INSERT INTO asistencia_sync_log (empresa_id, desde, hasta, status)
            VALUES ($1, $2, $3, 'running')
            RETURNING id
        `, [empresaId, desde, hasta]);
        logId = logRows[0].id;

        const events = await fetchZKBioEvents({
            desde,
            hasta,
            timezone: attendanceConfig.timezone,
        });

        const client = await pool.connect();
        let inserted = 0;
        try {
            await client.query('BEGIN');
            for (const event of events) {
                const result = await client.query(`
                    INSERT INTO asistencia_marcaciones (
                        empresa_id, zkbio_employee_code, attendance_date, event_at,
                        device_name, event_type, external_key, source_payload
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                    ON CONFLICT (empresa_id, external_key) DO NOTHING
                `, [
                    empresaId,
                    event.employee_code,
                    event.attendance_date,
                    event.event_time,
                    event.device_name,
                    event.event_type,
                    event.external_key,
                    JSON.stringify(event.payload || {}),
                ]);
                inserted += result.rowCount;
            }

            await client.query(`
                UPDATE asistencia_sync_log
                SET finished_at = NOW(),
                    status = 'success',
                    records_fetched = $2,
                    records_inserted = $3
                WHERE id = $1
            `, [logId, events.length, inserted]);

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({
            ok: true,
            desde,
            hasta,
            records_fetched: events.length,
            records_inserted: inserted,
        });
    } catch (err) {
        console.error(err);
        if (logId) {
            await pool.query(`
                UPDATE asistencia_sync_log
                SET finished_at = NOW(),
                    status = 'error',
                    error_message = $2
                WHERE id = $1
            `, [logId, err.message]).catch(() => {});
        }
        res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
    }
});

module.exports = router;
