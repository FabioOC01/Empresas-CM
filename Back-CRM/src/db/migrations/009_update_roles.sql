-- Eliminar Retail
DELETE FROM vendedor_roles WHERE rol = 'Retail';
DELETE FROM roles WHERE id = 'Retail';

-- Agregar Logística
INSERT INTO roles (id) VALUES ('Logística') ON CONFLICT DO NOTHING;
