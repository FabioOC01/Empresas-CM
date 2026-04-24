-- Migración 003: rol Admin
INSERT INTO roles (id) VALUES ('Admin') ON CONFLICT DO NOTHING;
