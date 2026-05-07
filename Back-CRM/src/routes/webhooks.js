const router = require('express').Router();
const pool   = require('../db/pool');

const EMPRESA_ID    = 'comutel';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'Comutel.2026.Comutel.2025';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function parseMonto(v) {
    if (v == null) return 0;
    let raw = String(v).trim().replace(/[^\d.,-]/g, '');
    if (raw.includes(',') && raw.includes('.')) {
        raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
        raw = raw.replace(/\./g, '');
    } else {
        raw = raw.replace(',', '.');
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function parseFechaWebhook(value) {
    if (!value) return new Date();
    const s = String(value).trim();
    const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? new Date() : d;
}

function pick(body, keys, fallback = '') {
    for (const key of keys) {
        const value = body?.[key];
        if (value != null && String(value).trim() !== '') return value;
    }
    return fallback;
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

async function findOrCreateCliente({ nombre, ruc, email, telefono, contacto, registrado_por }) {
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
                     telefono = CASE WHEN $4 <> '' THEN $4 ELSE telefono END,
                     registrado_por = COALESCE(registrado_por, $5)
                 WHERE id = $6
                 RETURNING *`,
                [(nombre || '').trim(), contacto || '', email || '', telefono || '', registrado_por || null, c.id]
            );
            return upd[0];
        }
    }

    const { rows } = await pool.query(
        `INSERT INTO clientes (nombre, ruc, email, telefono, contacto, registrado_por, empresa_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [nombreFinal, ruc || '', email || '', telefono || '', contacto || '', registrado_por || null, EMPRESA_ID]
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

        const body = req.body || {};
        const asesor_asignado = pick(body, ['asesor_asignado', 'vendedor', 'Vendedor']);
        const observaciones = pick(body, ['observaciones', 'Observaciones']);
        const telefono = pick(body, ['telefono', 'phone', 'Phone', 'Teléfono', 'Telefono']);
        const ruc = pick(body, ['ruc', 'RUC', 'RUC o DNI', 'ruc_dni', 'dni', 'DNI']);
        const email = pick(body, ['email', 'Email', 'correo', 'Correo']);
        const empresa = pick(body, ['empresa', 'Empresa', 'nombre_empresa', 'razon_social', 'Razón social']);
        const nombre = pick(body, ['nombre', 'Nombre', 'contacto', 'Contacto']);
        const monto = pick(body, ['monto', 'Monto']);
        const fechahora = pick(body, ['fechahora', 'fecha_hora', 'Fecha', 'FechaHora']);
        const contact_id = pick(body, ['contact_id', 'contactId', 'sendpulse_contact_id']);

        const firstName = String(asesor_asignado || '').trim().split(/\s+/)[0];
        const vendedor  = await findVendedorByFirstName(firstName);
        if (!vendedor) {
            return res.status(422).json({ error: `Vendedor no encontrado: ${asesor_asignado}` });
        }

        const cliente = await findOrCreateCliente({
            nombre: empresa, ruc, email, telefono, contacto: nombre, registrado_por: vendedor.id,
        });
        console.log('[webhook cliente]', {
            empresa: empresa || null,
            contacto: nombre || null,
            ruc: ruc || null,
            email: email || null,
            telefono: telefono || null,
            cliente_id: cliente.id,
            cliente_nombre: cliente.nombre,
        });

        const fecha = parseFechaWebhook(fechahora);
        const fechaISO = fecha.toISOString().slice(0, 10);
        const mes      = MESES[fecha.getMonth()];
        const now      = new Date();
        const montoNum = parseMonto(monto);
        const tsPend = now, tsProg = now, tsComp = now;

        const { rows } = await pool.query(
            `INSERT INTO actividades
               (id, nombre, tipo, vendedor_id, cliente, monto, prioridad, estado, mes, fecha,
                elapsed, notas, ts_pendiente, ts_en_progreso, ts_completado,
                cliente_ruc, cliente_email, cliente_telefono, sendpulse_contact_id, empresa_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
                contact_id || '',
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

// POST /webhook/lead-cerrado
router.post('/lead-cerrado', async (req, res) => {
    try {
        const token = req.headers['x-webhook-token'];
        if (token !== WEBHOOK_TOKEN) {
            console.warn('[webhook] token invÃ¡lido recibido:', token);
            return res.status(401).json({ error: 'Token invÃ¡lido' });
        }

        const body = req.body || {};
        const contact_id = pick(body, ['contact_id', 'contactId', 'sendpulse_contact_id']);
        const asesor_asignado = pick(body, ['asesor_asignado', 'vendedor', 'Vendedor']);
        const resultado = String(pick(body, ['resultado', 'Resultado'])).toLowerCase().trim();
        const estadoLead = String(pick(body, ['estado', 'Estado'])).toLowerCase().trim();
        const observaciones = pick(body, ['observaciones', 'Observaciones']);

        if (!contact_id) return res.status(400).json({ error: 'contact_id requerido' });

        const firstName = String(asesor_asignado || '').trim().split(/\s+/)[0];
        const vendedor = await findVendedorByFirstName(firstName);
        if (!vendedor) {
            return res.status(422).json({ error: `Vendedor no encontrado: ${asesor_asignado}` });
        }

        let nuevoEstado = null;
        if (resultado === 'ganado' || estadoLead === 'venta_efectiva') nuevoEstado = 'Ganada';
        if (resultado === 'perdido' || estadoLead === 'no_efectiva') nuevoEstado = 'Perdida';
        if (!nuevoEstado) {
            return res.status(400).json({ error: `Resultado no reconocido: ${resultado || estadoLead}` });
        }

        const { rows } = await pool.query(
            `WITH target AS (
                SELECT id
                FROM actividades
                WHERE empresa_id = $1
                  AND sendpulse_contact_id = $2
                  AND vendedor_id = $3
                  AND tipo = 'CotizaciÃ³n'
                ORDER BY created_at DESC
                LIMIT 1
             )
             UPDATE actividades a
             SET estado = $4,
                 notas = CASE
                    WHEN $5::text <> '' AND COALESCE(a.notas, '') <> '' THEN a.notas || E'\n' || $5
                    WHEN $5::text <> '' THEN $5
                    ELSE a.notas
                 END,
                 ts_en_progreso = COALESCE(a.ts_en_progreso, NOW()),
                 ts_completado = COALESCE(a.ts_completado, NOW())
             FROM target
             WHERE a.id = target.id
             RETURNING a.*`,
            [EMPRESA_ID, contact_id, vendedor.id, nuevoEstado, observaciones || '']
        );

        if (!rows.length) {
            return res.status(404).json({
                error: 'Actividad no encontrada para ese contact_id',
                contact_id,
                vendedor: vendedor.nombre,
            });
        }

        req.io.to(EMPRESA_ID).emit('actividad:actualizada', rows[0]);
        res.json({ ok: true, actividad_id: rows[0].id, estado: rows[0].estado });
    } catch (err) {
        console.error('[webhook lead-cerrado]', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
