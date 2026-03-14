
-- Migration to rename billing columns to uppercase to match the required CSV format directly in the database.

ALTER TABLE bills RENAME COLUMN bulk_meter_id TO "CUSTOMERKEY";
ALTER TABLE bills RENAME COLUMN previous_reading_value TO "PREVREAD";
ALTER TABLE bills RENAME COLUMN current_reading_value TO "CURRREAD";
ALTER TABLE bills RENAME COLUMN usage_m3 TO "CONS";

-- If individual_customer_id is also used, we might want to consolidate or keep it.
-- Based on the user request, BulkMeterId (which maps to customer key) becomes CUSTOMERKEY.
-- We'll keep individual_customer_id for now as a hidden unique identifier if necessary, 
-- but most operations will likely target CUSTOMERKEY.
