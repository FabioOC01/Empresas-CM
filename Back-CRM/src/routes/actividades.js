const router = require('express').Router();
const pool = require('../db/pool');
const { uploadDoc } = require('../lib/cloudinary');

// Meses para calcular trimestre
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const Q_MAP = { '1':[0,1,2], '2':[3,4,5], '3':[6,7,8], '4':[9,10,11] };

// GET /api/actividades
router.get('/', async (req, res) => {
    try {
        const { vendedorId, mes, trimestre, tipo, estado, cliente } = req.query;
        const empresa_id = req.user.empresa_id;

        let where = ['a.empresa_id = $1'];
        let params = [empresa_id];
        let i = 2;

        if (vendedorId) { where.push(`a.vendedor_id = $${i++}`); params.push(vendedorId); }
        if (mes)        { where.push(`a.mes = $${i++}`);          params.push(mes); }
        if (tipo)       { where.push(`a.tipo = $${i++}`);         params.push(tipo); }
        if (estado)     { where.push(`a.estado = $${i++}`);       params.push(estado); }
        if (cliente)    { where.push(`a.cliente ILIKE $${i++}`);  params.push(`%${cliente}%`); }

        if (trimestre && Q_MAP[trimestre]) {
            const mesesQ = Q_MAP[trimestre].map(idx => MESES[idx]);
            where.push(`a.mes = ANY($${i++})`);
            params.push(mesesQ);
        }

        const sql = `SELECT a.*, v.nombre AS vendedor_nombre, v.iniciales, v.color, v.foto_url
                     FROM actividades a
                     JOIN vendedores v ON v.id = a.vendedor_id
                     WHERE ${where.join(' AND ')}
                     ORDER BY a.created_at DESC`;

        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Devuelve el objeto { ts_pendiente, ts_en_progreso, ts_completado } según el estado inicial
function tsForEstado(estado) {
    const now = new Date();
    return {
        ts_pendiente:   now,
        ts_en_progreso: ['En Progreso','Completado','Cancelado'].includes(estado) ? now : null,
        ts_completado:  estado === 'Completado' ? now : null,
    };
}

// Helper: true si el usuario puede gestionar actividades de cualquier vendedor
function canManageAll(user) {
    return user.is_superadmin || user.roles?.some(r => ['Admin','Gerencia'].includes(r));
}

// POST /api/actividades
router.post('/', async (req, res) => {
    try {
        const { id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha, fecha_fin, elapsed, notas,
                precio_venta, costo_base, gastos_operativos, ajuste_interno,
                cliente_ruc, cliente_email, cliente_telefono,
                colaboradores, checklist } = req.body;
        const empresa_id = req.user.empresa_id;

        // Solo Admin/Gerencia/Superadmin pueden asignar actividades a otros vendedores
        if (!canManageAll(req.user) && vendedor_id !== req.user.id)
            return res.status(403).json({ error: 'No puedes crear actividades para otro vendedor' });
        const ts = tsForEstado(estado);

        const { rows } = await pool.query(
            `INSERT INTO actividades
               (id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha, fecha_fin, elapsed, notas,
                ts_pendiente, ts_en_progreso, ts_completado,
                precio_venta, costo_base, gastos_operativos, ajuste_interno,
                cliente_ruc, cliente_email, cliente_telefono,
                colaboradores, checklist, empresa_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
             RETURNING *`,
            [id || Date.now(), nombre, tipo, vendedor_id, cliente, monto || 0,
             prioridad, estado, mes, fecha, fecha_fin || null, elapsed || 0, notas || '',
             ts.ts_pendiente, ts.ts_en_progreso, ts.ts_completado,
             precio_venta || 0, costo_base || 0,
             JSON.stringify(gastos_operativos || []), ajuste_interno || 0,
             cliente_ruc || '', cliente_email || '', cliente_telefono || '',
             JSON.stringify(colaboradores || []), JSON.stringify(checklist || []),
             empresa_id]
        );

        const actividad = rows[0];
        req.io.to(empresa_id).emit('actividad:creada', actividad);
        res.status(201).json(actividad);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/actividades/:id
router.put('/:id', async (req, res) => {
    try {
        const empresa_id = req.user.empresa_id;

        // Verificar ownership si no es Admin/Gerencia
        // Colaboradores pueden editar SOLO el campo `checklist`
        let soloChecklist = false;
        if (!canManageAll(req.user)) {
            const { rows } = await pool.query(
                'SELECT vendedor_id, colaboradores FROM actividades WHERE id=$1 AND empresa_id=$2',
                [req.params.id, empresa_id]
            );
            if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
            const esOwner = rows[0].vendedor_id === req.user.id;
            const cols = Array.isArray(rows[0].colaboradores) ? rows[0].colaboradores : [];
            const esColab = cols.includes(req.user.id);
            if (!esOwner && !esColab)
                return res.status(403).json({ error: 'No puedes editar actividades de otro vendedor' });
            if (!esOwner) soloChecklist = true;
        }

        const allowedFull = ['nombre','tipo','vendedor_id','cliente','monto','prioridad','estado','mes','notas','fecha_fin',
                         'precio_venta','costo_base','gastos_operativos','ajuste_interno',
                         'cliente_ruc','cliente_email','cliente_telefono',
                         'colaboradores','checklist'];
        // Solo Admin/Gerencia pueden editar la fecha de creación de la actividad
        if (canManageAll(req.user)) allowedFull.push('fecha');
        const allowed = soloChecklist ? ['checklist'] : allowedFull;
        const fields = Object.keys(req.body).filter(k => allowed.includes(k));

        if (!fields.length) return res.status(400).json({ error: 'Sin campos válidos' });

        // Si cambia el estado, setear el timestamp correspondiente solo si aún es NULL
        const extraSets = [];
        if (req.body.estado) {
            const map = {
                'Pendiente':   'ts_pendiente',
                'En Progreso': 'ts_en_progreso',
                'Completado':  'ts_completado',
            };
            const col = map[req.body.estado];
            if (col) extraSets.push(`${col} = COALESCE(${col}, NOW())`);
        }

        const sets = [
            ...fields.map((f, i) => `${f} = $${i + 1}`),
            ...extraSets,
        ].join(', ');
        const JSON_FIELDS = new Set(['gastos_operativos','colaboradores','checklist']);
        const values = [
            ...fields.map(f => JSON_FIELDS.has(f) ? JSON.stringify(req.body[f] ?? []) : req.body[f]),
            req.params.id, empresa_id,
        ];

        const { rows } = await pool.query(
            `UPDATE actividades SET ${sets}
             WHERE id = $${fields.length + 1} AND empresa_id = $${fields.length + 2}
             RETURNING *`,
            values
        );

        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

        req.io.to(empresa_id).emit('actividad:actualizada', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/actividades/:id/elapsed
router.put('/:id/elapsed', async (req, res) => {
    try {
        const { elapsed } = req.body;
        const empresa_id = req.user.empresa_id;
        await pool.query(
            'UPDATE actividades SET elapsed = $1 WHERE id = $2 AND empresa_id = $3',
            [elapsed, req.params.id, empresa_id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/actividades/:id
router.delete('/:id', async (req, res) => {
    try {
        const empresa_id = req.user.empresa_id;

        // Solo Admin/Gerencia pueden eliminar actividades
        if (!canManageAll(req.user))
            return res.status(403).json({ error: 'No tienes permiso para eliminar actividades' });

        const { rowCount } = await pool.query(
            'DELETE FROM actividades WHERE id = $1 AND empresa_id = $2',
            [req.params.id, empresa_id]
        );
        if (!rowCount) return res.status(404).json({ error: 'No encontrado' });

        req.io.to(empresa_id).emit('actividad:eliminada', { id: Number(req.params.id) });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/actividades/:id/archivos  →  adjuntar archivo a una actividad
router.post('/:id/archivos', uploadDoc.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const empresa_id = req.user.empresa_id;

    try {
        const nuevo = {
            url:    req.file.path,
            nombre: req.file.originalname,
            tipo:   req.file.mimetype,
            fecha:  new Date().toISOString(),
        };
        const { rows } = await pool.query(
            `UPDATE actividades
             SET archivos = archivos || $1::jsonb
             WHERE id = $2 AND empresa_id = $3
             RETURNING archivos`,
            [JSON.stringify([nuevo]), req.params.id, empresa_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Actividad no encontrada' });
        res.json(nuevo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/actividades/:id/archivos  →  body: { url }
router.delete('/:id/archivos', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Se requiere url' });
    const empresa_id = req.user.empresa_id;

    try {
        const { rows } = await pool.query(
            `UPDATE actividades
             SET archivos = COALESCE(
               (SELECT jsonb_agg(a)
                FROM jsonb_array_elements(archivos) a
                WHERE a->>'url' != $1),
               '[]'::jsonb
             )
             WHERE id = $2 AND empresa_id = $3
             RETURNING archivos`,
            [url, req.params.id, empresa_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Actividad no encontrada' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
