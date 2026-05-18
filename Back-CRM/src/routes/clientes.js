const router = require('express').Router();
const pool   = require('../db/pool');

let documentoSchemaReady = null;

function ensureDocumentoSchema() {
    if (!documentoSchemaReady) {
        documentoSchemaReady = (async () => {
            await pool.query(`
                ALTER TABLE clientes
                ADD COLUMN IF NOT EXISTS documento_tipo TEXT NOT NULL DEFAULT ''
            `);
            await pool.query(`
                UPDATE clientes
                SET documento_tipo = CASE
                    WHEN ruc ~ '^[0-9]{8}$' THEN 'DNI'
                    WHEN ruc ~ '^[0-9]{11}$' THEN 'RUC'
                    ELSE ''
                END
                WHERE COALESCE(documento_tipo, '') = ''
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_clientes_documento
                ON clientes(empresa_id, documento_tipo, ruc)
            `);
        })().catch(err => {
            documentoSchemaReady = null;
            throw err;
        });
    }
    return documentoSchemaReady;
}

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

function cleanDoc(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function inferDocType(doc) {
    const onlyDigits = cleanDoc(doc);
    if (onlyDigits.length === 8) return 'DNI';
    if (onlyDigits.length === 11) return 'RUC';
    return '';
}

function normalizeDocType(tipo, doc) {
    const raw = String(tipo || '').trim().toUpperCase();
    if (raw === 'DNI') return 'DNI';
    if (raw === 'RUC') return 'RUC';
    if (raw === 'CE' || raw === 'CARNET DE EXTRANJERIA' || raw === 'CARNET DE EXTRANJERIA') return 'CE';
    if (raw === 'PASAPORTE' || raw === 'PASSPORT') return 'Pasaporte';
    return inferDocType(doc);
}

function cleanDocument(value, tipo) {
    if (tipo === 'DNI' || tipo === 'RUC') return cleanDoc(value);
    return String(value || '').trim().toUpperCase();
}

function isValidDoc(value, tipo) {
    if (!value) return true;
    if (tipo === 'DNI') return /^\d{8}$/.test(value);
    if (tipo === 'RUC') return /^\d{11}$/.test(value);
    if (tipo === 'CE' || tipo === 'Pasaporte') return /^[A-Z0-9]{3,20}$/.test(value);
    return false;
}

function docError(tipo) {
    if (tipo === 'DNI') return 'Ingresa un DNI valido de 8 digitos';
    if (tipo === 'RUC') return 'Ingresa un RUC valido de 11 digitos';
    if (tipo === 'CE') return 'Ingresa un Carnet de Extranjeria alfanumerico, sin espacios';
    if (tipo === 'Pasaporte') return 'Ingresa un Pasaporte alfanumerico, sin espacios';
    return 'Selecciona un tipo de documento valido';
}

async function findClienteByNormalizedName(nombre, empresa_id, excludeId = null) {
    const target = normalizeName(nombre);
    if (!target) return null;
    const { rows } = await pool.query(
        `SELECT id, nombre, ruc, documento_tipo
         FROM clientes
         WHERE empresa_id = $1 ${excludeId ? 'AND id <> $2' : ''}`,
        excludeId ? [empresa_id, excludeId] : [empresa_id]
    );
    return rows.find(c => normalizeName(c.nombre) === target) || null;
}

async function maybeCompleteClienteDocumento(cliente, empresa_id, documento_tipo, documento) {
    if (!cliente || !documento) return cliente;
    if (cliente.ruc) return cliente;
    const { rows } = await pool.query(
        `UPDATE clientes
         SET documento_tipo=$1, ruc=$2
         WHERE id=$3 AND empresa_id=$4
         RETURNING id`,
        [documento_tipo, documento, cliente.id, empresa_id]
    );
    if (!rows.length) return cliente;
    return fetchClienteById(cliente.id, empresa_id);
}

// POST /api/clientes/sunat/ruc
router.post('/sunat/ruc', async (req, res) => {
    try {
        const ruc = cleanDoc(req.body?.ruc);
        if (!/^\d{11}$/.test(ruc)) {
            return res.status(400).json({ error: 'Ingresa un RUC valido de 11 digitos' });
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
            return res.status(403).json({ error: 'Token de consulta RUC invalido o sin creditos' });
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

// POST /api/clientes/sunat/dni
router.post('/sunat/dni', async (req, res) => {
    try {
        const dni = cleanDoc(req.body?.dni);
        if (!/^\d{8}$/.test(dni)) {
            return res.status(400).json({ error: 'Ingresa un DNI valido de 8 digitos' });
        }

        const token = process.env.MIGO_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'Consulta DNI no configurada' });
        }

        const response = await fetch('https://api.migo.pe/api/v1/dni', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, dni }),
        });

        if (response.status === 403) {
            return res.status(403).json({ error: 'Token de consulta DNI invalido o sin creditos' });
        }
        if (response.status === 404) {
            return res.status(404).json({ error: 'DNI no encontrado' });
        }

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            console.error('[MIGO DNI]', response.status, data);
            return res.status(502).json({ error: 'No se pudo consultar DNI. Intenta nuevamente.' });
        }
        if (!data?.success) {
            return res.status(404).json({ error: 'DNI no encontrado' });
        }

        res.json({
            dni: data.dni || dni,
            ruc: data.dni || dni,
            nombre: data.nombre || '',
        });
    } catch (err) {
        console.error('[MIGO DNI]', err);
        res.status(502).json({ error: 'No se pudo consultar DNI. Intenta nuevamente.' });
    }
});

