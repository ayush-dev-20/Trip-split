-- Expand ExpenseCategory with everyday personal-finance categories, and rename
-- COMMUNICATION to UTILITIES.
--
-- Hand-written on purpose: Prisma's generated migration drops and recreates the
-- enum to handle the rename, which would destroy every expense currently filed
-- under COMMUNICATION. `ALTER TYPE ... RENAME VALUE` relabels the value in
-- place, so existing rows carry over to UTILITIES untouched.
--
-- Requires PostgreSQL 12+ (older versions reject ADD VALUE inside a
-- transaction). The new values are not referenced in this transaction, which
-- PG only permits from 12 onwards.

-- New values
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'DINING';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'FUEL';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'RENT';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INSURANCE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'LOAN_REPAYMENT';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PERSONAL_CARE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'EDUCATION';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'GIFTING';

-- Rename in place — existing COMMUNICATION rows become UTILITIES automatically
ALTER TYPE "ExpenseCategory" RENAME VALUE 'COMMUNICATION' TO 'UTILITIES';
