-- Migration: 014_bill_management_workflow
-- Description: Adds workflow status to bills, creates logs table, and inserts permissions.

-- 1. Modify bills table
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Draft',
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36) NULL;

-- 2. Create bill_workflow_logs table
-- Ensure types match bills.id exactly. If bills.id is VARCHAR(36), this must be too.
CREATE TABLE IF NOT EXISTS bill_workflow_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL, 
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL,
    reason TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_workflow_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_changer FOREIGN KEY (changed_by) REFERENCES staff_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_bill ON bill_workflow_logs (bill_id);

-- 3. Insert new permissions (Using NOT EXISTS logic to avoid duplicates)
INSERT INTO permissions (name, category, description)
SELECT 'bill:view_drafts', 'Bill Management', 'View bills in Draft status created by self'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:view_drafts');

INSERT INTO permissions (name, category, description)
SELECT 'bill:submit', 'Bill Management', 'Submit drafts for approval'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:submit');

INSERT INTO permissions (name, category, description)
SELECT 'bill:rework', 'Bill Management', 'Edit bills returned for rework'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:rework');

INSERT INTO permissions (name, category, description)
SELECT 'bill:post', 'Bill Management', 'Finalize approved bills to Posted status'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:post');

INSERT INTO permissions (name, category, description)
SELECT 'bill:approve', 'Bill Management', 'Approve or Reject pending bills'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:approve');

INSERT INTO permissions (name, category, description)
SELECT 'bill:create', 'Bill Management', 'Create new electric bills'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'bill:create');
