# AAWSA Billing Portal - Windows Server 2019 Deployment Guide

This guide provides complete step-by-step instructions for deploying the AAWSA Billing Portal on Windows Server 2019.

---

## TABLE OF CONTENTS
1. [Prerequisites & Requirements](#prerequisites--requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Configuration](#configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## PREREQUISITES & REQUIREMENTS

### A. SYSTEM REQUIREMENTS
- **OS**: Windows Server 2019 or later
- **RAM**: Minimum 4GB (8GB+ recommended)
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection for package downloads
- **Ports Available**: 3000 (app), 5432 (PostgreSQL), 443 (HTTPS)

### B. SOFTWARE REQUIREMENTS

#### 1. **Node.js & NPM**
   - **Version**: Node.js 24.16.0 (recommended for this deployment)
   - **Download**: https://nodejs.org/
   - **Install**: Download Windows Installer (.msi) and run it
   - **Verify Installation**:
     ```powershell
     node --version
     npm --version
     ```

#### 2. **PostgreSQL Database**
   - **Version**: PostgreSQL 12 or later (15+ recommended)
   - **Download**: https://www.postgresql.org/download/windows/
   - **Installation Note**: During installation, set a strong password for the `postgres` user
   - **Verify Installation**:
     ```powershell
     psql --version
     ```

#### 3. **Git** (for code management)
   - **Download**: https://git-scm.com/download/win
   - **Install**: Use default settings
   - **Verify**:
     ```powershell
     git --version
     ```

#### 4. **Process Manager - PM2** (for app management)
   - Installed via npm (see Step 2 below)
   - Manages application restart on server reboot

---

## PRE-DEPLOYMENT CHECKLIST

- [ ] Windows Server 2019 fully updated with latest Windows Updates
- [ ] Node.js 24.16.0 installed and verified
- [ ] PostgreSQL 12+ installed and running
- [ ] Git installed (if not already)
- [ ] Firewall rules allow ports: 3000, 5432, 443
- [ ] Project files obtained (from Git or copied from development machine)
- [ ] All `.env` variables documented
- [ ] Database backup created
- [ ] SSL certificates obtained (for HTTPS)

---

## STEP-BY-STEP DEPLOYMENT

### STEP 1: Download and Prepare Application Code

#### Option A: Clone from Git Repository
```powershell
# Open PowerShell as Administrator
cd C:\Apps  # Or your preferred location
git clone https://github.com/your-org/aawsa-billing-portal.git
cd aawsa-billing-portal
```

#### Option B: Copy from Development Machine
```powershell
# Copy entire project folder to Windows Server
# E.g., to C:\Apps\aawsa-billing-portal
```

---

### STEP 2: Install Dependencies

```powershell
cd C:\Apps\aawsa-billing-portal

# Install Node modules
npm install

# Install PM2 globally (process manager)
npm install -g pm2

# Verify installations
npm list --depth=0
pm2 --version
```

**Expected Output**: No errors, all packages installed successfully

---

### STEP 3: Create Environment Configuration

Create `.env.production` file in the project root:

```powershell
# Using PowerShell, create the file
@"
# ============= DATABASE CONFIGURATION =============
# Keep localhost here if PostgreSQL is installed on the same Windows Server.
# Only use a remote host if the database lives on another machine.
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE
POSTGRES_DB=aawsa_billing
POSTGRES_SSL=false

# ============= APPLICATION CONFIGURATION =============
NODE_ENV=production
PORT=3000

# ============= SESSION & SECURITY =============
SESSION_SECRET=YOUR_RANDOM_SECURE_STRING_HERE_MIN_32_CHARS
INTERNAL_API_KEY=YOUR_INTERNAL_API_KEY_HERE
NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET_HERE_MIN_32_CHARS

# ============= AI SERVICE (OPTIONAL) =============
GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_AI_KEY_HERE

# ============= APPLICATION URL =============
# This is the public app URL that browsers should hit.
# Use http://<static-ip>:3000 if you expose the app directly.
# Use https://<domain> if you place SSL/reverse proxy in front.
PUBLIC_SERVER_IP=10.10.254.78
NEXTAUTH_URL=http://10.10.254.78:3000
"@ | Out-File .env.production -Encoding UTF8
```

**Security Note**: Never commit `.env.production` to git. Keep it locally on the server.

---

### STEP 4: Build the Application

```powershell
cd C:\Apps\aawsa-billing-portal

# Build Next.js application
npm run build

# This will create .next folder and optimize the application
```

**Expected Output**:
```
> next build
  ▲ Next.js 15.0.0
  - Compiling ...
  ✓ Compiled successfully
  ✓ Linting and checking validity of types
  ○ Collecting page data
  ○ Generating static pages (/)
  ✓ Route (app) compiled
  ✓ Collected all pages in 2.5s
  dist/standalone ready
```

---

### STEP 5: Setup PostgreSQL Database

#### A. Connect to PostgreSQL
```powershell
# Open PostgreSQL command line (installed with PostgreSQL)
psql -U postgres -h localhost
```

#### B. Create Database and User (if needed)
```sql
-- Create database
CREATE DATABASE aawsa_billing;

-- Create dedicated user (if you want to use a user other than postgres)
CREATE USER aawsa_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aawsa_billing TO aawsa_user;

-- Connect to the database
\c aawsa_billing

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO aawsa_user;

-- Exit
\q
```

#### C. Import Database Schema
```powershell
# From PowerShell, import the schema
psql -U postgres -h localhost -d aawsa_billing -f "C:\Apps\aawsa-billing-portal\AAWSA_SCHEMA_MERGED.sql"

# Or run migrations if available
# cd C:\Apps\aawsa-billing-portal
# npm run migrate  # if this script exists
```

**Verify Database**:
```powershell
psql -U postgres -h localhost -d aawsa_billing -c "\dt"
# Should list all tables in the database
```

---

### STEP 6: Configure PM2 Ecosystem

The `ecosystem.config.js` file is already configured for Windows Server 2019.
It uses `fork` mode on Windows and binds to `0.0.0.0` so the app is reachable from the server IP.

Update it only if your public URL or database host changes:

```powershell
# Edit the PM2 config if necessary
notepad C:\Apps\aawsa-billing-portal\ecosystem.config.js
```

**Key Settings**:
- `script`: Runs the standalone Next.js server
- `instances`: `1` on Windows for stable process management
- `exec_mode`: `fork` on Windows, `cluster` on Linux
- `HOSTNAME=0.0.0.0` makes the app listen on all interfaces
- `NEXTAUTH_URL` should use the server's public IP or domain
- Environment variables are loaded from `.env.production`

---

### STEP 7: Start Application with PM2

```powershell
cd C:\Apps\aawsa-billing-portal

# Start the application
pm2 start ecosystem.config.js

# View running processes
pm2 list

# View logs
pm2 logs aawsa-billing-web

# Verify the app is listening on the static server IP over HTTP
npm run check:deploy

# Expected output:
# ┌─────┬──────────────────┬──────────┬──────┬────────┬─────────┐
# │ id  │ name             │ mode     │ ↺    │ status │ cpu  %  │
# ├─────┼──────────────────┼──────────┼──────┼────────┼─────────┤
# │ 0   │ aawsa-billing-web│ fork     │ 0    │ online │ 0.0 %   │
# └─────┴──────────────────┴──────────┴──────┴────────┴─────────┘
```

If you want the full deployment flow in one command, use:

```powershell
npm run deploy:windows
```

---

### STEP 8: Setup PM2 to Start on Server Reboot

```powershell
# Save current process list
pm2 save
```

Then create a Windows Task Scheduler job that runs the existing helper at startup:

```powershell
schtasks /Create /SC ONSTART /TN "AAWSA Billing Portal PM2" /TR "C:\Apps\aawsa-billing-portal\scripts\pm2-resurrect.bat" /RL HIGHEST /F
```

The helper restores the saved PM2 process list after a reboot.

---

### STEP 9: Configure Firewall Rules

```powershell
# Open Windows Defender Firewall with Advanced Security
# Or use PowerShell as Administrator:

# Allow port 3000 (Application)
New-NetFirewallRule -DisplayName "Allow Port 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000

# Allow port 5432 (PostgreSQL - only if external access needed)
New-NetFirewallRule -DisplayName "Allow Port 5432" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5432

# Allow port 443 (HTTPS)
New-NetFirewallRule -DisplayName "Allow Port 443" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443

# Allow port 80 (HTTP - if using HTTP redirect)
New-NetFirewallRule -DisplayName "Allow Port 80" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80

# Verify rules
Get-NetFirewallRule -DisplayName "Allow Port*"
```

---

### STEP 10: Setup Reverse Proxy (Optional but Recommended)

#### Using IIS (Internet Information Services)

1. **Install IIS**:
   - Server Manager → Add Roles and Features
   - Select Web Server (IIS)
   - Install with default settings

2. **Install URL Rewrite Module**:
   - Download from: https://www.iis.net/downloads/microsoft/url-rewrite
   - Install the module

3. **Create IIS Website**:
   - Open IIS Manager
   - Add New Website:
     - Site name: `AAWSA Billing Portal`
     - Physical path: `C:\Apps\aawsa-billing-portal`
     - Hostname: your-domain.com or server IP
     - Port: 80

4. **Configure URL Rewrite**:
   - Double-click "URL Rewrite"
   - Add rule to forward all traffic to Node.js app on port 3000

---

### STEP 11: Setup SSL/HTTPS (Recommended for Production)

#### Option A: Using Self-Signed Certificate (Testing Only)
```powershell
# Generate self-signed certificate
$cert = New-SelfSignedCertificate -CertStoreLocation cert:\LocalMachine\My -DnsName "your-domain.com"
```

#### Option B: Using Let's Encrypt (Recommended)
- Install Certbot for Windows
- Obtain free SSL certificate
- Configure in IIS or Node.js

---

## CONFIGURATION

### Key Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_HOST` | Database server hostname | `localhost` or `192.168.1.50` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_USER` | Database username | `postgres` or `aawsa_user` |
| `POSTGRES_PASSWORD` | Database password | `YourSecurePassword123!` |
| `POSTGRES_DB` | Database name | `aawsa_billing` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Application port | `3000` |
| `SESSION_SECRET` | Session encryption key | 32+ character random string |
| `NEXTAUTH_SECRET` | NextAuth secret | 32+ character random string |
| `NEXTAUTH_URL` | Application URL | `https://billing.yourdomain.com` |

### Generate Secure Secrets

```powershell
# Generate a secure random string for secrets
$secret = -join ((33..126) | Get-Random -Count 32 | % {[char]$_})
Write-Host $secret
```

---

## DATABASE SETUP

### Initial Database Setup

```powershell
cd C:\Apps\aawsa-billing-portal

# If you have seed data, import it:
psql -U postgres -h localhost -d aawsa_billing -f "database/seeds/initial_data.sql"

# Verify tables created:
psql -U postgres -h localhost -d aawsa_billing -c "\dt"
```

### Database Backups

```powershell
# Backup database
pg_dump -U postgres -h localhost aawsa_billing > "C:\Backups\aawsa_billing_$(Get-Date -Format 'yyyy-MM-dd').sql"

# Restore database
psql -U postgres -h localhost -d aawsa_billing < "C:\Backups\aawsa_billing_2024-01-15.sql"
```

### Create Scheduled Backup

```powershell
# Create backup script at C:\Scripts\backup-db.ps1
$backupPath = "C:\Backups\aawsa_billing_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').sql"
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -U postgres -h localhost aawsa_billing -f $backupPath

# Schedule with Task Scheduler:
# - Task name: "Database Daily Backup"
# - Trigger: Daily at 2:00 AM
# - Action: Run PowerShell script: C:\Scripts\backup-db.ps1
```

---

## RUNNING THE APPLICATION

### Start Application
```powershell
cd C:\Apps\aawsa-billing-portal
pm2 start ecosystem.config.js
```

### View Application Status
```powershell
# List all PM2 processes
pm2 list

# View detailed logs
pm2 logs aawsa-billing-web

# View real-time monitoring
pm2 monit
```

### Access Application
```
http://localhost:3000
http://10.10.254.78:3000
https://your-domain.com
```

### Initial Login
- Use default admin credentials (if provided)
- Or create new user through registration

---

## MONITORING & MAINTENANCE

### Monitor Application Health

```powershell
# Check PM2 status
pm2 list

# View CPU and memory usage
pm2 monit

# Check application logs for errors
pm2 logs aawsa-billing-web --err

# Save logs to file
pm2 logs aawsa-billing-web > "C:\Logs\app-logs.txt"
```

### Regular Maintenance Tasks

#### Weekly
- [ ] Review application logs for errors
- [ ] Check disk space usage
- [ ] Verify database backups completed

#### Monthly
- [ ] Test database restore procedure
- [ ] Review and optimize slow queries
- [ ] Update Windows Server patches

#### Quarterly
- [ ] Review application performance metrics
- [ ] Update Node.js dependencies (`npm update`)
- [ ] Security audit of credentials and API keys

### Performance Optimization

```powershell
# Monitor resource usage
Get-Process node | Select ProcessName, CPU, Memory

# Increase PM2 cluster instances if needed
pm2 scale aawsa-billing-web 4

# Restart with zero downtime
pm2 gracefulReload aawsa-billing-web
```

---

## TROUBLESHOOTING

### Issue: Application won't start

**Solution**:
```powershell
# Check logs
pm2 logs aawsa-billing-web --err

# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process using port 3000
taskkill /PID <PID> /F

# Restart application
pm2 restart aawsa-billing-web
```

### Issue: Database connection failed

**Solution**:
```powershell
# Test PostgreSQL connection
psql -U postgres -h localhost -d aawsa_billing

# Check PostgreSQL service status
Get-Service PostgreSQL*

# Start PostgreSQL if stopped
Start-Service PostgreSQL15

# Verify connection string in .env.production
```

### Issue: Out of memory errors

**Solution**:
```powershell
# Check current memory usage
pm2 monit

# Increase Node.js memory limit
# Edit ecosystem.config.js and add:
# node_args: "--max_old_space_size=2048"

# Restart application
pm2 restart ecosystem.config.js
```

### Issue: SSL/HTTPS certificate errors

**Solution**:
```powershell
# Check certificate validity
Get-ChildItem Cert:\LocalMachine\My | Select Thumbprint, Subject, NotAfter

# Renew Let's Encrypt certificate
certbot renew --force-renewal
```

### Issue: Application not accessible from other machines

**Solution**:
1. Check firewall rules:
   ```powershell
   Get-NetFirewallRule -DisplayName "Allow Port 3000"
   ```

2. Check Windows Defender is not blocking:
   ```powershell
   Get-NetFirewallProfile -Profile Domain | Select Enabled
   ```

3. Verify application is listening on all interfaces:
   ```powershell
   netstat -ano | findstr :3000
   ```

4. Run the listening check against the server IP:
   ```powershell
   npm run check:deploy
   ```

   The script uses `PUBLIC_SERVER_IP` or `NEXTAUTH_URL` from your environment, so there is no hardcoded IP in the command.

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Cannot connect to database | Verify PostgreSQL is running and connection string is correct |
| `EADDRINUSE` | Port already in use | Kill process on that port or change PORT in .env |
| `ENOMEM` | Out of memory | Increase available RAM or optimize code |
| `Certificate not found` | SSL certificate issue | Generate or renew certificate |

---

## SECURITY BEST PRACTICES

1. **Never commit secrets to Git**
   - Keep `.env.production` locally on server only
   - Use `.gitignore` to exclude `.env` files

2. **Use strong passwords**
   - Database password: 16+ characters, mixed case, numbers, symbols
   - Session secret: 32+ character random string

3. **Enable HTTPS**
   - Use SSL/TLS certificates in production
   - Redirect HTTP to HTTPS

4. **Restrict database access**
   - Use localhost for database connections if on same server
   - Restrict PostgreSQL to specific IP addresses if separated

5. **Regular updates**
   - Keep Windows Server updated
   - Update Node.js and npm regularly
   - Review dependency updates

6. **Monitoring and logging**
   - Monitor application logs regularly
   - Set up alerts for errors
   - Archive logs for auditing

---

## POST-DEPLOYMENT VERIFICATION

After deployment, verify everything is working:

```powershell
# 1. Check application is running
pm2 list

# 2. Access application in browser
# Open: http://localhost:3000 or http://10.10.254.78:3000

# 3. Verify database connection
# Login and verify data loads correctly

# 4. Test key features
# - User login
# - Report generation
# - Data entry
# - File downloads

# 5. Check logs for errors
pm2 logs aawsa-billing-web

# 6. Monitor resource usage
pm2 monit
```

---

## SUPPORT & RESOURCES

- **Node.js Documentation**: https://nodejs.org/docs/
- **Next.js Documentation**: https://nextjs.org/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/
- **Windows Server Documentation**: https://docs.microsoft.com/en-us/windows-server/

---

## DEPLOYMENT SUMMARY CHECKLIST

- [ ] All prerequisites installed and verified
- [ ] Application code downloaded/cloned
- [ ] Dependencies installed with `npm install`
- [ ] `.env.production` created with correct values
- [ ] Application built with `npm run build`
- [ ] PostgreSQL database created and schema imported
- [ ] PM2 configured and started
- [ ] Firewall rules configured for ports 3000, 443
- [ ] Application accessible from browser
- [ ] Database connection verified
- [ ] PM2 startup configured for server reboot
- [ ] SSL/HTTPS configured (if applicable)
- [ ] Database backup procedure tested
- [ ] Monitoring and logging verified
- [ ] Security best practices implemented

---

**Last Updated**: June 2024
**Deployment Target**: Windows Server 2019
**Application**: AAWSA Billing Portal v0.1.0
