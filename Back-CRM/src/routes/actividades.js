const router = require('express').Router();
const pool = require('../db/pool');

// Meses para calcular trimestre
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const Q_MAP = { '1':[0,1,2], '2':[3,4,5], '3':[6,7,8], '4':[9,10,11] };

// GET /api/actividades
router.get('/', async (req, res) => {
    try {
        const { vendedorId, mes, trimestre, tipo, estado, cliente } = req.query;

        let where = [];
        let params = [];
        let i = 1;

        if (vendedorId) { where.push(`vendedor_id = $${i++}`); params.push(vendedorId); }
        if (mes)        { where.push(`mes = $${i++}`);         params.push(mes); }
        if (tipo)       { where.push(`tipo = $${i++}`);        params.push(tipo); }
        if (estado)     { where.push(`estado = $${i++}`);      params.push(estado); }
        if (cliente)    { where.push(`cliente ILIKE $${i++}`); params.push(`%${cliente}%`); }

        if (trimestre && Q_MAP[trimestre]) {
            const mesesQ = Q_MAP[trimestre].map(idx => MESES[idx]);
            where.push(`mes = ANY($${i++})`);
            params.push(mesesQ);
        }

        const sql = `SELECT a.*, v.nombre AS vendedor_nombre, v.iniciales, v.color
                     FROM actividades a
                     JOIN vendedores v ON v.id = a.vendedor_id
                     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                     ORDER BY a.created_at DESC`;

        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// POST /api/actividades
router.post('/', async (req, res) => {
    try {
        const { id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha, elapsed, notas } = req.body;
        const ts = tsForEstado(estado);

        const { rows } = await pool.query(
            `INSERT INTO actividades
               (id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha, elapsed, notas,
                ts_pendiente, ts_en_progreso, ts_completado)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [id || Date.now(), nombre, tipo, vendedor_id, cliente, monto || 0,
             prioridad, estado, mes, fecha, elapsed || 0, notas || '',
             ts.ts_pendiente, ts.ts_en_progreso, ts.ts_completado]
        );

        const actividad = rows[0];
        req.io.emit('actividad:creada', actividad);
        res.status(201).json(actividad);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/actividades/:id
router.put('/:id', async (req, res) => {
    try {
        const allowed = ['nombre','tipo','vendedor_id','cliente','monto','prioridad','estado','mes','fecha','notas'];
        const fields = Object.keys(req.body).filter(k => allowed.includes(k));

        if (!fields.length) return res.status(400).json({ error: 'Sin campos válidos' });

        // Si cambia el estado, setear el timestamp correspondiente solo si aún es NULL
        const extraSets = [];
        const extraVals = [];
        if (req.body.estado) {
            const map = {
                'Pendiente':   'ts_pendiente',
                'En Progreso': 'ts_en_progreso',
                'Completado':  'ts_completado',
            };
            const col = map[req.body.estado];
            if (col) {
                extraSets.push(`${col} = COALESCE(${col}, NOW())`);
            }
        }

        const allFields = [...fields];
        const sets = [
            ...allFields.map((f, i) => `${f} = $${i + 1}`),
            ...extraSets,
        ].join(', ');
        const values = [...allFields.map(f => req.body[f]), req.params.id];

        const { rows } = await pool.query(
            `UPDATE actividades SET ${sets} WHERE id = $${allFields.length + 1} RETURNING *`,
            values
        );

        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

        req.io.emit('actividad:actualizada', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/actividades/:id/elapsed
router.put('/:id/elapsed', async (req, res) => {
    try {
        const { elapsed } = req.body;
        await pool.query('UPDATE actividades SET elapsed = $1 WHERE id = $2', [elapsed, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/actividades/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query('DELETE FROM actividades WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: 'No encontrado' });

        req.io.emit('actividad:eliminada', { id: Number(req.params.id) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
