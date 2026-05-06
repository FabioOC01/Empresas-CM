const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET /api/config
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT nombre, horario_dias, tasa_sunat, tasa_comision, feriados,
                    moneda, tipos_actividad, pipeline_etapas, rol_tipos, branding,
                    attendance_config, meta_global_rentabilidad, meta_global_facturacion
             FROM empresas WHERE id = $1`,
            [req.user.empresa_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Empresa no encontrada' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/config — solo Admin o Gerencia
router.put('/', async (req, res) => {
    const canEdit = req.user?.is_superadmin ||
        req.user?.roles?.some(r => ['Admin', 'Gerencia'].includes(r));
    if (!canEdit) return res.status(403).json({ error: 'Se requiere rol Admin o Gerencia' });

    const { horario_dias, tasa_sunat, tasa_comision, feriados,
            moneda, tipos_actividad, pipeline_etapas, rol_tipos, branding,
            attendance_config, meta_global_rentabilidad, meta_global_facturacion } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE empresas
             SET horario_dias    = COALESCE($1::jsonb, horario_dias),
                 tasa_sunat      = COALESCE($2, tasa_sunat),
                 tasa_comision   = COALESCE($3, tasa_comision),
                 feriados        = COALESCE($4::jsonb, feriados),
                 moneda          = COALESCE($5, moneda),
                 tipos_actividad = COALESCE($6::jsonb, tipos_actividad),
                 pipeline_etapas = COALESCE($7::jsonb, pipeline_etapas),
                 rol_tipos       = COALESCE($8::jsonb, rol_tipos),
                 branding        = COALESCE($9::jsonb, branding),
                 attendance_config = COALESCE($10::jsonb, attendance_config),
                 meta_global_rentabilidad = COALESCE($12, meta_global_rentabilidad),
                 meta_global_facturacion  = COALESCE($13, meta_global_facturacion)
             WHERE id = $11
             RETURNING horario_dias, tasa_sunat, tasa_comision, feriados,
                       moneda, tipos_actividad, pipeline_etapas, rol_tipos, branding,
                       attendance_config, meta_global_rentabilidad, meta_global_facturacion`,
            [
                horario_dias    != null ? JSON.stringify(horario_dias)    : null,
                tasa_sunat      ?? null,
                tasa_comision   ?? null,
                feriados        != null ? JSON.stringify(feriados)        : null,
                moneda          ?? null,
                tipos_actividad != null ? JSON.stringify(tipos_actividad) : null,
                pipeline_etapas != null ? JSON.stringify(pipeline_etapas) : null,
                rol_tipos       != null ? JSON.stringify(rol_tipos)       : null,
                branding        != null ? JSON.stringify(branding)        : null,
                attendance_config != null ? JSON.stringify(attendance_config) : null,
                req.user.empresa_id,
                meta_global_rentabilidad ?? null,
                meta_global_facturacion  ?? null,
            ]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
