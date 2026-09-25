import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_MODELS: ['m1', 'm2', 'm3'], GEMINI_MODEL: 'm1', NODE_ENV: 'test' },
}));

// Each model's behaviour is scripted per test; `calls` records which models were hit, in order.
type Script = (kind: 'generate' | 'stream') => unknown;
const scripts: Record<string, Script> = {};
const calls: string[] = [];

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async () => { calls.push(model); return scripts[model]('generate'); },
        generateContentStream: async () => { calls.push(model); return scripts[model]('stream'); },
      };
    }
  },
}));

import { classifyGeminiError, cooldownFor, runWithModelFallback, resetModelCooldowns } from '../geminiModels';
import { generateSpendingInsights, generateTripPlanStream } from '../aiService';

// The real 429 from the server log (gemini-3.5-flash, free tier, 5 requests/minute).
const REAL_429_MESSAGE =
  '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse: ' +
  '[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. ' +
  'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 5, model: gemini-3.5-flash\n' +
  'Please retry in 39.264537876s. [{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},' +
  '{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"39s"}]';

const fetchError = (status: number, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`[${status} X] boom`), { status, ...extra });

const rateLimited = () =>
  fetchError(429, {
    message: REAL_429_MESSAGE,
    errorDetails: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '39s' },
    ],
  });

const okText = (t: string) => ({ response: { text: () => t } });
const ok = (t: string) => () => okText(t);
const fail = (err: Error) => () => { throw err; };

async function* chunks(...texts: string[]) {
  for (const t of texts) yield { text: () => t };
}
const streamOf = (...texts: string[]) => () => ({ stream: chunks(...texts) });

beforeEach(() => {
  calls.length = 0;
  resetModelCooldowns();
  scripts.m1 = ok('from m1');
  scripts.m2 = ok('from m2');
  scripts.m3 = ok('from m3');
});
afterEach(() => vi.useRealTimers());

describe('classifyGeminiError', () => {
  it('reads the real free-tier 429: per-minute quota, retry in ~39s', () => {
    expect(classifyGeminiError(rateLimited())).toEqual({ kind: 'quota', retryAfterMs: 39000, daily: false });
  });

  it('still works from the message text alone (no structured details)', () => {
    const f = classifyGeminiError(new Error(REAL_429_MESSAGE));
    expect(f.kind).toBe('quota');
    expect(f.retryAfterMs).toBe(39265); // "39.264537876s" rounded up
    expect(f.daily).toBe(false);
  });

  it('flags a daily quota', () => {
    const f = classifyGeminiError(fetchError(429, {
      errorDetails: [{ '@type': 'x.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }],
    }));
    expect(f).toMatchObject({ kind: 'quota', daily: true });
  });

  it('maps overloaded / not-found, and leaves everything else alone', () => {
    expect(classifyGeminiError(fetchError(503)).kind).toBe('overloaded');
    expect(classifyGeminiError(fetchError(404)).kind).toBe('not_found');
    expect(classifyGeminiError(fetchError(400)).kind).toBe('other');
    expect(classifyGeminiError(new Error('boom')).kind).toBe('other');
    expect(classifyGeminiError(null).kind).toBe('other');
  });
});

describe('cooldownFor', () => {
  it('per-minute quota waits the requested delay (+1s), or a minute if none given', () => {
    expect(cooldownFor({ kind: 'quota', retryAfterMs: 39000 })).toBe(40000);
    expect(cooldownFor({ kind: 'quota' })).toBe(60000);
  });
  it('daily quota waits at least 30 minutes; overloaded 30s; not-found a day', () => {
    expect(cooldownFor({ kind: 'quota', daily: true, retryAfterMs: 5000 })).toBe(30 * 60_000);
    expect(cooldownFor({ kind: 'overloaded' })).toBe(30_000);
    expect(cooldownFor({ kind: 'not_found' })).toBe(24 * 60 * 60_000);
  });
});

describe('runWithModelFallback', () => {
  it('uses the first model when it works', async () => {
    const out = await runWithModelFallback(async (m) => (await m.generateContent('p')).response.text());
    expect(out).toBe('from m1');
    expect(calls).toEqual(['m1']);
  });

  it('re-runs on the next model when the first is rate limited', async () => {
    scripts.m1 = fail(rateLimited());
    const out = await runWithModelFallback(async (m) => (await m.generateContent('p')).response.text());
    expect(out).toBe('from m2');
    expect(calls).toEqual(['m1', 'm2']);
  });

  it('walks the whole list, and skips a cooling-down model on later calls', async () => {
    scripts.m1 = fail(rateLimited());
    scripts.m2 = fail(fetchError(503));
    const run = () => runWithModelFallback(async (m) => (await m.generateContent('p')).response.text());

    expect(await run()).toBe('from m3');
    expect(calls).toEqual(['m1', 'm2', 'm3']);

    calls.length = 0;
    expect(await run()).toBe('from m3'); // m1 and m2 are cooling down — not even tried
    expect(calls).toEqual(['m3']);
  });

  it('brings the preferred model back once its cooldown has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    scripts.m1 = fail(rateLimited()); // 39s (+1s) cooldown
    const run = () => runWithModelFallback(async (m) => (await m.generateContent('p')).response.text());

    expect(await run()).toBe('from m2');

    vi.setSystemTime(new Date('2027-01-01T00:00:30Z')); // still cooling
    calls.length = 0;
    expect(await run()).toBe('from m2');
    expect(calls).toEqual(['m2']);

    vi.setSystemTime(new Date('2027-01-01T00:00:41Z')); // recovered
    scripts.m1 = ok('m1 is back');
    calls.length = 0;
    expect(await run()).toBe('m1 is back');
    expect(calls).toEqual(['m1']);
  });

  it('does not fall back for errors another model cannot fix', async () => {
    scripts.m1 = fail(fetchError(400));
    await expect(runWithModelFallback(async (m) => m.generateContent('p'))).rejects.toMatchObject({ status: 400 });
    expect(calls).toEqual(['m1']);
  });

  it('a model id that does not exist is skipped and not retried', async () => {
    scripts.m1 = fail(fetchError(404));
    const run = () => runWithModelFallback(async (m) => (await m.generateContent('p')).response.text());
    expect(await run()).toBe('from m2');
    calls.length = 0;
    expect(await run()).toBe('from m2');
    expect(calls).toEqual(['m2']);
  });

  it('when every model is limited: a 429 AI_RATE_LIMITED that says when to retry, and it fails fast afterwards', async () => {
    scripts.m1 = fail(rateLimited());
    scripts.m2 = fail(rateLimited());
    scripts.m3 = fail(rateLimited());
    const run = () => runWithModelFallback(async (m) => m.generateContent('p'));

    await expect(run()).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_RATE_LIMITED',
      message: expect.stringContaining('about 40 seconds'),
    });
    expect(calls).toEqual(['m1', 'm2', 'm3']);

    calls.length = 0;
    await expect(run()).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
    expect(calls).toEqual([]); // no wasted requests while everything is cooling down
  });
});

