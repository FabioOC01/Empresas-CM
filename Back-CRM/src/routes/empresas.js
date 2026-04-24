const router = require('express').Router();
const pool   = require('../db/pool');

// GET /api/empresas  →  lista de todas las empresas (solo superadmin)
router.get('/', async (req, res) => {
    try {
        if (!req.user?.is_superadmin)
            return res.status(403).json({ error: 'Solo superadmins' });

        const { rows } = await pool.query(
            `SELECT e.id, e.nombre, e.created_at,
                    COUNT(DISTINCT v.id) AS num_vendedores,
                    COUNT(DISTINCT a.id) AS num_actividades
             FROM empresas e
             LEFT JOIN vendedores  v ON v.empresa_id = e.id
             LEFT JOIN actividades a ON a.empresa_id = e.id
             GROUP BY e.id
             ORDER BY e.created_at`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
