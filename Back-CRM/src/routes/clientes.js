const router = require('express').Router();
const pool   = require('../db/pool');

async function fetchClienteById(id, empresa_id) {
    const { rows } = await pool.query(
        `SELECT c.*, v.nombre AS registrado_por_nombre, v.iniciales, v.color
         FROM clientes c
         LEFT JOIN vendedores v ON v.id = c.registrado_por
         WHERE c.id = $1 AND c.empresa_id = $2`,
        [id, empresa_id]
    );
    return rows[0] || null;
}

// POST /api/clientes/sunat/ruc
router.post('/sunat/ruc', async (req, res) => {
    try {
        const ruc = String(req.body?.ruc || '').replace(/\D/g, '');
        if (!/^\d{11}$/.test(ruc)) {
            return res.status(400).json({ error: 'Ingresa un RUC válido de 11 dígitos' });
        }

        const token = process.env.MIGO_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'Consulta SUNAT no configurada' });
        }

        const response = await fetch('https://api.migo.pe/api/v1/ruc', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, ruc }),
        });

        if (response.status === 403) {
            return res.status(403).json({ error: 'Token de consulta RUC inválido o sin créditos' });
        }
        if (response.status === 404) {
            return res.status(404).json({ error: 'RUC no encontrado' });
        }

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            console.error('[MIGO RUC]', response.status, data);
            return res.status(502).json({ error: 'No se pudo consultar SUNAT. Intenta nuevamente.' });
        }
        if (!data?.success) {
            return res.status(404).json({ error: 'RUC no encontrado' });
        }

        res.json({
            ruc: data.ruc || ruc,
            nombre: data.nombre_o_razon_social || '',
            estado: data.estado_del_contribuyente || '',
            condicion: data.condicion_de_domicilio || '',
            direccion: data.direccion || data.direccion_simple || '',
        });
    } catch (err) {
        console.error('[MIGO RUC]', err);
        res.status(502).json({ error: 'No se pudo consultar SUNAT. Intenta nuevamente.' });
    }
});

// GET /api/clientes
router.get('/', async (req, res) => {
    try {
        const empresa_id = req.user.empresa_id;
        const { q } = req.query;
        let sql = `
            SELECT c.*, v.nombre AS registrado_por_nombre, v.iniciales, v.color
            FROM clientes c
            LEFT JOIN vendedores v ON v.id = c.registrado_por
            WHERE c.empresa_id = $1
        `;
        const params = [empresa_id];
        if (q) { sql += ` AND c.nombre ILIKE $2`; params.push(`%${q}%`); }
        sql += ` ORDER BY c.nombre ASC`;
        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/clientes
router.post('/', async (req, res) => {
    try {
        const { nombre, ruc, email, telefono, contacto } = req.body;
        const empresa_id     = req.user.empresa_id;
        const registrado_por = req.user.is_superadmin ? null : req.user.id;
        const cleanRuc = String(ruc || '').replace(/\D/g, '');

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (cleanRuc) {
            if (!/^\d{11}$/.test(cleanRuc)) {
                return res.status(400).json({ error: 'Ingresa un RUC válido de 11 dígitos' });
            }

            const existing = await pool.query(
                `SELECT id FROM clientes WHERE empresa_id=$1 AND ruc=$2 LIMIT 1`,
                [empresa_id, cleanRuc]
            );
            if (existing.rows.length) {
                const cliente = await fetchClienteById(existing.rows[0].id, empresa_id);
                return res.status(200).json({ ...cliente, reused: true });
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO clientes (nombre, ruc, email, telefono, contacto, registrado_por, empresa_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre.trim(), cleanRuc, email || '', telefono || '', contacto || '', registrado_por, empresa_id]
        );
        res.status(201).json(await fetchClienteById(rows[0].id, empresa_id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
    try {
        const { nombre, ruc, email, telefono, contacto } = req.body;
        const empresa_id = req.user.empresa_id;

        const { rows } = await pool.query(
            `UPDATE clientes SET nombre=$1, ruc=$2, email=$3, telefono=$4, contacto=$5
             WHERE id=$6 AND empresa_id=$7 RETURNING *`,
            [nombre, ruc || '', email || '', telefono || '', contacto || '', req.params.id, empresa_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
        res.json(await fetchClienteById(rows[0].id, empresa_id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