describe('through the real AI functions', () => {
  const insightsInput = {
    scopeLabel: 'x', totalBudget: null, totalSpent: 0, categoryBreakdown: {}, perUserSpending: [], duration: null,
  };
  const tripParams = { destination: 'Tokyo', days: 3, budget: 1000, currency: 'USD', travelers: 2 };

  it('a user-triggered call succeeds transparently on the fallback model', async () => {
    scripts.m1 = fail(rateLimited());
    await expect(generateSpendingInsights(insightsInput)).resolves.toBe('from m2');
  });

  it('when all models are limited the caller gets the "try again in ~N seconds" error, not a generic one', async () => {
    scripts.m1 = fail(rateLimited());
    scripts.m2 = fail(rateLimited());
    scripts.m3 = fail(rateLimited());
    await expect(generateSpendingInsights(insightsInput)).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
      message: expect.stringContaining('try again in about'),
    });
  });

  it('a stream rejected before any text falls back and delivers the text exactly once', async () => {
    scripts.m1 = fail(rateLimited());
    scripts.m2 = streamOf('Day 1', ' — Tokyo');
    const received: string[] = [];
    await generateTripPlanStream(tripParams, (t) => received.push(t));
    expect(received).toEqual(['Day 1', ' — Tokyo']);
    expect(calls).toEqual(['m1', 'm2']);
  });

  it('a stream that dies after sending text is NOT switched (would splice two models) — it fails', async () => {
    async function* dies() {
      yield { text: () => 'Day 1' };
      throw rateLimited();
    }
    scripts.m1 = () => ({ stream: dies() });
    const received: string[] = [];
    await expect(generateTripPlanStream(tripParams, (t) => received.push(t))).rejects.toMatchObject({
      code: 'AI_GENERATION_FAILED',
    });
    expect(received).toEqual(['Day 1']);
    expect(calls).toEqual(['m1']); // m2 never asked to continue
  });

  it('an empty stream is a failure', async () => {
    scripts.m1 = streamOf();
    await expect(generateTripPlanStream(tripParams, () => {})).rejects.toMatchObject({ code: 'AI_GENERATION_FAILED' });
  });
});
