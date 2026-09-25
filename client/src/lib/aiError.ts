/**
 * Error raised when an AI streaming request fails — either the HTTP request was
 * rejected, the server sent an `error` event, or the connection dropped before
 * the stream finished. `stage` says which step of a multi-step stream failed.
 */
export class AIStreamError extends Error {
  code?: string;
  status?: number;
  stage?: string;

  constructor(message: string, opts: { code?: string; status?: number; stage?: string } = {}) {
    super(message);
    this.name = 'AIStreamError';
    this.code = opts.code;
    this.status = opts.status;
    this.stage = opts.stage;
  }
}

export interface AIErrorInfo {
  message: string;
  /** False when trying again can't help (e.g. a plan limit or a missing trip destination). */
  retryable: boolean;
  code?: string;
  stage?: string;
}

const DEFAULT_MESSAGE = 'AI is unavailable right now. Please try again.';

/**
 * Normalises anything thrown by an AI call (axios error, stream error, network
 * failure) into a message plus whether a retry is worth offering.
 */
export function getAIError(err: unknown, fallbackMessage = DEFAULT_MESSAGE): AIErrorInfo {
  if (err instanceof AIStreamError) {
    return {
      message: err.message || fallbackMessage,
      retryable: isRetryableStatus(err.status),
      code: err.code,
      stage: err.stage,
    };
  }

  const res = (err as { response?: { status?: number; data?: { error?: { message?: string; code?: string } } } })?.response;
  if (res) {
    const code = res.data?.error?.code;
    const serverMessage = res.data?.error?.message;
    // 5xx bodies are generic ("Internal Server Error") apart from our own AI failure message.
    const useServerMessage = !!serverMessage && (code === 'AI_GENERATION_FAILED' || (res.status ?? 500) < 500);
    return {
      message: useServerMessage ? serverMessage! : fallbackMessage,
      retryable: isRetryableStatus(res.status),
      code,
    };
  }

  // No response at all (offline, DNS, aborted): worth another attempt.
  return { message: fallbackMessage, retryable: true };
}

function isRetryableStatus(status?: number): boolean {
  return !status || status >= 500 || status === 408 || status === 429;
}
