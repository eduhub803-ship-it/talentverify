-- Add the Super Admin enum value.
--
-- Kept separate because PostgreSQL does not allow using a newly added enum
-- value later in the same migration transaction.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' AFTER 'admin';
