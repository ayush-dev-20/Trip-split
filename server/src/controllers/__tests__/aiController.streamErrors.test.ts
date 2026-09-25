import { describe, it, expect, vi } from 'vitest';

// No API key => every Gemini call fails, which is the path under test.
vi.mock('../../config/env', () => ({
  env: { GEMINI_API_KEY: '', GEMINI_MODELS: ['test-model'], GEMINI_MODEL: 'test-model', NODE_ENV: 'test' },
}));

import { tripPlannerStream, tripPlannerRefineStream } from '../aiController';

function fakeRes() {
  const written: string[] = [];
  const res = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => { written.push(chunk); return true; }),
    end: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const events = () =>
    written.filter((w) => w.startsWith('data: ')).map((w) => JSON.parse(w.slice(6).trim()) as { type: string });
  return { res, events };
}

const fakeReq = (body: unknown) => ({ body, socket: { setNoDelay: vi.fn() }, user: { id: 'u1' } }) as never;

describe('SSE controllers report a failed generation as an error event', () => {
  it('standalone planner stream: emits `error`, never fake `chunk` text or `done`', async () => {
    const { res, events } = fakeRes();
    await tripPlannerStream(
      fakeReq({ destination: 'Tokyo', days: 3, budget: 1000, currency: 'USD', travelers: 2 }),
      res as never
    );

    const types = events().map((e) => e.type);
    expect(types).toEqual(['error']);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('refine stream: emits `error`, never fake `chunk` text or `done`', async () => {
    const { res, events } = fakeRes();
    await tripPlannerRefineStream(fakeReq({ currentItinerary: '# Plan', instruction: 'cheaper' }), res as never);

    expect(events().map((e) => e.type)).toEqual(['error']);
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
