const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { uploadAvatar } = require('../lib/cloudinary');

const VALID_ROLES = ['Admin', 'Gerencia', 'Marketing', 'Ventas', 'Corporativo', 'Soporte Técnico', 'Logística', 'Finanzas'];

function normalizeUsername(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '');
}

async function getVendedoresColumns(client = pool) {
    const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendedores'
    `);
    return new Set(rows.map((row) => row.column_name));
}

function usernameExpr(columns) {
    if (columns.has('username')) return 'v.username';
    return "lower(replace(trim(v.nombre), ' ', '.'))";
}

function pctBaseExpr(columns) {
    if (columns.has('pct_comision_base')) return 'v.pct_comision_base';
    return '0.02::numeric AS pct_comision_base';
}

function metaActividadesExpr(columns) {
    if (columns.has('meta_actividades_semanal')) return 'v.meta_actividades_semanal';
    return '0::integer AS meta_actividades_semanal';
}

// GET /api/vendedores
router.get('/', async (req, res) => {
    try {
        const empresa_id = req.user.empresa_id;
        const columns = await getVendedoresColumns();
        const { rows } = await pool.query(`
            SELECT v.id, v.nombre, v.iniciales, v.color, ${usernameExpr(columns)} AS username, v.email, v.cargo,
                   v.meta_mensual, v.umbral_comision,
                   v.meta_facturacion_mensual, v.meta_rentabilidad_trimestral, v.meta_facturacion_trimestral,
                   v.meta_rentabilidad_anual, v.meta_facturacion_anual, ${metaActividadesExpr(columns)},
                   ${pctBaseExpr(columns)},
                   v.pct_comision_bajo, v.pct_comision_alto, v.foto_url,
                   v.zkbio_employee_code, v.zkbio_device_name, v.asistencia_activa, v.horario_dias,
                   COALESCE(array_agg(vr.rol ORDER BY vr.rol) FILTER (WHERE vr.rol IS NOT NULL), '{}') AS roles
            FROM vendedores v
            LEFT JOIN vendedor_roles vr ON vr.vendedor_id = v.id
            WHERE v.empresa_id = $1
            GROUP BY v.id
            ORDER BY v.id
        `, [empresa_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/vendedores -> crear nuevo vendedor (solo Admin)
router.post('/', async (req, res) => {
    if (!req.user?.roles?.includes('Admin') && !req.user?.is_superadmin) {
        return res.status(403).json({ error: 'Se requiere rol Admin' });
    }

    const {
        nombre, iniciales, color, username, email, password, cargo, roles,
        zkbio_employee_code, zkbio_device_name, asistencia_activa, horario_dias,
    } = req.body;
    const empresa_id = req.user.empresa_id;

    if (!nombre || !iniciales || !username || !email || !password) {
        return res.status(400).json({ error: 'nombre, iniciales, username, email y password son obligatorios' });
    }
    if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un rol' });
    }

    const invalid = roles.filter((rol) => !VALID_ROLES.includes(rol));
    if (invalid.length) {
        return res.status(400).json({ error: `Roles invalidos: ${invalid.join(', ')}` });
    }

    const usernameClean = normalizeUsername(username);
    if (!usernameClean) {
        return res.status(400).json({ error: 'El username no es valido' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const columns = await getVendedoresColumns(client);

        if (!columns.has('username')) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Falta la columna username en vendedores. Ejecuta la migracion 021_vendedor_username_comision_base.sql.' });
        }

        const hash = await bcrypt.hash(password, 12);
        const id = usernameClean.replace(/\./g, '_');

        const insertColumns = [
            'id', 'nombre', 'iniciales', 'color', 'username', 'email', 'password_hash', 'cargo', 'empresa_id',
            'zkbio_employee_code', 'zkbio_device_name', 'asistencia_activa',
        ];
        const insertValues = [
            id,
            nombre,
            iniciales.toUpperCase().slice(0, 3),
            color || '#2f6fd4',
            usernameClean,
            email.toLowerCase().trim(),
            hash,
            cargo || '',
            empresa_id,
            zkbio_employee_code || null,
            zkbio_device_name || null,
            asistencia_activa ?? true,
        ];
        if (horario_dias !== undefined && columns.has('horario_dias')) {
            insertColumns.push('horario_dias');
            insertValues.push(horario_dias === null ? null : JSON.stringify(horario_dias));
        }

        const placeholders = insertValues.map((_, idx) => {
            const suffix = insertColumns[idx] === 'horario_dias' ? '::jsonb' : '';
            return `$${idx + 1}${suffix}`;
        });

        const returningHorario = columns.has('horario_dias') ? ', horario_dias' : '';
        const { rows } = await client.query(`
            INSERT INTO vendedores (${insertColumns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING id, nombre, iniciales, color, username, email, cargo,
                      zkbio_employee_code, zkbio_device_name, asistencia_activa${returningHorario}
        `, insertValues);

        for (const rol of roles) {
            await client.query(
                'INSERT INTO vendedor_roles (vendedor_id, rol) VALUES ($1, $2)',
                [id, rol]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ ...rows[0], roles });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un vendedor con ese username, email o ID' });
        }
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// PUT /api/vendedores/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nombre, iniciales, color, username, email, cargo, password, roles,
        zkbio_employee_code, zkbio_device_name, asistencia_activa, horario_dias,
    } = req.body;
    const empresa_id = req.user.empresa_id;

    if (!req.user?.roles?.includes('Admin') && !req.user?.is_superadmin) {
        return res.status(403).json({ error: 'Se requiere rol Admin' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const columns = await getVendedoresColumns(client);

        const { rowCount: exists } = await client.query(
            'SELECT 1 FROM vendedores WHERE id = $1 AND empresa_id = $2',
            [id, empresa_id]
        );
        if (!exists) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Vendedor no encontrado' });
        }

        const sets = [];
        const vals = [];
        let i = 1;

        if (nombre !== undefined) { sets.push(`nombre = $${i++}`); vals.push(nombre); }
        if (iniciales !== undefined) { sets.push(`iniciales = $${i++}`); vals.push(iniciales.toUpperCase().slice(0, 3)); }
        if (color !== undefined) { sets.push(`color = $${i++}`); vals.push(color); }
        if (username !== undefined) {
            if (!columns.has('username')) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Falta la columna username en vendedores. Ejecuta la migracion 021_vendedor_username_comision_base.sql.' });
            }
            sets.push(`username = $${i++}`);
            vals.push(normalizeUsername(username));
        }
        if (email !== undefined) { sets.push(`email = $${i++}`); vals.push(email.toLowerCase().trim()); }
        if (cargo !== undefined) { sets.push(`cargo = $${i++}`); vals.push(cargo); }
        if (zkbio_employee_code !== undefined) { sets.push(`zkbio_employee_code = $${i++}`); vals.push(zkbio_employee_code || null); }
        if (zkbio_device_name !== undefined) { sets.push(`zkbio_device_name = $${i++}`); vals.push(zkbio_device_name || null); }
        if (asistencia_activa !== undefined) { sets.push(`asistencia_activa = $${i++}`); vals.push(!!asistencia_activa); }
        if (horario_dias !== undefined && columns.has('horario_dias')) {
            sets.push(`horario_dias = $${i++}::jsonb`);
            vals.push(horario_dias === null ? null : JSON.stringify(horario_dias));
        }

        if (password) {
            const hash = await bcrypt.hash(password, 12);
            sets.push(`password_hash = $${i++}`);
            vals.push(hash);
        }

        if (sets.length) {
            vals.push(id);
            await client.query(
                `UPDATE vendedores SET ${sets.join(', ')} WHERE id = $${i}`,
                vals
            );
        }

        if (Array.isArray(roles) && roles.length > 0) {
            const invalid = roles.filter((rol) => !VALID_ROLES.includes(rol));
            if (invalid.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Roles invalidos: ${invalid.join(', ')}` });
            }
            await client.query('DELETE FROM vendedor_roles WHERE vendedor_id = $1', [id]);
            for (const rol of roles) {
                await client.query(
                    'INSERT INTO vendedor_roles (vendedor_id, rol) VALUES ($1, $2)',
                    [id, rol]
                );
            }
        }

        await client.query('COMMIT');

        const { rows } = await client.query(`
            SELECT v.id, v.nombre, v.iniciales, v.color, ${usernameExpr(columns)} AS username, v.email, v.cargo,
                   v.zkbio_employee_code, v.zkbio_device_name, v.asistencia_activa, v.horario_dias,
                   COALESCE(array_agg(vr.rol ORDER BY vr.rol) FILTER (WHERE vr.rol IS NOT NULL), '{}') AS roles
            FROM vendedores v
            LEFT JOIN vendedor_roles vr ON vr.vendedor_id = v.id
            WHERE v.id = $1
            GROUP BY v.id
        `, [id]);

        res.json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// POST /api/vendedores/:id/foto
