   # AAWSA Billing Portal - Work Package Plan

This document outlines the Work Package (WP) structure for the AAWSA Billing Portal project. It organizes functionality into manageable units for development, maintenance, and tracking.

## WP1: Project Initiation & Infrastructure
**Objective:** Establish the foundation, environment, and standards for the project.
- [x] **1.1 Project Setup**: Repository initialization, linting/formatting rules, dependency management.
- [x] **1.2 Documentation**: Maintain `README.md`, `DOCUMENTATION.md`, API docs, and user guides.
- [x] **1.3 Environment Configuration**: Docker setup, Environment variables (.env), Supabase local/cloud config.

## WP2: System Core & Security
**Objective:** Ensure secure access and system integrity.
- [x] **2.1 Authentication**: User login/logout, password reset, session management (Supabase Auth).
- [x] **2.2 Role-Based Access Control (RBAC)**: Manage permissions for Admin, Head Office, Staff Manager, Staff.
- [x] **2.3 User Management**: Create, update, deactivate system users (Staff).
- [x] **2.4 Security Logs**: Audit logging for sensitive actions (data entry, user changes) - `src/app/admin/security-logs`.

## WP3: Master Data Management
**Objective:** Manage reference data used across the system.
- [x] **3.1 Branch Management**: CRUD operations for AAWSA branches - `src/app/admin/branches`.
- [x] **3.2 Tariff Management**: Configuration of water rates, service fees, and penalties - `src/app/admin/tariffs`.
- [x] **3.3 Fault Codes**: Manage codes for meter or system faults - `src/app/admin/fault-codes`.
- [x] **3.4 System Settings**: Global configuration parameters - `src/app/admin/settings`.

## WP4: Customer & Asset Management
**Objective:** Manage customer profiles and meter inventory.
- [x] **4.1 Bulk Meter Management**: Registration and details for bulk meters - `src/app/admin/bulk-meters`.
- [x] **4.2 Individual Customer Management**: Mgmt of customers tied to bulk meters - `src/app/admin/individual-customers`.
- [x] **4.3 Customer Association**: Linking individual customers to specific bulk meters.
- [x] **4.4 Meter Inventory**: Tracking meter characteristics (Size, Number, Type).

## WP5: Meter Reading Operations
**Objective:** Accurate capture and validation of water consumption data.
- [x] **5.1 Manual Data Entry**: Forms for entering single readings - `src/app/admin/data-entry`.
- [x] **5.2 CSV Bulk Upload**: Batch upload for readings with validation - `src/app/admin/data-entry`.
- [x] **5.3 Validation Logic**: Rules for rollovers, dial limits, and anomaly detection.
- [/] **5.4 Correction Workflow**: Process for correcting erroneous readings. (Existing in tables)

## WP6: Billing Engine
**Objective:** Accurate calculation and generation of monthly bills.
- [x] **6.1 Billing Period Management**: Opening/Closing billing cycles.
- [x] **6.2 "Difference Billing" Logic**: Algorithm for Bulk Meter Billable Usage.
- [x] **6.3 Fee Calculation**: Computation of Base, Service, Sewerage, Rent, and VAT charges.
- [x] **6.4 Bill Generation**: Creation of immutable bill records - `src/app/admin/bill-management`.

## WP7: Customer Portal
**Objective:** Provide transparency and self-service to end users.
- [x] **7.1 Customer Auth**: Separate login portal for customers - `src/app/customer-login`.
- [x] **7.2 Dashboard**: Overview of consumption and current dues - `src/app/customer/dashboard`.
- [x] **7.3 Bill History**: View and download past bills (PDF) - `src/app/customer/bills`.
- [ ] **7.4 Support**: Ticket/issue tracking (if implemented).

## WP8: Reporting & Analytics
**Objective:** Business intelligence and operational reporting.
- [x] **8.1 Admin Dashboard**: High-level KPIs (Revenue, Consumption) - `src/app/admin/dashboard`.
- [x] **8.2 Head Office Dashboard**: Network-wide aggregation - `src/app/admin/head-office-dashboard`.
- [x] **8.3 Standard Reports**: Pre-defined reports (Revenue, Arrears, Faults) - `src/app/admin/reports`.
- [x] **8.4 Export**: Exporting report data to CSV/Excel/PDF.

## WP9: Maintenance & DevOps
**Objective:** Ensure system reliability and continuous improvement.
- [x] **9.1 Database Migrations**: Managing schema changes - `database_migrations/`.
- [ ] **9.2 Performance Tuning**: Indexing, Query optimization.
- [ ] **9.3 Backup & Recovery**: Procedures for data safety.
- [/] **9.4 Deployment**: CI/CD pipelines (Vercel/Netlify/Docker). (Pre-release audit in progress)
