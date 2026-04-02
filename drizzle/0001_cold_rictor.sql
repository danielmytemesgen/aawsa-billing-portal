ALTER TABLE "payments" DROP CONSTRAINT "payments_bill_id_bills_id_fk";
--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'bills'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "bills" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "bills" ALTER COLUMN "id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_id_month_year_pk" PRIMARY KEY("id","month_year");--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD COLUMN "x_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD COLUMN "y_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "bulk_meters" ADD COLUMN "z_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD COLUMN "x_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD COLUMN "y_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "individual_customers" ADD COLUMN "z_coordinate" numeric;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bill_month_year" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "status" text DEFAULT 'Active';