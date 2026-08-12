import { ExpenseCategory } from '@prisma/client';

/**
 * Single source of truth for expense categories on the server.
 *
 * Derived from the Prisma enum, so adding a category to schema.prisma is enough —
 * every AI prompt and validator below picks it up automatically. These lists used
 * to be hand-written per prompt, which is how GROCERIES ended up missing from the
 * categoriser, the receipt scanner and the NLP parser while existing in the DB.
 */
export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory) as ExpenseCategory[];

/** Comma-separated list for embedding in AI prompts. */
export const EXPENSE_CATEGORIES_PROMPT = EXPENSE_CATEGORIES.join(', ');

/** Quoted, comma-separated list for prompts that ask for a JSON string value. */
export const EXPENSE_CATEGORIES_JSON_PROMPT = EXPENSE_CATEGORIES.map((c) => `"${c}"`).join(',');

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as string[]).includes(value);
}
