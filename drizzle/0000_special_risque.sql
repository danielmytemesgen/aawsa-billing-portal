CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"BILLKEY" text,
	"CUSTOMERKEY" text,
	"CUSTOMERNAME" text,
	"CUSTOMERTIN" text,
	"CUSTOMERBRANCH" text,
	"REASON" text,
	"CURRREAD" numeric DEFAULT '0.000' NOT NULL,
	"PREVREAD" numeric DEFAULT '0.000' NOT NULL,
	"CONS" numeric DEFAULT '0.000',
	"TOTALBILLAMOUNT" numeric DEFAULT '0.00' NOT NULL,
	"THISMONTHBILLAMT" numeric,
	"OUTSTANDINGAMT" numeric DEFAULT '0.00',
	"PENALTYAMT" numeric,
	"DRACCTNO" text,
	"CRACCTNO" text,
	"individual_customer_id" text,
	"bill_period_start_date" date NOT NULL,
	"bill_period_end_date" date NOT NULL,
	"month_year" text NOT NULL,
	"difference_usage" numeric DEFAULT '0.000',
	"base_water_charge" numeric DEFAULT '0.00' NOT NULL,
	"sewerage_charge" numeric DEFAULT '0.00',
	"maintenance_fee" numeric DEFAULT '0.00',
	"sanitation_fee" numeric DEFAULT '0.00',
	"meter_rent" numeric DEFAULT '0.00',
	"balance_carried_forward" numeric DEFAULT '0.00',
	"amount_paid" numeric DEFAULT '0.00',
	"due_date" date NOT NULL,
	"payment_status" text DEFAULT 'Unpaid',
	"status" text DEFAULT 'Draft',
	"bill_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approval_date" timestamp with time zone,
	"approved_by" text,
	"vat_amount" numeric DEFAULT '0',
	"additional_fees_charge" numeric DEFAULT '0',
	"additional_fees_breakdown" jsonb,
	"snapshot_data" jsonb,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"contactPerson" text,
	"contactPhone" text,
	"status" text DEFAULT 'Active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bulk_meters" (
	"customerKeyNumber" text PRIMARY KEY NOT NULL,
	"INST_KEY" text,
	"name" text NOT NULL,
	"contractNumber" text NOT NULL,
	"meterSize" numeric NOT NULL,
	"METER_KEY" text NOT NULL,
	"previousReading" numeric NOT NULL,
	"currentReading" numeric NOT NULL,
	"month" text NOT NULL,
	"specificArea" text,
	"subCity" text,
	"woreda" text,
	"branch_id" uuid,
	"NUMBER_OF_DIALS" integer,
	"status" text DEFAULT 'Active',
	"paymentStatus" text DEFAULT 'Unpaid',
	"charge_group" text,
	"ROUTE_KEY" text,
	"sewerage_connection" text,
	"ordinal" integer,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bulk_meters_contractNumber_unique" UNIQUE("contractNumber"),
	CONSTRAINT "bulk_meters_METER_KEY_unique" UNIQUE("METER_KEY")
);
--> statement-breakpoint
CREATE TABLE "individual_customers" (
	"customerKeyNumber" text PRIMARY KEY NOT NULL,
	"INST_KEY" text,
	"name" text NOT NULL,
	"contractNumber" text NOT NULL,
	"customerType" text,
	"bookNumber" text,
	"ordinal" integer,
	"meterSize" numeric,
	"METER_KEY" text NOT NULL,
	"previousReading" numeric,
	"currentReading" numeric,
	"month" text,
	"assignedBulkMeterId" text,
	"branch_id" uuid,
	"NUMBER_OF_DIALS" integer,
	"status" text DEFAULT 'Active',
	"paymentStatus" text DEFAULT 'Unpaid',
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "individual_customers_contractNumber_unique" UNIQUE("contractNumber"),
	CONSTRAINT "individual_customers_METER_KEY_unique" UNIQUE("METER_KEY")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid,
	"individual_customer_id" text,
	"amount_paid" numeric(12, 2) NOT NULL,
	"payment_method" text,
	"transaction_reference" text,
	"processed_by_staff_id" uuid,
	"payment_date" timestamp with time zone DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" smallint NOT NULL,
	"permission_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"role_name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"route_key" text PRIMARY KEY NOT NULL,
	"branch_id" uuid,
	"reader_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"phone" text,
	"branch" text,
	"role" text NOT NULL,
	"role_id" smallint,
	"status" text DEFAULT 'Active',
	"hire_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_type" text NOT NULL,
	"year" integer NOT NULL,
	"tiers" jsonb NOT NULL,
	"maintenance_percentage" numeric DEFAULT '0.01',
	"sanitation_percentage" numeric,
	"sewerage_rate_per_m3" numeric,
	"vat_rate" numeric DEFAULT '0.15',
	"fixed_tier_index" integer,
	"use_rule_of_three" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_individual_customer_id_individual_customers_customerKeyNumber_fk" FOREIGN KEY ("individual_customer_id") REFERENCES "public"."individual_customers"("customerKeyNumber") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD CONSTRAINT "bulk_meters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD CONSTRAINT "bulk_meters_ROUTE_KEY_routes_route_key_fk" FOREIGN KEY ("ROUTE_KEY") REFERENCES "public"."routes"("route_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD CONSTRAINT "bulk_meters_approved_by_staff_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD CONSTRAINT "individual_customers_assignedBulkMeterId_bulk_meters_customerKeyNumber_fk" FOREIGN KEY ("assignedBulkMeterId") REFERENCES "public"."bulk_meters"("customerKeyNumber") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD CONSTRAINT "individual_customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD CONSTRAINT "individual_customers_approved_by_staff_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_individual_customer_id_individual_customers_customerKeyNumber_fk" FOREIGN KEY ("individual_customer_id") REFERENCES "public"."individual_customers"("customerKeyNumber") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_processed_by_staff_id_staff_members_id_fk" FOREIGN KEY ("processed_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_reader_id_staff_members_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;