// GET /api/clientes
router.get('/', async (req, res) => {
    try {
        await ensureDocumentoSchema();
        const empresa_id = req.user.empresa_id;
        const { q } = req.query;
        let sql = `
            SELECT c.*, v.nombre AS registrado_por_nombre, v.iniciales, v.color
            FROM clientes c
            LEFT JOIN vendedores v ON v.id = c.registrado_por
            WHERE c.empresa_id = $1
        `;
        const params = [empresa_id];
        if (q) { sql += ` AND (c.nombre ILIKE $2 OR c.ruc ILIKE $2)`; params.push(`%${q}%`); }
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
        await ensureDocumentoSchema();
        const { nombre, ruc, documento_tipo, email, telefono, contacto } = req.body;
        const empresa_id     = req.user.empresa_id;
        const registrado_por = req.user.is_superadmin ? null : req.user.id;
        const tipoDoc = normalizeDocType(documento_tipo, ruc);
        const cleanRuc = cleanDocument(ruc, tipoDoc);

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (cleanRuc) {
            if (!isValidDoc(cleanRuc, tipoDoc)) {
                return res.status(400).json({ error: docError(tipoDoc) });
            }
        }

        const existingByName = await findClienteByNormalizedName(nombre, empresa_id);
        if (existingByName) {
            const cliente = await maybeCompleteClienteDocumento(existingByName, empresa_id, tipoDoc, cleanRuc);
            return res.status(200).json({ ...cliente, reused: true, duplicate_reason: 'nombre' });
        }

        if (cleanRuc) {
            const existing = await pool.query(
                `SELECT id FROM clientes WHERE empresa_id=$1 AND documento_tipo=$2 AND ruc=$3 LIMIT 1`,
                [empresa_id, tipoDoc, cleanRuc]
            );
            if (existing.rows.length) {
                const cliente = await fetchClienteById(existing.rows[0].id, empresa_id);
                return res.status(200).json({ ...cliente, reused: true, duplicate_reason: 'documento' });
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO clientes (nombre, ruc, documento_tipo, email, telefono, contacto, registrado_por, empresa_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [nombre.trim(), cleanRuc, cleanRuc ? tipoDoc : '', email || '', telefono || '', contacto || '', registrado_por, empresa_id]
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
        await ensureDocumentoSchema();
        const { nombre, ruc, documento_tipo, email, telefono, contacto } = req.body;
        const empresa_id = req.user.empresa_id;
        const tipoDoc = normalizeDocType(documento_tipo, ruc);
        const cleanRuc = cleanDocument(ruc, tipoDoc);

        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        const existingByName = await findClienteByNormalizedName(nombre, empresa_id, req.params.id);
        if (existingByName) {
            return res.status(409).json({ error: 'Ya existe un cliente con ese nombre o documento' });
        }
        if (cleanRuc) {
            if (!isValidDoc(cleanRuc, tipoDoc)) {
                return res.status(400).json({ error: docError(tipoDoc) });
            }
            const existing = await pool.query(
                `SELECT id FROM clientes WHERE empresa_id=$1 AND documento_tipo=$2 AND ruc=$3 AND id<>$4 LIMIT 1`,
                [empresa_id, tipoDoc, cleanRuc, req.params.id]
            );
            if (existing.rows.length) {
                return res.status(409).json({ error: 'Ya existe un cliente con ese nombre o documento' });
            }
        }

        const { rows } = await pool.query(
            `UPDATE clientes SET nombre=$1, ruc=$2, documento_tipo=$3, email=$4, telefono=$5, contacto=$6
             WHERE id=$7 AND empresa_id=$8 RETURNING *`,
            [nombre.trim(), cleanRuc, cleanRuc ? tipoDoc : '', email || '', telefono || '', contacto || '', req.params.id, empresa_id]
        );
        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
        res.json(await fetchClienteById(rows[0].id, empresa_id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