router.post('/:id/foto', uploadAvatar.single('foto'), async (req, res) => {
    if (!req.user?.roles?.includes('Admin') && !req.user?.is_superadmin) {
        return res.status(403).json({ error: 'Se requiere rol Admin' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibio ningun archivo' });

    try {
        const foto_url = req.file.path;
        await pool.query(
            'UPDATE vendedores SET foto_url = $1 WHERE id = $2 AND empresa_id = $3',
            [foto_url, req.params.id, req.user.empresa_id]
        );
        res.json({ foto_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/vendedores/:id/metas
router.put('/:id/metas', async (req, res) => {
    const canEdit = req.user?.roles?.includes('Admin') || req.user?.is_superadmin;
    if (!canEdit) return res.status(403).json({ error: 'Se requiere rol Admin' });

    const {
        meta_mensual,
        meta_facturacion_mensual,
        meta_rentabilidad_trimestral,
        meta_facturacion_trimestral,
        meta_rentabilidad_anual,
        meta_facturacion_anual,
        meta_actividades_semanal,
        umbral_comision,
        pct_comision_base,
        pct_comision_bajo,
        pct_comision_alto,
    } = req.body;
    const empresa_id = req.user.empresa_id;

    try {
        const columns = await getVendedoresColumns();
        if (!columns.has('pct_comision_base')) {
            return res.status(400).json({ error: 'Falta la columna pct_comision_base en vendedores. Ejecuta la migracion 021_vendedor_username_comision_base.sql.' });
        }

        const hasMetaActividades = columns.has('meta_actividades_semanal');
        const setMetaActividades = hasMetaActividades
            ? ', meta_actividades_semanal = $11'
            : '';
        const returningMetaActividades = hasMetaActividades
            ? ', meta_actividades_semanal'
            : ', 0::integer AS meta_actividades_semanal';
        const idParam = hasMetaActividades ? 12 : 11;
        const empresaParam = hasMetaActividades ? 13 : 12;
        const params = [
            meta_mensual,
            umbral_comision,
            pct_comision_base ?? 0.02,
            pct_comision_bajo ?? 0.07,
            pct_comision_alto ?? 0.08,
            meta_facturacion_mensual ?? 0,
            meta_rentabilidad_trimestral ?? 0,
            meta_facturacion_trimestral ?? 0,
            meta_rentabilidad_anual ?? 0,
            meta_facturacion_anual  ?? 0,
        ];
        if (hasMetaActividades) {
            params.push(Math.max(0, parseInt(meta_actividades_semanal, 10) || 0));
        }
        params.push(req.params.id, empresa_id);

        const { rows } = await pool.query(`
            UPDATE vendedores
            SET meta_mensual = $1,
                umbral_comision = $2,
                pct_comision_base = $3,
                pct_comision_bajo = $4,
                pct_comision_alto = $5,
                meta_facturacion_mensual = $6,
                meta_rentabilidad_trimestral = $7,
                meta_facturacion_trimestral = $8,
                meta_rentabilidad_anual = $9,
                meta_facturacion_anual  = $10
                ${setMetaActividades}
            WHERE id = $${idParam} AND empresa_id = $${empresaParam}
            RETURNING id, meta_mensual, umbral_comision, pct_comision_base, pct_comision_bajo, pct_comision_alto,
                      meta_facturacion_mensual, meta_rentabilidad_trimestral, meta_facturacion_trimestral,
                      meta_rentabilidad_anual, meta_facturacion_anual${returningMetaActividades}
        `, params);

        if (!rows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
