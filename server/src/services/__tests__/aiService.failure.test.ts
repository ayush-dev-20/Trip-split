import { describe, it, expect, vi } from 'vitest';

// No API key => getModel() throws, which is exactly the "AI call failed" path.
vi.mock('../../config/env', () => ({
  env: { GEMINI_API_KEY: '', GEMINI_MODELS: ['test-model'], GEMINI_MODEL: 'test-model', NODE_ENV: 'test' },
}));

import {
  generateSpendingInsights,
  generateTripPlan,
  generateTripPlanStream,
  generateTripPlanRefineStream,
  generateNoteContentStream,
  generateCheckpointSuggestions,
  generatePackingList,
  parseNaturalLanguageExpense,
  scanReceipt,
  categorizeExpense,
  normalizePackingList,
} from '../aiService';

const tripParams = { destination: 'Tokyo', days: 3, budget: 1000, currency: 'USD', travelers: 2 };

describe('user-triggered AI generators fail loudly instead of returning filler', () => {
  const failed = { code: 'AI_GENERATION_FAILED', statusCode: 503 };

  it('non-streaming text/JSON generators reject with a typed 503', async () => {
    await expect(generateSpendingInsights({
      scopeLabel: 'x', totalBudget: null, totalSpent: 0, categoryBreakdown: {}, perUserSpending: [], duration: null,
    })).rejects.toMatchObject(failed);
    await expect(generateTripPlan(tripParams)).rejects.toMatchObject(failed);
    await expect(generateCheckpointSuggestions(tripParams)).rejects.toMatchObject(failed);
    await expect(generatePackingList({ destination: 'Tokyo', days: 3, travelers: 2 })).rejects.toMatchObject(failed);
    await expect(parseNaturalLanguageExpense('coffee 200')).rejects.toMatchObject(failed);
    await expect(scanReceipt('AAAA', 'image/png')).rejects.toMatchObject(failed);
  });

  it('streaming generators reject and never emit fallback text as content', async () => {
    const chunks: string[] = [];
    const onChunk = (t: string) => chunks.push(t);

    await expect(generateTripPlanStream(tripParams, onChunk)).rejects.toMatchObject(failed);
    await expect(generateTripPlanRefineStream({ currentItinerary: 'a', instruction: 'b' }, onChunk)).rejects.toMatchObject(failed);
    await expect(generateNoteContentStream({ context: 'c', prompt: 'p' }, onChunk)).rejects.toMatchObject(failed);

    expect(chunks).toEqual([]);
  });

  it('passive features still degrade silently to a default', async () => {
    await expect(categorizeExpense('Uber to airport')).resolves.toBe('MISCELLANEOUS');
  });
});

describe('normalizePackingList', () => {
  it('returns no categories for malformed model output', () => {
    expect(normalizePackingList(null).categories).toEqual([]);
    expect(normalizePackingList({}).categories).toEqual([]);
    expect(normalizePackingList({ categories: 'nope' }).categories).toEqual([]);
  });

  it('keeps only named categories with real string items, trimmed and de-duplicated', () => {
    const out = normalizePackingList({
      categories: [
        { name: ' Clothing ', items: [' T-shirts ', 't-shirts', '', 42, 'Jacket'] },
        { name: 'Empty', items: [] },
        { name: '', items: ['x'] },
        { name: 'No items field' },
        null,
      ],
    });
    expect(out.categories).toEqual([{ name: 'Clothing', items: ['T-shirts', 'Jacket'] }]);
  });
});
