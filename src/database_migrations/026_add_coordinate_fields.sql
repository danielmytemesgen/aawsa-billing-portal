-- Add coordinate fields to individual_customers table
ALTER TABLE individual_customers
ADD COLUMN x_coordinate DECIMAL(10, 8) NULL,
ADD COLUMN y_coordinate DECIMAL(11, 8) NULL;
