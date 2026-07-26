import { useEffect, useState } from 'react';
import { useDebounce } from './useDebounce';
import { aiService } from '@/services/aiService';
import type { ExpenseCategory } from '@/types';

export function useCategorySuggestion(
  title: string,
  description: string | undefined,
  currentCategory: ExpenseCategory
) {
  const debouncedTitle = useDebounce(title.trim(), 600);
  const [suggestion, setSuggestion] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    if (debouncedTitle.length < 3) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    aiService
      .categorize(debouncedTitle, description)
      .then(({ category }) => {
        if (!cancelled && category !== currentCategory) {
          setSuggestion(category as ExpenseCategory);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Only re-run when the debounced title changes — description/currentCategory
    // changing shouldn't re-trigger a network call on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle]);

  const dismiss = () => setSuggestion(null);

  return { suggestion, dismiss };
}
