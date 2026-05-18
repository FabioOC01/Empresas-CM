# Deploy en servidor

Ejecuta estos pasos en orden tras `git pull`.

## 1. Dependencias

```bash
cd Back-CRM && npm install
cd ../Front-CRM && npm install
```

## 2. Migraciones de BD

Base de datos: `crm-b2b` (PostgreSQL).

Aplicar **en orden** solo las que aún no estén aplicadas. Si no sabes cuáles faltan, aplica 021 y 022 (son idempotentes — usan `IF NOT EXISTS`):

```bash
cd Back-CRM
psql -U postgres -d crm-b2b -f src/db/migrations/021_vendedor_username_comision_base.sql
psql -U postgres -d crm-b2b -f src/db/migrations/022_colaboradores_checklist_contacto.sql
psql -U postgres -d crm-b2b -f src/db/migrations/032_clientes_documento_tipo.sql
```

La migración 022 agrega:
- `actividades.colaboradores` (JSONB)
- `actividades.checklist` (JSONB)
- `clientes.contacto` (TEXT)
- Tipos Marketing nuevos en `empresas` (id='comutel'): Video, P. Gráficas Externas/Internas, Actividad, Evento.

La migracion 032 agrega:
- `clientes.documento_tipo` para DNI, RUC, CE y Pasaporte.

## 3. Variables de entorno

### Back-CRM/.env (crear si no existe)

```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm-b2b
DB_USER=postgres
DB_PASSWORD=<pwd>
JWT_SECRET=<secret>
WEBHOOK_TOKEN=Comutel.2026.Comutel.2025
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
```

### Front-CRM/.env (crear si no existe)

```
VITE_API_URL=http://<ip-servidor>:3001
VITE_SOCKET_URL=http://<ip-servidor>:3001
```

## 4. Build / restart

### Back-CRM (pm2)

```bash
cd Back-CRM
pm2 restart back-crm --update-env   # si ya existe
# o primera vez:
pm2 start src/app.js --name back-crm --update-env
pm2 save
```

### Front-CRM

Si usas build de producción:
```bash
cd Front-CRM
npm run build
# servir dist/ con nginx o similar
```

Si corre con vite en modo dev:
```bash
pm2 restart front-crm
```

## 5. Webhook SendPulse → CRM (opcional)

Si el Back-Retail (otro repo, `Retail-CM`) corre en este mismo servidor y debe reenviar a este CRM, en su `.env`:

```
CRM_WEBHOOK_URL=http://localhost:3001/webhook/cotizacion-enviada
CRM_WEBHOOK_TOKEN=Comutel.2026.Comutel.2025
```

Luego `pm2 restart retail-back --update-env`.

## 6. BioTime 7 — sync de asistencia

El backend lee marcaciones de BioTime vía API REST con JWT. Agregar a `Back-CRM/.env`:

```
ZKBIO_SOURCE=biotime_api
ZKBIO_API_URL=https://192.168.1.30
ZKBIO_API_USER=API
ZKBIO_API_PASS=Comutel.2026
ZKBIO_API_INSECURE=true            # cert autofirmado
ZKBIO_API_PAGE_SIZE=200             # opcional
```

Reiniciar back-crm: `pm2 restart back-crm --update-env`.

### Mapear vendedores a BioTime

En el CRM: **Admin → Vendedores → editar** → setear `zkbio_employee_code` con el `emp_code` del empleado en BioTime. Sin esto, las marcaciones se guardan pero no se asocian a ningún vendedor (aparecen en `GET /api/asistencia/unmapped`).

### Disparar un sync manual

Desde el frontend: **Asistencia → botón Sincronizar** (solo Admin/Gerencia).

Por curl:
```bash
curl -X POST http://localhost:3001/api/asistencia/sync \
  -H "Authorization: Bearer <jwt-del-crm>" \
  -H "Content-Type: application/json" \
  -d '{"desde":"2026-04-28","hasta":"2026-05-05"}'
```

Sin body, trae los **últimos 7 días** por defecto.

### Diagnóstico

```sql
-- Últimos syncs
SELECT * FROM asistencia_sync_log ORDER BY started_at DESC LIMIT 10;

-- Códigos sin mapear
SELECT * FROM asistencia_marcaciones m
LEFT JOIN vendedores v ON v.empresa_id = m.empresa_id AND v.zkbio_employee_code = m.zkbio_employee_code
WHERE v.id IS NULL ORDER BY event_at DESC LIMIT 20;
```

O endpoint: `GET /api/asistencia/health`.

## 7. Verificación

```bash
curl http://localhost:3001/health
# → {"ok":true,"ts":"..."}
pm2 logs back-crm --lines 30
```

Front debe cargar en `http://<ip>:5175` (o el puerto configurado).

## Notas

- `schema.sql` en Back-CRM es el esquema base; las migraciones en `src/db/migrations/` son los cambios incrementales.
- Los archivos `.env` NO están en git (por `.gitignore`). Créalos manualmente.
- Si el puerto 3001 está ocupado, cambia `PORT` en `.env`.
