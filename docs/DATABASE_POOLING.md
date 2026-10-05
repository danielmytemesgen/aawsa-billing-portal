# Database Connection Pooling — AAWSA Billing Portal

## Overview

The application uses **pg (node-postgres)** with a built-in connection pool. The pool is already configured in `src/lib/db.ts`. This document explains the current configuration and how to scale it for production.

---

## Current Pool Configuration

```typescript
// src/lib/db.ts
pool = new Pool({
  host, user, password, database, port,
  max: 30,                  // Max 30 simultaneous DB connections
  idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
  connectionTimeoutMillis: 5000, // Fail fast if no connection in 5s
  statement_timeout: 30000, // Cancel queries running > 30 seconds
  allowExitOnIdle: true,    // Graceful shutdown when no connections remain
});
```

---

## Pool Sizing Formula

```
max_connections = (number_of_cpu_cores × 2) + effective_spindle_count
```

For a typical AAWSA production server (4 core CPU, SSD):
```
max = (4 × 2) + 1 = 9  ← PostgreSQL total
```

Since the app uses 30 connections, check your PostgreSQL `max_connections`:

```sql
SHOW max_connections;
-- Should be higher than 30 (default is 100 for PostgreSQL)
```

If running multiple PM2 instances, divide the pool per instance:
```
30 connections / 2 PM2 instances = 15 max per instance
```

---

## PostgreSQL Server Tuning

Edit `/etc/postgresql/*/main/postgresql.conf` (Linux) or `postgresql.conf` (Windows):

```ini
# Connection limits
max_connections = 100         # Total server connections
shared_buffers = 256MB        # 25% of RAM for caching
effective_cache_size = 768MB  # 75% of RAM (hint for planner)
work_mem = 16MB               # Memory per sort/hash operation
maintenance_work_mem = 64MB   # For VACUUM, CREATE INDEX

# Logging (helps debug slow queries)
log_min_duration_statement = 1000  # Log queries > 1 second
log_connections = on
log_disconnections = on
```

After editing, reload:
```bash
# Linux
sudo systemctl reload postgresql

# Windows (run as Administrator)
pg_ctl reload -D "C:\Program Files\PostgreSQL\16\data"
```

---

## Using pgBouncer (Optional — For Heavy Load)

If the portal grows to 50+ concurrent users, add **pgBouncer** as a connection pooler between the app and PostgreSQL.

### Why pgBouncer?
- PostgreSQL itself is expensive per-connection (spawns a process per connection)
- pgBouncer reuses connections from a pool, reducing PostgreSQL load dramatically
- Allows 1000+ app connections while PostgreSQL sees only 20–30

### Installation (Windows Server)
```powershell
# Download pgBouncer from https://www.pgbouncer.org/
# Or install via Chocolatey:
choco install pgbouncer
```

### pgBouncer Config (`pgbouncer.ini`)
```ini
[databases]
aawsa_billing = host=127.0.0.1 port=5432 dbname=aawsa_billing

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction       ; Best for Next.js server actions
max_client_conn = 500         ; App connections pgBouncer accepts
default_pool_size = 20        ; Connections pgBouncer keeps to PostgreSQL
min_pool_size = 5
reserve_pool_size = 5
log_connections = 1
log_disconnections = 1
```

### Update app to use pgBouncer port
In `.env.production`:
```env
POSTGRES_PORT=6432   # pgBouncer port instead of 5432
```

---

## Monitoring Connection Health

```sql
-- Current active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Connections by application
SELECT application_name, count(*), state
FROM pg_stat_activity
GROUP BY application_name, state
ORDER BY count DESC;

-- Long-running queries (> 30s)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '30 seconds';
```

---

## Implementation Files

| File | Purpose |
|---|---|
| [`src/lib/db.ts`](../src/lib/db.ts) | Pool configuration (`max`, `idleTimeoutMillis`, etc.) |
| [`.env.production`](../.env.production.example) | Database host/port environment variables |
