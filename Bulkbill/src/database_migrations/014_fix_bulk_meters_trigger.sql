CREATE OR REPLACE FUNCTION update_bulk_meters_updatedAt_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_bulk_meters_modtime ON "bulk_meters";

CREATE TRIGGER update_bulk_meters_modtime
    BEFORE UPDATE ON "bulk_meters"
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_meters_updatedAt_column();
