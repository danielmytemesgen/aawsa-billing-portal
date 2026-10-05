# Documentation Index — AAWSA Billing Portal

This is the master index of all technical and operational documentation for the AAWSA Billing Portal.

---

## 🏗️ Architecture & System Design

| Document | Description |
|---|---|
| [DOCUMENTATION.md](DOCUMENTATION.md) | Main system overview, module breakdown, and data flow |
| [ROLES_PERMISSIONS_ARCHITECTURE.md](ROLES_PERMISSIONS_ARCHITECTURE.md) | RBAC system, permission model, and role definitions |
| [blueprint.md](blueprint.md) | High-level system blueprint |

---

## 🔒 Security

| Document | Description |
|---|---|
| [PASSWORD_POLICY.md](PASSWORD_POLICY.md) | Password requirements, strength meter, and examples |
| [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md) | Session lifetime, idle timeout, force-logout, and monitoring |
| [AUDIT_TRAIL.md](AUDIT_TRAIL.md) | Who-did-what log system, queries, and retention policy |
| [PERMISSION_ENFORCEMENT_AUDIT.md](../PERMISSION_ENFORCEMENT_AUDIT.md) | Permission enforcement audit results |

---

## 🚀 Deployment & Operations

| Document | Description |
|---|---|
| [WINDOWS_SERVER_DEPLOYMENT.md](WINDOWS_SERVER_DEPLOYMENT.md) | Full Windows Server setup guide (PM2, PostgreSQL, Nginx) |
| [PRODUCTION_CONFIG.md](PRODUCTION_CONFIG.md) | Environment variables and production configuration |
| [BACKUP_STRATEGY.md](BACKUP_STRATEGY.md) | Database backup schedule, setup, and restore procedures |
| [QUICK_DEPLOYMENT_CHECKLIST.md](QUICK_DEPLOYMENT_CHECKLIST.md) | Pre-deployment verification checklist |
| [DEPLOYMENT_VERIFICATION_CHECKLIST.md](../DEPLOYMENT_VERIFICATION_CHECKLIST.md) | Post-deployment verification checklist |
| [MIGRATION_STRATEGY.md](MIGRATION_STRATEGY.md) | Database migration approach and versioning |

---

## 💳 Billing & Payments

| Document | Description |
|---|---|
| [SQL_PAYMENT_CSV_UPLOAD_COMPLETE.md](../SQL_PAYMENT_CSV_UPLOAD_COMPLETE.md) | CSV upload schema and column mapping |
| [PAYMENT_METHOD_FIX.md](../PAYMENT_METHOD_FIX.md) | Payment method fix documentation |
| [CREDIT_NOTE_PLAN.md](CREDIT_NOTE_PLAN.md) | Credit note (overpayment deposit) plan |
| [PRODUCTION_CSV_DIAGNOSTIC_GUIDE.md](../PRODUCTION_CSV_DIAGNOSTIC_GUIDE.md) | CSV upload troubleshooting guide |

---

## 📋 Features & User Guides

| Document | Description |
|---|---|
| [TRAINING_GUIDE.md](TRAINING_GUIDE.md) | Staff training guide for daily operations |
| [USER_SESSION_MONITORING_PLAN.md](USER_SESSION_MONITORING_PLAN.md) | Admin session monitoring feature |
| [data-entry-plan.md](data-entry-plan.md) | Data entry workflow and permissions |

---

## 🗄️ Database

| File | Description |
|---|---|
| [`database/migrations/021_support_tickets.sql`](../database/migrations/021_support_tickets.sql) | Support tickets table |
| [`database/migrations/022_audit_logs.sql`](../database/migrations/022_audit_logs.sql) | Audit log + password history tables |
| [`src/lib/schema.ts`](../src/lib/schema.ts) | Drizzle ORM schema (all tables) |
| [db-troubleshooting.md](db-troubleshooting.md) | Common DB issues and fixes |

---

## 🧪 Testing

| File | Description |
|---|---|
| [`src/lib/__tests__/`](../src/lib/__tests__/) | All unit test files (16 test suites) |
| [`src/lib/__tests__/production-readiness.test.ts`](../src/lib/__tests__/production-readiness.test.ts) | Security headers, rate limiter, logger, health |
| [`src/lib/__tests__/csv-sanitization.test.ts`](../src/lib/__tests__/csv-sanitization.test.ts) | CSV formula injection protection |
| [`src/lib/__tests__/password-policy.test.ts`](../src/lib/__tests__/password-policy.test.ts) | Password policy validation |

---

## 📝 Change Logs

| Document | Description |
|---|---|
| [CHANGES_SUMMARY.md](../CHANGES_SUMMARY.md) | Summary of all significant changes |

---

*Last updated: 2026-09-10 | Maintained by the AAWSA development team*
