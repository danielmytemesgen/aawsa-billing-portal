-- Add the missing tariffs_create permission
INSERT INTO permissions (name, description, module) 
VALUES ('tariffs_create', 'Create new tariff versions', 'Tariff Management')
ON CONFLICT (name) DO NOTHING;
