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

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const { rows } = await pool.query(
            `INSERT INTO clientes (nombre, ruc, email, telefono, contacto, registrado_por, empresa_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre.trim(), ruc || '', email || '', telefono || '', contacto || '', registrado_por, empresa_id]
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
