# Database Connectivity Troubleshooting

If logging in fails with errors like `connect ETIMEDOUT` or `ECONNREFUSED`, it means the app cannot reach your MySQL server. Use the steps below to diagnose and fix the issue.

1) Verify environment variables

- On Windows PowerShell, run:

```powershell
$env:MYSQL_HOST
$env:MYSQL_PORT
$env:MYSQL_USER
$env:MYSQL_PASSWORD
$env:MYSQL_DATABASE
```

If you're using a `.env` file locally, make sure your dev server is loading it (e.g., via `next dev` which loads `.env.local`).

2) Ensure MySQL is running and reachable

- If MySQL runs locally:
  - Open a terminal and run `mysql -u <user> -p -h 127.0.0.1 -P 3306` and enter your password.

- If MySQL runs in Docker, confirm the container is running and port-forwarded.

3) Run the project's connectivity check script

From the workspace root, run (PowerShell):

```powershell
node .\scripts\test-db-conn.js
```

It will attempt a simple `SELECT 1` query and print success or a clear error code (like `ETIMEDOUT`).

4) Common causes & fixes

- ETIMEDOUT: host is unreachable (wrong host, network blocked, firewall, or server down). Verify host and port and ensure there are no firewall rules blocking outgoing connections.
- ECONNREFUSED: connection was refused (server not listening on that host/port). Ensure MySQL is listening on the expected interface or use 127.0.0.1 instead of `localhost` if socket vs TCP confusion occurs.
- ENOTFOUND: DNS issue — check the hostname spelling or use an IP address.

5) When working with Next.js and server code

Ensure any server-only code (database access) is executed server-side. The `authenticateStaffMember` function is intended to be invoked from server components/actions. Avoid calling server-side DB functions directly from client code — instead use Next.js server actions or API routes.

If you'd like, I can try to automatically detect if `authenticateStaffMember` is being called from client contexts and suggest conversion to a server action.

