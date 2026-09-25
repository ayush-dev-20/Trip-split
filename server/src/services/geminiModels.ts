import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

/**
 * Gemini model selection with automatic fallback.
 *
 * Every Gemini call goes through `runWithModelFallback`. Models are tried in the
 * order given by GEMINI_MODELS. Quotas are tracked per model, so when one model
 * hits a rate limit (HTTP 429) or is overloaded (503) it is put on a cooldown and
 * the same request is re-run on the next model in the list — the caller never
 * notices. Cooldowns are in-memory (they reset on restart, which at worst costs
 * one extra failed request per model).
 */

let genAI: GoogleGenerativeAI | null = null;

export function getModel(modelName: string): GenerativeModel {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Get a free key at https://aistudio.google.com/apikey');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI.getGenerativeModel({ model: modelName });
}

// ── Error classification ───────────────────────────────────────────────────────

export type GeminiFailureKind =
  /** 429 — quota / rate limit exhausted for this model. */
  | 'quota'
  /** 503 — model temporarily overloaded. */
  | 'overloaded'
  /** 404 — model id doesn't exist / isn't available to this key. */
  | 'not_found'
  /** Anything else (bad request, safety block, parse error, ...) — another model won't help. */
  | 'other';

export interface GeminiFailure {
  kind: GeminiFailureKind;
  /** How long Google asked us to wait, if it said. */
  retryAfterMs?: number;
  /** True when the exhausted quota is a daily one (it won't clear in a minute). */
  daily?: boolean;
}

type ErrorDetail = { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] };

/**
 * Works from the SDK's structured fields (`status`, `errorDetails`) and falls
 * back to parsing the message text, which carries the same information.
 */
export function classifyGeminiError(err: unknown): GeminiFailure {
  const e = err as { status?: number; message?: string; errorDetails?: ErrorDetail[] } | null;
  const message = typeof e?.message === 'string' ? e.message : String(err);

  const status =
    typeof e?.status === 'number' ? e.status : Number(/\[(\d{3})\s/.exec(message)?.[1]) || undefined;

  const kind: GeminiFailureKind =
    status === 429 ? 'quota' : status === 503 ? 'overloaded' : status === 404 ? 'not_found' : 'other';
  if (kind === 'other') return { kind };

  const details = Array.isArray(e?.errorDetails) ? e!.errorDetails! : [];

  let retryAfterMs: number | undefined;
  const retryInfo = details.find((d) => d['@type']?.endsWith('RetryInfo'));
  const delaySeconds = retryInfo?.retryDelay
    ? parseFloat(retryInfo.retryDelay)
    : parseFloat(/retry in ([\d.]+)\s*s/i.exec(message)?.[1] ?? '');
  if (Number.isFinite(delaySeconds)) retryAfterMs = Math.ceil(delaySeconds * 1000);

  const quotaIds = details
    .flatMap((d) => d.violations ?? [])
    .map((v) => v.quotaId ?? '')
    .join(' ');
  const daily = /PerDay/i.test(quotaIds || message);

  return { kind, retryAfterMs, daily };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

/** How long to keep a model out of rotation after a failure. */
export function cooldownFor(failure: GeminiFailure): number {
  let ms: number;
  switch (failure.kind) {
    case 'quota':
      ms = failure.daily
        // Daily quotas reset at an unknown hour; re-probe periodically rather than guess.
        ? Math.max(failure.retryAfterMs ?? 0, 30 * MINUTE)
        : failure.retryAfterMs != null ? failure.retryAfterMs + SECOND : MINUTE;
      break;
    case 'overloaded':
      ms = 30 * SECOND;
      break;
    case 'not_found':
      ms = DAY; // a wrong model id won't fix itself
      break;
    default:
      ms = 0;
  }
  return Math.min(Math.max(ms, SECOND), DAY);
}

function describeFailure(f: GeminiFailure): string {
  switch (f.kind) {
    case 'quota': return f.daily ? 'daily quota exhausted' : 'rate limited';
    case 'overloaded': return 'overloaded';
    case 'not_found': return 'model not found for this API key';
    default: return 'error';
  }
}

// ── Cooldown state ─────────────────────────────────────────────────────────────

const cooldownUntil = new Map<string, number>();

const isCoolingDown = (model: string) => (cooldownUntil.get(model) ?? 0) > Date.now();

/** Clears all cooldowns. Exposed for tests. */
export function resetModelCooldowns() {
  cooldownUntil.clear();
}

/** Thrown when no configured model can take the request right now. */
function capacityError(models: string[]): AppError {
  const waits = models.map((m) => (cooldownUntil.get(m) ?? 0) - Date.now()).filter((ms) => ms > 0);
  const soonest = waits.length ? Math.min(...waits) : undefined;
  const message =
    soonest != null && soonest <= 2 * MINUTE
      ? `AI is at capacity right now. Please try again in about ${Math.max(1, Math.ceil(soonest / SECOND))} seconds.`
      : 'AI is at capacity right now. Please try again in a little while.';
  return new AppError(message, 429, 'AI_RATE_LIMITED');
}

// ── The wrapper ────────────────────────────────────────────────────────────────

/**
 * Runs `fn` against the first available model, moving down GEMINI_MODELS when a
 * model is rate limited, overloaded or missing.
 *
 * `canSwitch` lets a caller veto switching once switching would be visible —
 * streaming callers return false after the first chunk has been sent, since
 * re-running on another model would duplicate/splice output. In that case the
 * original error is thrown (the failing model is still put on cooldown).
 *
 * Errors that another model can't fix (bad request, safety block, ...) are
 * rethrown untouched. If every model is unavailable, throws an
 * `AI_RATE_LIMITED` (429) error that says roughly when to retry.
 */
export async function runWithModelFallback<T>(
  fn: (model: GenerativeModel, modelName: string) => Promise<T>,
  opts: { canSwitch?: () => boolean; models?: string[] } = {}
): Promise<T> {
  const models = opts.models ?? env.GEMINI_MODELS;
  let usedFallback = false;

  for (let i = 0; i < models.length; i++) {
    const name = models[i];
    if (isCoolingDown(name)) {
      usedFallback = true;
      continue;
    }

    try {
      const result = await fn(getModel(name), name);
      if (usedFallback) logger.info('AIService', `Served by fallback model ${name}`);
      return result;
    } catch (err) {
      const failure = classifyGeminiError(err);
      if (failure.kind === 'other') throw err;

      cooldownUntil.set(name, Date.now() + cooldownFor(failure));
      const next = models.slice(i + 1).find((m) => !isCoolingDown(m));
      logger.warn(
        'AIService',
        `Model ${name} unavailable (${describeFailure(failure)}) — ${next ? `falling back to ${next}` : 'no fallback models left'}`
      );

      if (opts.canSwitch && !opts.canSwitch()) throw err;
      usedFallback = true;
    }
  }

  throw capacityError(models);
}
