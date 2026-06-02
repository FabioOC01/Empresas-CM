# VANTIO — CRM B2B

CRM multi-empresa para gestión comercial: planificación de actividades de ventas, equipo, clientes, asistencia y rentabilidad. Desarrollado por Comutel.

Monorepo con dos aplicaciones:

| Carpeta | Stack | Descripción |
|---------|-------|-------------|
| [Back-CRM/](Back-CRM/) | Node.js + Express 5 + PostgreSQL + Socket.IO | API REST y eventos en tiempo real |
| [Front-CRM/](Front-CRM/) | React 19 + Vite + React Router 7 | SPA del CRM |

## Características

- **Multi-empresa (multi-tenant).** Cada usuario opera dentro de una empresa; el `empresa_id` viaja en el JWT y aísla los datos (incluidos los rooms de Socket.IO). Un superadmin puede operar sin empresa fija.
- **Roles.** `Admin` y `Gerencia` ven todo; roles operativos como `Ventas`, `Retail`, `Corporativo` y `Marketing` acotan la vista. La lógica vive en [Front-CRM/src/utils/roles.js](Front-CRM/src/utils/roles.js).
- **Planificador** de actividades comerciales con colaboradores y checklist.
- **Equipo / Clientes / Dashboard / Rentabilidad** con KPIs y gráficos (Recharts).
- **Asistencia.** Sincronización de marcaciones desde **BioTime 7** vía API REST con JWT.
- **Tiempo real** con Socket.IO (actualización de actividades por empresa).
- **Webhooks** entrantes (p. ej. cotizaciones de SendPulse / Retail).
- **Imágenes** vía Cloudinary.

## Arquitectura

```
Empresas-CM/
├── Back-CRM/
│   └── src/
│       ├── app.js              # entrypoint Express + Socket.IO
│       ├── routes/             # auth, empresas, actividades, vendedores,
│       │                       # clientes, config, asistencia, webhooks
│       ├── middleware/auth.js  # verificación JWT
│       ├── lib/                # biotimeClient, attendance, cloudinary
│       ├── db/migrations/      # migraciones SQL incrementales
│       └── schema.sql          # esquema base
└── Front-CRM/
    └── src/
        ├── main.jsx            # router + providers (Auth, Actividades, Theme)
        ├── pages/              # Dashboard, Equipo, Planificador, Asistencia,
        │                       # Rentabilidad, Admin, Clientes, Login
        ├── components/         # Sidebar, modales, KpiCard, etc.
        ├── context/            # AuthContext, ActividadesContext, ThemeContext
        ├── hooks/  api/  utils/
        └── ...
```

### API (rutas principales)

Todas bajo `/api` y protegidas por JWT salvo `auth` y `webhook`:

`/api/auth` · `/api/empresas` · `/api/actividades` · `/api/vendedores` · `/api/clientes` · `/api/config` · `/api/asistencia` · `/webhook` · `GET /health`

## Requisitos

- Node.js (con soporte de `node --watch`)
- PostgreSQL — base de datos `crm-b2b`
- Cuenta de Cloudinary (imágenes)
- Opcional: BioTime 7 accesible por red (asistencia)

## Puesta en marcha (desarrollo)

### 1. Backend

```bash
cd Back-CRM
npm install
# crear .env (ver más abajo)
psql -U postgres -d crm-b2b -f schema.sql        # primera vez
npm run dev                                        # http://localhost:3001
```

### 2. Frontend

```bash
cd Front-CRM
npm install
# crear .env (ver más abajo)
npm run dev                                        # Vite
```

### Variables de entorno

**Back-CRM/.env**

```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm-b2b
DB_USER=postgres
DB_PASSWORD=<pwd>
JWT_SECRET=<secret>
WEBHOOK_TOKEN=<token>
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>

# Opcional — sincronización BioTime
ZKBIO_SOURCE=biotime_api
ZKBIO_API_URL=https://192.168.1.30
ZKBIO_API_USER=API
ZKBIO_API_PASS=<pwd>
ZKBIO_API_INSECURE=true
```

**Front-CRM/.env**

```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

> Los `.env` no están en git (`.gitignore`); créalos manualmente.

## Base de datos

- `Back-CRM/schema.sql` es el esquema base.
- `Back-CRM/src/db/migrations/` contiene los cambios incrementales, numerados y aplicados **en orden**. Muchos son idempotentes (`IF NOT EXISTS`).

```bash
psql -U postgres -d crm-b2b -f src/db/migrations/0XX_nombre.sql
```

## Scripts

**Back-CRM**

| Script | Acción |
|--------|--------|
| `npm start` | Producción (`node src/app.js`) |
| `npm run dev` | Desarrollo con recarga (`node --watch`) |

**Front-CRM**

| Script | Acción |
|--------|--------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de producción a `dist/` |
| `npm run preview` | Previsualizar el build |
| `npm run lint` | ESLint |

## Despliegue

Ver [DEPLOY.md](DEPLOY.md) para el procedimiento completo en servidor (pm2, migraciones, webhooks, sync de BioTime y verificación).

## Verificación rápida

```bash
curl http://localhost:3001/health    # → {"ok":true,"ts":"..."}
```

---

VANTIO © 2026 Comutel and contributors.
