const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/vendedores  →  [{ id, nombre, iniciales, color, roles: ['Ventas','Marketing'] }]
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT v.id, v.nombre, v.iniciales, v.color,
                   COALESCE(array_agg(vr.rol ORDER BY vr.rol) FILTER (WHERE vr.rol IS NOT NULL), '{}') AS roles
            FROM vendedores v
            LEFT JOIN vendedor_roles vr ON vr.vendedor_id = v.id
            GROUP BY v.id
            ORDER BY v.id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/vendedores/:id/roles  →  body: { roles: ['Ventas','Marketing'] }
router.put('/:id/roles', async (req, res) => {
    const { id } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0)
        return res.status(400).json({ error: 'Se requiere un array roles no vacío' });

    const VALID = ['Gerencia', 'Marketing', 'Ventas', 'Retail'];
    const invalid = roles.filter(r => !VALID.includes(r));
    if (invalid.length)
        return res.status(400).json({ error: `Roles inválidos: ${invalid.join(', ')}` });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM vendedor_roles WHERE vendedor_id = $1', [id]);
        for (const rol of roles) {
            await client.query(
                'INSERT INTO vendedor_roles (vendedor_id, rol) VALUES ($1, $2)',
                [id, rol]
            );
        }
        await client.query('COMMIT');

        const { rows } = await client.query(`
            SELECT v.id, v.nombre, v.iniciales, v.color,
                   array_agg(vr.rol ORDER BY vr.rol) AS roles
            FROM vendedores v
            JOIN vendedor_roles vr ON vr.vendedor_id = v.id
            WHERE v.id = $1
            GROUP BY v.id
        `, [id]);

        if (!rows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
