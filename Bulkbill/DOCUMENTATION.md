# AAWSA Billing Portal: Application Documentation

## 1. Getting Started: Local Development Setup

This guide will walk you through setting up your local development environment for the AAWSA Billing Portal application using the Supabase CLI.

### **1.1. Prerequisites**

Before you begin, make sure you have the following installed and running:

1.  **Docker Desktop**: Supabase uses Docker to run its services. Download and install it from the [official Docker website](https://www.docker.com/products/docker-desktop/).
2.  **Node.js and npm**: Ensure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org/).
3.  **Visual Studio Code (Recommended)**: For the best experience, we recommend using [VS Code](https://code.visualstudio.com/).

### **1.2. Step-by-Step Guide**

1.  **Download and Open the Project**:
    *   Download the project from GitHub as a ZIP file and unzip it to a folder on your computer.
    *   In VS Code, go to `File > Open Folder...` and select the project folder you just unzipped.

2.  **Install Dependencies**:
    *   Open the integrated terminal in VS Code (`Terminal > New Terminal`).
    *   In the terminal, run the command: `npm install`

3.  **Start Supabase Services**:
    *   Make sure Docker Desktop is running.
    *   In the terminal, run: `npm run supabase start`
    *   Wait for it to finish. It will output your local Supabase credentials (API URL, Anon Key, etc.). Keep this terminal open.

4.  **Configure Environment Variables**:
    *   In the project's root directory, create a new file named `.env.local`.
    *   Add the `API URL` and `Anon Key` from the previous step to this file:
        ```.env
        NEXT_PUBLIC_SUPABASE_URL=YOUR_LOCAL_API_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_LOCAL_ANON_KEY
        ```

5.  **Apply Database Migrations**:
    *   In a **new** terminal window, run: `npm run supabase db reset`
    *   This command sets up your local database schema.

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
-   **Database & Backend**: [Supabase](https://supabase.com/) (Managed PostgreSQL)
-   **Client-side State Management**: A custom, reactive data store in `src/lib/data-store.ts`. This store acts as a real-time client-side cache for Supabase data, using a subscription model to keep components in sync without needing external state management libraries like Redux.
-   **Generative AI**: [Genkit](https://firebase.google.com/docs/genkit) for AI-powered features like the support chatbot and report generation.

### 7.1. State Management (`data-store.ts`)
The application uses a centralized, in-memory data store that acts as a real-time cache for the Supabase database.
-   **Initialization**: On app load, `initialize...` functions fetch all data from Supabase.
-   **Subscription**: UI components subscribe to data changes (e.g., `subscribeToBranches(setBranches)`).
-   **Reactivity**: When an action modifies data (e.g., `addBranch`), the store updates its internal cache and notifies all subscribed components, which then re-render with the fresh data.

### 7.2. Database Migrations
Schema changes are provided as SQL script files in the `database_migrations/` folder. These must be run manually in the Supabase SQL Editor to keep the database in sync.

---

## 8. Deployment

The application can be deployed to various platforms.

### 8.1. Self-Hosting with Docker (Advanced)
A `Dockerfile` and `docker-compose.yml` are included for building and running the application in a containerized environment. This is suitable for deploying on your own server or any cloud provider that supports Docker.
1.  Configure production environment variables in a `.env` file.
2.  Build the image: `docker-compose build`
3.  Run the container: `docker-compose up -d`

### 8.2. Vercel, Netlify, Firebase Hosting
The application can also be deployed to modern hosting platforms like Vercel (recommended), Netlify, or Firebase Hosting by connecting your Git repository and configuring the necessary environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
