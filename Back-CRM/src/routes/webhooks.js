const router = require('express').Router();
const pool   = require('../db/pool');

const EMPRESA_ID    = 'comutel';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'Comutel.2026.Comutel.2025';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function parseMonto(v) {
    if (v == null) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

async function findVendedorByFirstName(firstName) {
    if (!firstName) return null;
    const { rows } = await pool.query(
        `SELECT id, nombre FROM vendedores
         WHERE empresa_id = $1
           AND split_part(lower(nombre), ' ', 1) = lower($2)
         LIMIT 1`,
        [EMPRESA_ID, firstName.trim()]
    );
    return rows[0] || null;
}

async function findOrCreateCliente({ nombre, ruc, email, telefono, contacto }) {
    const nombreFinal = (nombre || '').trim() || ruc || email || 'Cliente sin nombre';

    if (ruc) {
        const { rows } = await pool.query(
            `SELECT * FROM clientes WHERE empresa_id=$1 AND ruc=$2 LIMIT 1`,
            [EMPRESA_ID, ruc]
        );
        if (rows[0]) {
            const c = rows[0];
            // Actualizar campos que llegaron con valor (para corregir data vieja)
            const { rows: upd } = await pool.query(
                `UPDATE clientes
                 SET nombre   = CASE WHEN $1 <> '' THEN $1 ELSE nombre   END,
                     contacto = CASE WHEN $2 <> '' THEN $2 ELSE contacto END,
                     email    = CASE WHEN $3 <> '' THEN $3 ELSE email    END,
                     telefono = CASE WHEN $4 <> '' THEN $4 ELSE telefono END
                 WHERE id = $5
                 RETURNING *`,
                [(nombre || '').trim(), contacto || '', email || '', telefono || '', c.id]
            );
            return upd[0];
        }
    }

    const { rows } = await pool.query(
        `INSERT INTO clientes (nombre, ruc, email, telefono, contacto, empresa_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [nombreFinal, ruc || '', email || '', telefono || '', contacto || '', EMPRESA_ID]
    );
    return rows[0];
}

// Log TODO lo que entra a /webhook/* (debug SendPulse)
router.use((req, _res, next) => {
    console.log('[webhook in]', req.method, req.originalUrl,
        '| token:', req.headers['x-webhook-token'],
        '| ct:', req.headers['content-type'],
        '| body:', JSON.stringify(req.body));
    next();
});

// POST /webhook/cotizacion-enviada
router.post('/cotizacion-enviada', async (req, res) => {
    try {
        const token = req.headers['x-webhook-token'];
        if (token !== WEBHOOK_TOKEN) {
            console.warn('[webhook] token inválido recibido:', token);
            return res.status(401).json({ error: 'Token inválido' });
        }

        const {
            asesor_asignado, observaciones, telefono,
            ruc, email, empresa, nombre, monto, fechahora,
        } = req.body || {};

        const firstName = String(asesor_asignado || '').trim().split(/\s+/)[0];
        const vendedor  = await findVendedorByFirstName(firstName);
        if (!vendedor) {
            return res.status(422).json({ error: `Vendedor no encontrado: ${asesor_asignado}` });
        }

        const cliente = await findOrCreateCliente({
            nombre: empresa, ruc, email, telefono, contacto: nombre,
        });

        const fecha = fechahora ? new Date(fechahora) : new Date();
        if (isNaN(fecha.getTime())) fecha.setTime(Date.now());
        const fechaISO = fecha.toISOString().slice(0, 10);
        const mes      = MESES[fecha.getMonth()];
        const now      = new Date();
        const montoNum = parseMonto(monto);
        const tsPend = now, tsProg = now, tsComp = now;

        const { rows } = await pool.query(
            `INSERT INTO actividades
               (id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha,
                elapsed, notas, ts_pendiente, ts_en_progreso, ts_completado,
                cliente_ruc, cliente_email, cliente_telefono, empresa_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             RETURNING *`,
            [
                Date.now(),
                `Cotización - ${cliente.nombre}`,
                'Cotización',
                vendedor.id,
                cliente.nombre,
                montoNum,
                'Media',
                'Completado',
                mes,
                fechaISO,
                0,
                observaciones || '',
                tsPend, tsProg, tsComp,
                cliente.ruc || '',
                cliente.email || '',
                cliente.telefono || '',
                EMPRESA_ID,
            ]
        );

        const actividad = rows[0];
        req.io.to(EMPRESA_ID).emit('actividad:creada', actividad);
        res.status(201).json({ ok: true, actividad_id: actividad.id, cliente_id: cliente.id });
    } catch (err) {
        console.error('[webhook cotizacion-enviada]', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
