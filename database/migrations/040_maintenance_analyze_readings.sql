-- Migration 040: Database Statistics Refresh & Query Plan Optimization
-- Analyzes meter reading and customer tables to ensure PostgreSQL query planner
-- always utilizes high-performance B-tree indexes for paginated lookups and analytics.

ANALYZE individual_customer_readings;
ANALYZE bulk_meter_readings;
ANALYZE individual_customers;
ANALYZE bulk_meters;
ANALYZE routes;
ANALYZE branches;

