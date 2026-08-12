-- FEES -> SUBSCRIPTION, HEALTH -> MEDICAL, plus a new INVESTMENT category.
--
-- Hand-written for the same reason as the previous category migration: Prisma
-- handles enum renames by dropping and recreating the type, which would delete
-- every expense filed under FEES or HEALTH. RENAME VALUE relabels in place, so
-- existing rows follow their category across automatically.
--
-- Requires PostgreSQL 12+.

ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INVESTMENT';

ALTER TYPE "ExpenseCategory" RENAME VALUE 'FEES' TO 'SUBSCRIPTION';
ALTER TYPE "ExpenseCategory" RENAME VALUE 'HEALTH' TO 'MEDICAL';
