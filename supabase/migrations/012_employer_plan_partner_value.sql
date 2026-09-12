-- Adds the `partner` value to the employer_plan enum (Service 36).
--
-- This is deliberately the only statement in this migration. PostgreSQL refuses
-- `ALTER TYPE ... ADD VALUE` inside a function or DO block, and a value added
-- inside a transaction cannot be referenced by later statements in that same
-- transaction. Keeping it alone means the value is committed and usable before
-- migration 013 relies on it.
--
-- Additive and idempotent. No destructive SQL.

ALTER TYPE employer_plan ADD VALUE IF NOT EXISTS 'partner';
