-- MySQL schema for aawsa-billing-portal
-- Generated to match the Supabase/Postgres types in src/types/supabase.ts
-- Run this in your MySQL/XAMPP environment (e.g., via MySQL Workbench or the included runner script)

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role_name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Branches
CREATE TABLE IF NOT EXISTS `branches` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `contactPerson` VARCHAR(255) NULL,
  `contactPhone` VARCHAR(48) NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staff members
CREATE TABLE IF NOT EXISTS `staff_members` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NULL,
  `phone` VARCHAR(64) NULL,
  `branch` VARCHAR(255) NULL,
  `role` VARCHAR(100) NOT NULL,
  `role_id` INT NULL,
  `status` ENUM('Active','Inactive','On Leave') NOT NULL DEFAULT 'Active',
  `hire_date` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_email` (`email`),
  CONSTRAINT `fk_staff_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk meters
CREATE TABLE IF NOT EXISTS `bulk_meters` (
  `customerKeyNumber` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `contractNumber` VARCHAR(100) NOT NULL,
  `meterSize` DECIMAL(10,2) NOT NULL,
  `meterNumber` VARCHAR(100) NOT NULL,
  `previousReading` DECIMAL(12,3) NOT NULL,
  `currentReading` DECIMAL(12,3) NOT NULL,
  `month` VARCHAR(16) NOT NULL,
  `specificArea` VARCHAR(255) NOT NULL,
  `subCity` VARCHAR(255) NOT NULL,
  `woreda` VARCHAR(255) NOT NULL,
  `phoneNumber` VARCHAR(48) NULL,
  `branch_id` VARCHAR(36) NULL,
  `status` ENUM('Active','Maintenance','Pending Approval','Rejected') NOT NULL DEFAULT 'Active',
  `paymentStatus` ENUM('Paid','Unpaid') NOT NULL DEFAULT 'Unpaid',
  `charge_group` ENUM('Domestic','Non-domestic') NOT NULL,
  `sewerage_connection` ENUM('Yes','No') NOT NULL,
  `outStandingbill` DECIMAL(12,2) NULL,
  `bulk_usage` DECIMAL(12,3) NULL,
  `difference_bill` DECIMAL(12,2) NULL,
  `difference_usage` DECIMAL(12,3) NULL,
  `total_bulk_bill` DECIMAL(12,2) NULL,
  `approved_by` VARCHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `x_coordinate` DECIMAL(12,6) NULL,
  `y_coordinate` DECIMAL(12,6) NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`customerKeyNumber`),
  UNIQUE KEY `uq_bulk_contractNumber` (`contractNumber`),
  UNIQUE KEY `uq_bulk_meterNumber` (`meterNumber`),
  INDEX `idx_bulk_branch` (`branch_id`),
  CONSTRAINT `fk_bulk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bulk_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual customers
CREATE TABLE IF NOT EXISTS `individual_customers` (
  `customerKeyNumber` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `contractNumber` VARCHAR(100) NOT NULL,
  `customerType` ENUM('Domestic','Non-domestic') NOT NULL,
  `bookNumber` VARCHAR(100) NOT NULL,
  `ordinal` INT NOT NULL,
  `meterSize` DECIMAL(10,2) NOT NULL,
  `meterNumber` VARCHAR(100) NOT NULL,
  `previousReading` DECIMAL(12,3) NOT NULL,
  `currentReading` DECIMAL(12,3) NOT NULL,
  `month` VARCHAR(16) NOT NULL,
  `specificArea` VARCHAR(255) NOT NULL,
  `subCity` VARCHAR(255) NOT NULL,
  `woreda` VARCHAR(255) NOT NULL,
  `sewerageConnection` ENUM('Yes','No') NOT NULL,
  `assignedBulkMeterId` VARCHAR(64) NULL,
  `branch_id` VARCHAR(36) NULL,
  `status` ENUM('Active','Inactive','Suspended','Pending Approval','Rejected') NOT NULL DEFAULT 'Active',
  `paymentStatus` ENUM('Paid','Unpaid','Pending') NOT NULL DEFAULT 'Unpaid',
  `calculatedBill` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `approved_by` VARCHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customerKeyNumber`),
  UNIQUE KEY `uq_individual_contractNumber` (`contractNumber`),
  UNIQUE KEY `uq_individual_meterNumber` (`meterNumber`),
  INDEX `idx_individual_branch` (`branch_id`),
  CONSTRAINT `fk_individual_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_individual_assigned_bulk` FOREIGN KEY (`assignedBulkMeterId`) REFERENCES `bulk_meters`(`customerKeyNumber`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk meters
CREATE TABLE IF NOT EXISTS `bulk_meters` (
  `customerKeyNumber` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `contractNumber` VARCHAR(100) NOT NULL,
  `meterSize` DECIMAL(10,2) NOT NULL,
  `meterNumber` VARCHAR(100) NOT NULL,
  `previousReading` DECIMAL(12,3) NOT NULL,
  `currentReading` DECIMAL(12,3) NOT NULL,
  `month` VARCHAR(16) NOT NULL,
  `specificArea` VARCHAR(255) NOT NULL,
  `subCity` VARCHAR(255) NOT NULL,
  `woreda` VARCHAR(255) NOT NULL,
  `phoneNumber` VARCHAR(48) NULL,
  `branch_id` VARCHAR(36) NULL,
  `status` ENUM('Active','Maintenance','Pending Approval','Rejected') NOT NULL DEFAULT 'Active',
  `paymentStatus` ENUM('Paid','Unpaid') NOT NULL DEFAULT 'Unpaid',
  `charge_group` ENUM('Domestic','Non-domestic') NOT NULL,
  `sewerage_connection` ENUM('Yes','No') NOT NULL,
  `outStandingbill` DECIMAL(12,2) NULL,
  `bulk_usage` DECIMAL(12,3) NULL,
  `difference_bill` DECIMAL(12,2) NULL,
  `difference_usage` DECIMAL(12,3) NULL,
  `total_bulk_bill` DECIMAL(12,2) NULL,
  `approved_by` VARCHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `x_coordinate` DECIMAL(12,6) NULL,
  `y_coordinate` DECIMAL(12,6) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customerKeyNumber`),
  INDEX `idx_bulk_branch` (`branch_id`),
  CONSTRAINT `fk_bulk_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bulk_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual customer readings
CREATE TABLE IF NOT EXISTS `individual_customer_readings` (
  `id` VARCHAR(36) NOT NULL,
  `individual_customer_id` VARCHAR(64) NOT NULL,
  `reading_value` DECIMAL(12,3) NOT NULL,
  `is_estimate` TINYINT(1) NULL,
  `month_year` VARCHAR(16) NOT NULL,
  `reading_date` DATETIME NULL,
  `reader_staff_id` VARCHAR(36) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_icr_customer` (`individual_customer_id`),
  CONSTRAINT `fk_icr_customer` FOREIGN KEY (`individual_customer_id`) REFERENCES `individual_customers`(`customerKeyNumber`) ON DELETE CASCADE,
  CONSTRAINT `fk_icr_reader` FOREIGN KEY (`reader_staff_id`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk meter readings
CREATE TABLE IF NOT EXISTS `bulk_meter_readings` (
  `id` VARCHAR(36) NOT NULL,
  `bulk_meter_id` VARCHAR(64) NOT NULL,
  `reading_value` DECIMAL(12,3) NOT NULL,
  `is_estimate` TINYINT(1) NULL,
  `month_year` VARCHAR(16) NOT NULL,
  `reading_date` DATETIME NULL,
  `reader_staff_id` VARCHAR(36) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bmr_bulk` (`bulk_meter_id`),
  CONSTRAINT `fk_bmr_bulk` FOREIGN KEY (`bulk_meter_id`) REFERENCES `bulk_meters`(`customerKeyNumber`) ON DELETE CASCADE,
  CONSTRAINT `fk_bmr_reader` FOREIGN KEY (`reader_staff_id`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bills
CREATE TABLE IF NOT EXISTS `bills` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `individual_customer_id` VARCHAR(64) NULL,
  `bulk_meter_id` VARCHAR(64) NULL,
  `bill_period_start_date` DATE NOT NULL,
  `bill_period_end_date` DATE NOT NULL,
  `month_year` VARCHAR(16) NOT NULL,
  `previous_reading_value` DECIMAL(12,3) NOT NULL,
  `current_reading_value` DECIMAL(12,3) NOT NULL,
  `usage_m3` DECIMAL(12,3) NULL,
  `difference_usage` DECIMAL(12,3) NULL,
  `base_water_charge` DECIMAL(12,2) NOT NULL,
  `sewerage_charge` DECIMAL(12,2) NULL,
  `maintenance_fee` DECIMAL(12,2) NULL,
  `sanitation_fee` DECIMAL(12,2) NULL,
  `meter_rent` DECIMAL(12,2) NULL,
  `balance_carried_forward` DECIMAL(12,2) NULL,
  `total_amount_due` DECIMAL(12,2) NOT NULL,
  `amount_paid` DECIMAL(12,2) NULL,
  `balance_due` DECIMAL(12,2) NULL,
  `due_date` DATE NOT NULL,
  `payment_status` ENUM('Paid','Unpaid') NOT NULL DEFAULT 'Unpaid',
  `bill_number` VARCHAR(128) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bills_individual` (`individual_customer_id`),
  INDEX `idx_bills_bulk` (`bulk_meter_id`),
  CONSTRAINT `fk_bills_individual` FOREIGN KEY (`individual_customer_id`) REFERENCES `individual_customers`(`customerKeyNumber`) ON DELETE SET NULL,
  CONSTRAINT `fk_bills_bulk` FOREIGN KEY (`bulk_meter_id`) REFERENCES `bulk_meters`(`customerKeyNumber`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `bill_id` VARCHAR(36) NULL,
  `individual_customer_id` VARCHAR(64) NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL,
  `payment_method` ENUM('Cash','Bank Transfer','Mobile Money','Online Payment','Other') NOT NULL,
  `transaction_reference` VARCHAR(255) NULL,
  `processed_by_staff_id` VARCHAR(36) NULL,
  `payment_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_payments_bill` (`bill_id`),
  INDEX `idx_payments_individual` (`individual_customer_id`),
  CONSTRAINT `fk_payments_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_individual` FOREIGN KEY (`individual_customer_id`) REFERENCES `individual_customers`(`customerKeyNumber`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_processed` FOREIGN KEY (`processed_by_staff_id`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reports
CREATE TABLE IF NOT EXISTS `reports` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `report_name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `generated_at` DATETIME NOT NULL,
  `generated_by_staff_id` VARCHAR(36) NULL,
  `parameters` JSON NULL,
  `file_format` VARCHAR(50) NULL,
  `file_name` VARCHAR(255) NULL,
  `status` ENUM('Generated','Pending','Failed','Archived') NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_reports_generated_by` FOREIGN KEY (`generated_by_staff_id`) REFERENCES `staff_members`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `sender_name` VARCHAR(255) NOT NULL,
  `target_branch_id` VARCHAR(36) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notifications_target_branch` FOREIGN KEY (`target_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tariffs
CREATE TABLE IF NOT EXISTS `tariffs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_type` VARCHAR(64) NOT NULL,
  `year` INT NOT NULL,
  `tiers` JSON NOT NULL,
  `sewerage_tiers` JSON NULL,
  `meter_rent_prices` JSON NULL,
  `maintenance_percentage` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `sanitation_percentage` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `vat_rate` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `domestic_vat_threshold_m3` DECIMAL(12,3) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tariff_customer_year` (`customer_type`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Knowledge base articles
CREATE TABLE IF NOT EXISTS `knowledge_base_articles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `category` VARCHAR(255) NULL,
  `keywords` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Stored procedure to mimic insert_notification RPC from Postgres
DROP PROCEDURE IF EXISTS `insert_notification`;
DELIMITER $
CREATE PROCEDURE `insert_notification`(
  IN p_title VARCHAR(255),
  IN p_message TEXT,
  IN p_sender_name VARCHAR(255),
  IN p_target_branch_id VARCHAR(36)
)
BEGIN
  DECLARE v_id VARCHAR(36);
  SET v_id = UUID();
  INSERT INTO notifications (id, title, message, sender_name, target_branch_id, created_at)
  VALUES (v_id, p_title, p_message, p_sender_name, p_target_branch_id, NOW());
  SELECT id, created_at, title, message, sender_name, target_branch_id FROM notifications WHERE id = v_id;
END$
DELIMITER ;

-- Stored procedure to update role permissions (accepts CSV list of permission ids)
DROP PROCEDURE IF EXISTS `update_role_permissions`;
DELIMITER $$
CREATE PROCEDURE `update_role_permissions`(
  IN p_role_id INT,
  IN p_permission_ids TEXT
)
procedure_block: BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE cur_id VARCHAR(64);
  DECLARE cur_pos INT DEFAULT 1;
  DECLARE next_pos INT;
  DECLARE token VARCHAR(64);

  -- Delete existing
  DELETE FROM role_permissions WHERE role_id = p_role_id;
  IF p_permission_ids IS NULL OR TRIM(p_permission_ids) = '' THEN
    LEAVE procedure_block;
  END IF;

  -- Insert new ones from comma-separated list

  set p_permission_ids = CONCAT(p_permission_ids, ',');
  set next_pos = LOCATE(',', p_permission_ids, cur_pos);

  WHILE next_pos > 0 DO
    SET token = TRIM(SUBSTRING(p_permission_ids, cur_pos, next_pos - cur_pos));
    IF token <> '' THEN
      INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (p_role_id, CAST(token AS UNSIGNED), NOW());
    END IF;
    SET cur_pos = next_pos + 1;
    SET next_pos = LOCATE(',', p_permission_ids, cur_pos);
  END WHILE;
END$$
DELIMITER ;

-- Optional seed for roles (uncomment to insert defaults)
-- INSERT INTO roles (role_name, description) VALUES ('admin', 'Administrator'), ('staff', 'Staff member');

-- End of schema
