# QUICK DEPLOYMENT REFERENCE - Windows Server 2019

## REQUIREMENTS

### System
- Windows Server 2019+ with 4GB RAM minimum (8GB+ recommended)
- 20GB free disk space
- Ports: 3000, 5432, 443 available

### Software to Install
1. **Node.js 18+** (LTS) from https://nodejs.org/
2. **PostgreSQL 12+** from https://www.postgresql.org/download/windows/
3. **Git** (optional) from https://git-scm.com/download/win

---

## QUICK DEPLOYMENT STEPS

### 1. Install Software
```powershell
# Verify installations
node --version
npm --version
psql --version
```

### 2. Get Application Code
```powershell
# Option A: Clone from Git
cd C:\Apps
git clone <repository-url>
cd aawsa-billing-portal

# Option B: Copy project folder to C:\Apps\aawsa-billing-portal
```

### 3. Install Dependencies
```powershell
npm install
npm install -g pm2
```

### 4. Create .env.production File
```powershell
# Create C:\Apps\aawsa-billing-portal\.env.production
# With these essential variables:

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_PASSWORD_HERE
POSTGRES_DB=aawsa_billing
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_32_char_random_string_here
NEXTAUTH_SECRET=your_32_char_random_string_here
NEXTAUTH_URL=https://your-server-ip:3000
```

### 5. Setup Database
```powershell
# Create database in PostgreSQL
psql -U postgres -h localhost

# In PostgreSQL CLI, run:
CREATE DATABASE aawsa_billing;

# Exit and import schema
psql -U postgres -h localhost -d aawsa_billing -f "C:\Apps\aawsa-billing-portal\AAWSA_SCHEMA_MERGED.sql"
```

### 6. Build Application
```powershell
cd C:\Apps\aawsa-billing-portal
npm run build
```

### 7. Start with PM2
```powershell
pm2 start ecosystem.config.js
pm2 list
pm2 startup windows
pm2 save
```

### 8. Open Firewall Ports
```powershell
# Run as Administrator in PowerShell:
New-NetFirewallRule -DisplayName "Allow Port 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
New-NetFirewallRule -DisplayName "Allow Port 443" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443
```

### 9. Access Application
```
http://localhost:3000
https://your-server-ip:3000
```

---

## IMPORTANT COMMANDS

```powershell
# View application status
pm2 list
pm2 monit

# View logs
pm2 logs aawsa-billing-web

# Restart application
pm2 restart aawsa-billing-web

# Stop application
pm2 stop aawsa-billing-web

# Database backup
pg_dump -U postgres -h localhost aawsa_billing > backup.sql

# Database restore
psql -U postgres -h localhost -d aawsa_billing < backup.sql

# Check port in use
netstat -ano | findstr :3000

# Kill process on port 3000
taskkill /PID <PID> /F
```

---

## TROUBLESHOOTING QUICK FIXES

| Problem | Solution |
|---------|----------|
| Application won't start | `pm2 logs aawsa-billing-web --err` to check errors |
| Port 3000 already in use | `taskkill /PID <PID> /F` |
| Database connection failed | Check PostgreSQL is running: `Get-Service PostgreSQL*` |
| Can't access from other machines | Check firewall rules and port 3000 is open |
| Out of memory | `pm2 monit` to check usage, may need to restart |

---

## SECURITY REMINDERS

✓ Use strong database password (16+ characters)
✓ Generate secure SESSION_SECRET (32+ random characters)
✓ Never commit `.env.production` to Git
✓ Use HTTPS in production with SSL certificate
✓ Backup database regularly
✓ Update Windows Server patches regularly
✓ Monitor logs for security issues

---

**Full detailed guide**: See `WINDOWS_SERVER_DEPLOYMENT.md`
