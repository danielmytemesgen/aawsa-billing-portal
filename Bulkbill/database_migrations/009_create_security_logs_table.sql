
CREATE TABLE security_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  event text NOT NULL,
  branch_name text,
  staff_email text,
  ip_address text
);
