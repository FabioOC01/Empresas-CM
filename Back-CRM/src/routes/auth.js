const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { uploadAvatar } = require('../lib/cloudinary');

function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
}

async function getVendedoresColumns(client = pool) {
    const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendedores'
    `);
    return new Set(rows.map((row) => row.column_name));
}

function usernameSelectExpr(columns) {
    if (columns.has('username')) return 'v.username';
    return "lower(replace(trim(v.nombre), ' ', '.'))";
}

// POST /api/auth/login -> { token, user }
router.post('/login', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const identifier = String(username || email || '').toLowerCase().trim();

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Usuario y contrasena requeridos' });
        }

        // 1. Buscar en superadmins por email o por la parte local del email (admin.local → admin.local@...)
        const { rows: saRows } = await pool.query(
            'SELECT * FROM superadmins WHERE lower(email) = $1 OR lower(split_part(email, \'@\', 1)) = $1',
            [identifier]
        );

        if (saRows.length) {
            const sa = saRows[0];
            const ok = await bcrypt.compare(password, sa.password_hash);
            if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

            const user = {
                id: sa.id,
                nombre: sa.nombre,
                username: sa.email,
                email: sa.email,
                is_superadmin: true,
                empresa_id: null,
                empresa_nombre: null,
            };

            return res.json({ token: signToken(user), user });
        }

        const columns = await getVendedoresColumns();
        const usernameExpr = usernameSelectExpr(columns);
        const usernameWhere = columns.has('username')
            ? `lower(v.username) = $1 OR lower(v.email) = $1`
            : `lower(replace(trim(v.nombre), ' ', '.')) = $1 OR lower(v.email) = $1`;

        // 2. Buscar en vendedores por username (con fallback por email)
        const { rows } = await pool.query(`
            SELECT v.id, v.nombre, v.iniciales, v.color, ${usernameExpr} AS username, v.email, v.password_hash, v.empresa_id,
                   e.nombre AS empresa_nombre,
                   COALESCE(array_agg(vr.rol ORDER BY vr.rol) FILTER (WHERE vr.rol IS NOT NULL), '{}') AS roles
            FROM vendedores v
            JOIN empresas e ON e.id = v.empresa_id
            LEFT JOIN vendedor_roles vr ON vr.vendedor_id = v.id
            WHERE ${usernameWhere}
            GROUP BY v.id, e.nombre
        `, [identifier]);

        if (!rows.length) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const vendedor = rows[0];
        if (!vendedor.password_hash) {
            return res.status(401).json({ error: 'Cuenta sin contrasena configurada' });
        }

        const ok = await bcrypt.compare(password, vendedor.password_hash);
        if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const user = {
            id: vendedor.id,
            nombre: vendedor.nombre,
            iniciales: vendedor.iniciales,
            color: vendedor.color,
            username: vendedor.username,
            email: vendedor.email,
            roles: vendedor.roles,
            empresa_id: vendedor.empresa_id,
            empresa_nombre: vendedor.empresa_nombre,
            is_superadmin: false,
        };

        res.json({ token: signToken(user), user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/auth/switch -> superadmin cambia de empresa
router.post('/switch', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        if (!payload.is_superadmin) {
            return res.status(403).json({ error: 'Solo superadmins pueden cambiar de empresa' });
        }

        const { empresa_id } = req.body;
        if (!empresa_id) {
            return res.status(400).json({ error: 'empresa_id requerido' });
        }

        const { rows } = await pool.query(
            'SELECT id, nombre FROM empresas WHERE id = $1',
            [empresa_id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }

        const empresa = rows[0];
        const user = {
            id: payload.id,
            nombre: payload.nombre,
            username: payload.username,
            email: payload.email,
            is_superadmin: true,
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
        };

        res.json({ token: signToken(user), user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        if (payload.is_superadmin) {
            return res.status(400).json({ error: 'Los superadmins no pueden cambiar contrasena aqui' });
        }

        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Contrasena actual y nueva son requeridas' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
        }

        const { rows } = await pool.query(
            'SELECT password_hash FROM vendedores WHERE id = $1',
            [payload.id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const ok = await bcrypt.compare(current_password, rows[0].password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Contrasena actual incorrecta' });
        }

        const hash = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE vendedores SET password_hash = $1 WHERE id = $2',
            [hash, payload.id]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/auth/foto -> cualquier vendedor actualiza su propia foto
router.post('/foto', uploadAvatar.single('foto'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        if (payload.is_superadmin) {
            return res.status(400).json({ error: 'Los superadmins no tienen foto de perfil' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibio ningun archivo' });
        }

        const foto_url = req.file.path;
        await pool.query(
            'UPDATE vendedores SET foto_url = $1 WHERE id = $2',
            [foto_url, payload.id]
        );

        res.json({ foto_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
