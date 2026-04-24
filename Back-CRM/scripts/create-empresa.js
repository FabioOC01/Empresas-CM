/**
 * Script para crear una empresa nueva (tenant) y su primer usuario Admin.
 *
 * Uso interactivo:
 *   node scripts/create-empresa.js
 *
 * O con argumentos:
 *   node scripts/create-empresa.js --id=acme --nombre="Acme Corp" \
 *     --admin-email=admin@acme.com --admin-nombre="John Doe" --admin-password=Secret123
 */
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const pool     = require('../src/db/pool');
const readline = require('readline');

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function arg(name) {
    const flag = `--${name}=`;
    const found = process.argv.find(a => a.startsWith(flag));
    return found ? found.slice(flag.length) : null;
}

async function run() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n=== Crear empresa nueva ===\n');

    const empresaId     = arg('id')             || await ask(rl, 'ID de empresa (ej: acme):           ');
    const empresaNombre = arg('nombre')          || await ask(rl, 'Nombre de empresa (ej: Acme Corp):  ');
    const adminEmail    = arg('admin-email')     || await ask(rl, 'Email del Admin:                    ');
    const adminNombre   = arg('admin-nombre')    || await ask(rl, 'Nombre del Admin:                   ');
    const adminPassword = arg('admin-password')  || await ask(rl, 'Contraseña del Admin:               ');

    rl.close();

    const id        = empresaId.trim().toLowerCase().replace(/\s+/g, '-');
    const vendId    = `${id}-admin`;
    const iniciales = adminNombre.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const hash      = await bcrypt.hash(adminPassword, 12);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            'INSERT INTO empresas (id, nombre) VALUES ($1, $2)',
            [id, empresaNombre.trim()]
        );

        await client.query(
            `INSERT INTO vendedores (id, nombre, iniciales, color, email, password_hash, empresa_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [vendId, adminNombre.trim(), iniciales, '#2f6fd4', adminEmail.trim().toLowerCase(), hash, id]
        );

        await client.query(
            'INSERT INTO vendedor_roles (vendedor_id, rol) VALUES ($1, $2)',
            [vendId, 'Admin']
        );

        await client.query('COMMIT');

        console.log(`\n✓ Empresa creada: ${empresaNombre} (id: ${id})`);
        console.log(`✓ Admin creado:   ${adminNombre} <${adminEmail}>`);
        console.log(`\nYa puede ingresar en el CRM con esas credenciales.\n`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n✗ Error:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

run().catch(err => { console.error(err); process.exit(1); });
