-- Migración 016: moneda, tipos, pipeline, rol_tipos por empresa
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/016_empresa_config2.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tipos_actividad JSONB NOT NULL DEFAULT
    '["Venta","Homologación","Visita","Propuesta","Seguimiento","Administrativa","Oportunidad","Cotización","Publicidad","Piezas gráficas","Despacho","Inventario","Facturación","Redes","Soporte"]',
  ADD COLUMN IF NOT EXISTS pipeline_etapas JSONB NOT NULL DEFAULT
    '[{"nombre":"Marketing","tipos":["Publicidad","Redes","Piezas gráficas"]},{"nombre":"Prospección","tipos":["Visita","Seguimiento","Oportunidad","Administrativa"]},{"nombre":"Propuesta","tipos":["Cotización","Propuesta","Homologación"]},{"nombre":"Venta","tipos":["Venta"]},{"nombre":"Postventa","tipos":["Despacho","Inventario","Facturación","Soporte"]}]',
  ADD COLUMN IF NOT EXISTS rol_tipos JSONB NOT NULL DEFAULT
    '{"Admin":null,"Gerencia":[],"Marketing":["Publicidad","Piezas gráficas","Administrativa","Redes"],"Ventas":["Venta","Visita","Propuesta","Seguimiento","Oportunidad","Cotización","Administrativa"],"Corporativo":["Cotización","Oportunidad","Visita","Homologación"],"Soporte Técnico":["Visita","Cotización","Seguimiento","Soporte"],"Logística":["Despacho","Inventario","Facturación"]}';
