
-- Migration to rename amount columns to uppercase to match the required format.

ALTER TABLE bills RENAME COLUMN total_amount_due TO "TOTALBILLAMOUNT";
ALTER TABLE bills RENAME COLUMN balance_due TO "OUTSTANDINGAMT";
