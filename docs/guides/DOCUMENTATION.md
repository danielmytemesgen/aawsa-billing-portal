# AAWSA Billing Portal: Application Documentation

## 1. Getting Started: Local Development Setup

This guide will walk you through setting up your local development environment for the AAWSA Billing Portal application using a local PostgreSQL instance (Docker or native).

### **1.1. Prerequisites**

Before you begin, make sure you have the following installed and running:

1.  **Docker Desktop**: Docker can be used to run a local PostgreSQL instance and other services. Download and install it from the [official Docker website](https://www.docker.com/products/docker-desktop/).
2.  **Node.js and npm**: Ensure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org/).
3.  **Visual Studio Code (Recommended)**: For the best experience, we recommend using [VS Code](https://code.visualstudio.com/).

### **1.2. Step-by-Step Guide**

1.  **Download and Open the Project**:
    *   Download the project from GitHub as a ZIP file and unzip it to a folder on your computer.
    *   In VS Code, go to `File > Open Folder...` and select the project folder you just unzipped.

2.  **Install Dependencies**:
    *   Open the integrated terminal in VS Code (`Terminal > New Terminal`).
    *   In the terminal, run the command: `npm install`

3.  **Start PostgreSQL (local or Docker)**:
    *   Make sure Docker Desktop is running (if using Docker) or ensure a local PostgreSQL server is installed and running.
    *   If you prefer Docker, start a Postgres container (example):
        ```bash
        docker run --name aawsa-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aawsa_billing -p 5432:5432 -d postgres:15
        ```
    *   Alternatively use your system's Postgres service or a managed database and ensure connection details are available.

4.  **Configure Environment Variables**:
    *   In the project's root directory, create a new file named `.env.local`.
    *   Add your Postgres connection details and any required secrets, for example:
        ```.env
        POSTGRES_HOST=127.0.0.1
        POSTGRES_PORT=5432
        POSTGRES_USER=postgres
        POSTGRES_PASSWORD=postgres
        POSTGRES_DB=aawsa_billing
        ```

5.  **Apply Database Migrations**:
    *   Run the SQL migration files in `database/migrations` against your Postgres instance. Example using `psql`:
        ```bash
        psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB" -f database/migrations/002_rbac_setup.sql
        # then run subsequent migration files in numeric order
        ```
    *   Or use the provided `database/run-migration.ts` tool to apply specific migrations (it loads `.env.local`).

6.  **Run the Application**:
    *   In the terminal, run: `npm run dev`
    *   Your application will be available at `http://localhost:3000`.

---

## 2. Overview

The AAWSA Billing Portal is a comprehensive web application designed to manage the water billing lifecycle for the Addis Ababa Water and Sewerage Authority. It provides a robust, role-based system for managing branches, staff, customers, and meter data.

The portal's core functionalities include:
-   **Role-Based Access Control (RBAC):** A granular permissions system to ensure users only see and do what their role allows.
-   **Data Management:** Tools for manual and bulk CSV data entry for all customers and meters.
-   **Automated Billing:** A sophisticated engine that calculates monthly bills based on consumption, customer type, and applicable tariffs.
-   **Reporting & Analytics:** Dashboards and downloadable reports that provide insight into billing performance, water usage, and operational metrics.
-   **Centralized Administration:** Tools for administrators to manage the entire system, from user accounts to billing rates.

---

## 3. Core Concepts

-   **Branches**: Physical or administrative divisions of AAWSA.
-   **Staff Members**: Users of the portal, each assigned to a branch and a role.
-   **Roles & Permissions**: The heart of the security model. Roles (e.g., "Admin", "Staff") are assigned permissions (e.g., `branches_create`) that define user actions.
-   **Bulk Meters**: High-capacity meters serving multiple individual customers. Billing is based on the **difference billing** principle (unaccounted-for water).
-   **Individual Customers**: End-users with their own meters, typically associated with a bulk meter.

---

## 4. Key Features & Tasks (by User Role)

### 4.1. Administrator (Super User)
Has unrestricted access to all features and data. Manages branches, staff, roles, permissions, customers, tariffs, and system settings.

### 4.2. Head Office Management
Has view-only access to all data across the system for high-level monitoring and reporting.

### 4.3. Staff Management
Manages the day-to-day operations of a specific branch, including staff and customer records within that branch.

### 4.4. Staff
Focuses on data entry and viewing branch-level information.

### 4.5. Detailed Module Functionality by Web App Area
This section expands the portal from a feature list into a practical functional map of the actual modules present in the application.

#### 4.5.1 Dashboard and Business Intelligence
The dashboard experience is role-aware and tailored for administrators, head-office users, branch managers, and frontline staff.

-   **Admin Dashboard**: Displays aggregated operational KPIs such as total customers, active bulk meters, outstanding bills, recent bill activity, and branch-level summaries.
-   **Head Office Dashboard**: Presents cross-branch performance indicators, payment trends, and comparison metrics for leadership oversight.
-   **Staff Dashboard**: Focuses on the assigned branch's day-to-day operations, including branch customer counts, bill status, water usage patterns, and recent billing activity.
-   **Customer Dashboard**: Gives customers a personalized overview of their account, including current balance, outstanding bills, recent usage, and payment status.

#### 4.5.2 Branch Management Module
Branch management is the organizational backbone of the portal.

-   **Purpose**: Represents physical or administrative AAWSA units such as Bole, Kality, and other service locations.
-   **Main Functions**: Create, read, update, and delete branches; assign branch-level staff; filter customers, meters, and billing data by branch context.
-   **Operational Importance**: Branch records are used throughout the system as the primary scope boundary for data visibility, reporting, and staff assignment.

#### 4.5.3 Staff Management Module
Staff management governs who can access the system and what they can do.

-   **Staff Records**: Stores personal and organizational details for each staff member, including branch, role, and contact information.
-   **Role Assignment**: Associates each staff member with a predefined role that controls their permissions.
-   **Operational Controls**: Enables branch administrators to manage local staff operations, while super users can manage staff across all branches.
-   **Audit Use**: Supports accountability by linking actions to the specific staff member who created or modified records.

#### 4.5.4 Roles and Permissions Module
This module is the security engine of the application.

-   **Role Definition**: Allows administrators to create or edit roles such as Admin, Head Office Management, Staff Management, Staff, and Customer.
-   **Permission Mapping**: Connects roles to fine-grained permissions such as branch management, customer management, meter reading creation, reporting, tariff management, and settings access.
-   **Access Enforcement**: Permissions are applied both in the UI and at the server-action level so unauthorized users cannot bypass navigation controls.
-   **Administrative Use**: Enables least-privilege access and supports compliance, auditing, and controlled delegation of duties.

#### 4.5.5 Customer and Meter Management Modules
These modules are central to the operational side of the portal and cover both individual customers and bulk meters.

-   **Individual Customers**: Stores customer profile information, meter details, billing linkage, branch assignment, and relationship to bulk meters.
-   **Bulk Meters**: Represents large shared meters that serve multiple downstream customers and supports difference billing logic.
-   **Operational Relationship**: Bulk meter and individual customer records are linked so the system can calculate usage and billable difference accurately.
-   **Approval and Validation**: Some records can be routed through approval workflows to ensure staff do not add or modify data outside process rules.

#### 4.5.6 Data Entry Module
The data entry module is designed for both single-record entry and scalable bulk import.

-   **Manual Entry**: Allows staff to create or correct one record at a time for customers and meters.
-   **CSV Upload**: Supports large-scale import for bulk meters and individual customers. Validation rules ensure the header row, field order, and required identifiers are correct.
-   **Branch Auto-Association**: Data entered by branch staff is automatically associated with the relevant branch context.
-   **Correction Workflow**: Supports updating previously imported or created records without needing to rebuild the entire dataset.

#### 4.5.7 Meter Reading Module
The meter reading module is one of the most operationally important areas of the portal.

-   **Reading Capture**: Supports manual entry of individual customer and bulk meter readings.
-   **Reading Review**: Allows users to inspect readings by meter, reading date, route, or fault condition.
-   **Fault and Anomaly Handling**: Detects unusual reading patterns such as zero usage, sudden drops, or suspicious deviations.
-   **Photo Attachments**: Supports meter-reading photos to provide evidence for field submissions.
-   **Export and Reporting**: Enables export of reading data in standard formats for downstream analysis and auditing.
-   **Route-Based Operations**: Helps staff organize readings by route so field work can be executed in a structured way.

#### 4.5.8 Billing and Bill Management Module
The billing module covers the full bill lifecycle from draft generation to posting, payment review, and reconciliation.

-   **Bill Generation**: Creates monthly bills based on customer type, consumption values, tariff rules, and the current billing period.
-   **Draft and Approval Flow**: Allows bills to be reviewed before they are finalized and posted.
-   **Posting and Status Changes**: Moves bills into posted or paid states once reviewed and approved.
-   **Payment Tracking**: Records payment events and updates outstanding balances.
-   **Reconciliation**: Supports identifying overdue, partially paid, and fully settled bills.
-   **Difference Billing Support**: Uses bulk meter and individual customer consumption relationships to calculate the billable difference for bulk meters.

#### 4.5.9 Reports and Analytics Module
The reporting suite transforms operational data into decision-ready outputs.

-   **Exportable Reports**: Offers Excel and CSV export for customer data, bulk meters, billing summaries, paid bills, sent bills, water usage, payments, tariffs, readings, and staff records.
-   **Financial Reports**: Includes GL Finance monthly and yearly reports for financial analysis and aging debt review.
-   **Branch-Scoped Reports**: Allows branch staff to access reports relevant to their own operational scope.
-   **Specialized Views**: Provides dedicated pages for paid bills, sent bills, and unsettled bills to support follow-up and collection work.
-   **AI-Powered Reporting**: Supports natural-language report generation for administrative request handling and operational analysis.

#### 4.5.10 Notifications and Knowledge Base Modules
These modules support communication and knowledge sharing inside the portal.

-   **Notifications**: Enables administrators and branch managers to send announcements, reminders, and operational alerts to specific users or branches.
-   **Knowledge Base**: Stores support documentation, procedural guidance, and troubleshooting articles for staff and administrators.
-   **Business Value**: Helps reduce support overhead and standardizes how staff handle common issues and recurring procedures.

#### 4.5.11 Tariff, Settings, and Configuration Module
This module governs the financial parameters and platform settings used by the billing engine.

-   **Tariff Management**: Defines and updates billing rates, service fees, sewerage rules, meter rent, and other charge components.
-   **System Settings**: Stores application-wide settings such as defaults for behavior and platform preferences.
-   **Configuration Governance**: Ensures billing rules are centrally managed and consistently applied across all branches.

#### 4.5.12 Security, Audit, and Maintenance Module
This area protects the integrity of the platform and supports operational oversight.

-   **Security Logs**: Records important administrative actions, access events, and sensitive changes for audit review.
-   **Recycle Bin**: Preserves deleted records so they can be restored if needed.
-   **System Maintenance**: Supports cleanup, verification, and support tasks that keep the platform healthy in production.

#### 4.5.13 Customer Self-Service Portal
The customer-facing portal gives account holders direct access to their billing and usage information.

-   **Dashboard**: Shows the customer's account summary, outstanding balance, recent activity, and current status.
-   **Bills**: Allows customers to view and review their bill history and payment-related information.
-   **Reading History**: Displays past consumption readings and trackable usage trends.
-   **Account Management**: Lets customers manage their own account context and maintain session-based access securely.
-   **Security Model**: The customer portal is restricted to the authenticated customer's own records, with server-side validation to prevent cross-account leakage.

#### 4.5.14 Offline Field Operations and Spatial Tracking
This module extends the portal into field operations for meter readers working in low-connectivity areas.

-   **Offline Capture**: Supports reading entry even when internet connectivity is temporarily unavailable.
-   **GPS and Spatial Validation**: Captures location data and validates proximity to known meter coordinates.
-   **Queue-Based Sync**: Stores field activity locally and syncs it once connectivity is restored.
-   **Operational Benefit**: Improves field productivity and helps ensure readings are attached to the correct physical location.

---

## 5. Data Entry and Management

### 5.1. Manual Data Entry
Located under "Data Entry", this method is for adding or correcting single records for Individual Customers and Bulk Meters.

### 5.2. CSV File Upload
For importing large amounts of data at once. The "CSV Upload" tab provides separate sections for bulk meters and individual customers.

**Important Notes for CSV Files:**
- The first row of your CSV file **must** be a header row with column names exactly matching the specifications below.
- Column order must also match the specifications.
- `customerKeyNumber` must be a **unique identifier**.
- `branchId` must correspond to an **existing Branch ID**.
- For Individual Customers, `assignedBulkMeterId` **must** be the `customerKeyNumber` of an existing bulk meter.

#### Bulk Meter CSV Columns
`name,customerKeyNumber,contractNumber,meterSize,meterNumber,previousReading,currentReading,month,specificArea,subCity,woreda,branchId`

#### Individual Customer CSV Columns
`name,customerKeyNumber,contractNumber,customerType,bookNumber,ordinal,meterSize,meterNumber,previousReading,currentReading,month,specificArea,subCity,woreda,sewerageConnection,assignedBulkMeterId,branchId`

---

## 6. Billing Calculation Engine

### 6.1. "Difference Billing" Model for Bulk Meters
`Bulk Meter Billable Usage = (Total Bulk Meter Usage) - (Sum of All Assigned Individual Customer Usages)`

The bill for the bulk meter is then calculated on this "difference" usage.

### 6.2. Bill Calculation Steps
1.  **Calculate Base Water Charge**:
    -   **Domestic**: A progressive, tiered rate is applied.
    -   **Non-domestic / Bulk Meter**: A single rate is applied based on the consumption tier.
2.  **Calculate Service Fees**:
    -   Maintenance Fee: 1% of Base Water Charge.
    -   Sanitation Fee: 7% (Domestic) or 10% (Non-domestic).
3.  **Calculate Other Charges**:
    -   Sewerage Charge (if applicable).
    -   Meter Rent (fixed fee based on meter size).
4.  **Calculate VAT (15%)**:
    -   Applied to the Base Water Charge for Non-domestic.
    -   Applied only on usage *above* 15 m³ for Domestic customers.
5.  **Assemble the Total Bill**: The sum of all components.

---

## 7. Technology Stack & Architecture

-   **Frontend Framework**: [Next.js](https://nextjs.org/) (with React)
-   **UI Components**: [ShadCN UI](https://ui.shadcn.com/) with [Tailwind CSS](https://tailwindcss.com/)
 -   **Database & Backend**: PostgreSQL (self-hosted or managed)
 -   **Client-side State Management**: A custom, reactive data store in `src/lib/data-store.ts`. This store acts as a client-side cache; data is fetched from server-side API routes or server components backed by PostgreSQL.
-   **Generative AI**: [Genkit](https://firebase.google.com/docs/genkit) for AI-powered features like the support chatbot and report generation.

### 7.1. State Management (`data-store.ts`)
The application uses a centralized, in-memory data store that acts as a client-side cache for the primary database.
-   **Initialization**: On app load, `initialize...` functions fetch necessary data from server APIs backed by PostgreSQL.
-   **Subscription**: UI components subscribe to data changes (e.g., `subscribeToBranches(setBranches)`).
-   **Reactivity**: When an action modifies data (e.g., `addBranch`), the store updates its internal cache and notifies all subscribed components, which then re-render with the fresh data.

### 7.2. Database Migrations
Schema changes are provided as SQL script files in the `database/migrations/` folder. Run them against your Postgres instance using `psql`, a database client, or the provided migration helper scripts.

---

## 8. Deployment

The application can be deployed to various platforms.

### 8.1. Self-Hosting with Docker (Advanced)
A `Dockerfile` and `docker-compose.yml` are included for building and running the application in a containerized environment. This is suitable for deploying on your own server or any cloud provider that supports Docker.
1.  Configure production environment variables in a `.env` file.
2.  Build the image: `docker-compose build`
3.  Run the container: `docker-compose up -d`

### 8.2. Vercel, Netlify, Firebase Hosting
The application can also be deployed to modern hosting platforms like Vercel (recommended), Netlify, or Firebase Hosting by connecting your Git repository and configuring the necessary environment variables for your Postgres database and any service APIs.
