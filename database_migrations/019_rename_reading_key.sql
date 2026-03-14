
-- Migration to rename bulk_meter_id in readings table for consistency.

ALTER TABLE bulk_meter_readings RENAME COLUMN bulk_meter_id TO "CUSTOMERKEY";
