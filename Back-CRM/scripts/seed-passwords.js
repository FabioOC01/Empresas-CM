/**
 * Script para establecer contraseñas iniciales de los vendedores.
 * Uso: node scripts/seed-passwords.js
 *
 * Editar el objeto PASSWORDS antes de ejecutar.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../src/db/pool');

const PASSWORDS = {
    'v1': 'Comutel2026',   // Sthefania Villalobos
    'v2': 'Comutel2026',   // Estefany Condori
    'v3': 'Comutel2026',   // Erimay Torres
    'v4': 'Comutel2026',   // Elias Buitron
    'v5': 'Comutel2026',   // Neithan Ratcliffe
    'v6': 'Comutel2026',   // Elizabeth Escobedo
};

async function run() {
    for (const [id, password] of Object.entries(PASSWORDS)) {
        const hash = await bcrypt.hash(password, 12);
        await pool.query('UPDATE vendedores SET password_hash = $1 WHERE id = $2', [hash, id]);
        console.log(`✓ Contraseña seteada para ${id}`);
    }
    console.log('\nListo. Todos los vendedores pueden hacer login.');
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
