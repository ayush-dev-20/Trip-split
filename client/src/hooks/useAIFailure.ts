import { useCallback, useState } from 'react';
import { getAIError } from '@/lib/aiError';

/**
 * Tracks the most recent failed AI action on a form (quick-entry parse, receipt
 * scan, ...). `kind` says which action failed so the page can re-run exactly
 * that one when the user hits "Try again" — the page decides how, at click time,
 * so a retry always uses the current input rather than a stale closure.
 */
export function useAIFailure<K extends string>() {
  const [failure, setFailure] = useState<{ kind: K; message: string; retryable: boolean } | null>(null);

  const fail = useCallback((kind: K, err: unknown, fallbackMessage: string) => {
    const info = getAIError(err, fallbackMessage);
    setFailure({ kind, message: info.message, retryable: info.retryable });
  }, []);

  const clear = useCallback(() => setFailure(null), []);

  return { failure, fail, clear };
}
