-- Migration 049: Call Center Enhancements
-- Adds sentiment column to call_center_logs

ALTER TABLE call_center_logs ADD COLUMN IF NOT EXISTS sentiment TEXT;
CREATE INDEX IF NOT EXISTS idx_call_center_sentiment ON call_center_logs(sentiment);
