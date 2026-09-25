import { describe, it, expect, vi, beforeEach } from 'vitest';

// A configured key + a stubbed Gemini SDK whose reply we control per test.
vi.mock('../../config/env', () => ({
  env: { GEMINI_API_KEY: 'test-key', GEMINI_MODELS: ['test-model'], GEMINI_MODEL: 'test-model', NODE_ENV: 'test' },
}));

let nextReply = '';
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: async () => ({ response: { text: () => nextReply } }) };
    }
  },
}));

import { scanReceipt, scanReceiptItemized } from '../aiService';

const receipt = { title: 'Blue Bottle', amount: 12.5, currency: 'USD', category: 'FOOD', date: '2027-01-02', description: 'Latte' };
const itemized = {
  vendor: 'Blue Bottle',
  date: '2027-01-02',
  currency: 'USD',
  category: 'FOOD',
  items: [{ name: 'Latte', quantity: 2, unitPrice: 5, totalPrice: 10 }],
  subtotal: 10,
  tax: 1,
  serviceCharge: 1.5,
  total: 12.5,
};

beforeEach(() => { nextReply = ''; });

describe('scanReceipt parses the model reply the way models actually format it', () => {
  it('plain JSON', async () => {
    nextReply = JSON.stringify(receipt);
    await expect(scanReceipt('AAAA', 'image/png')).resolves.toEqual(receipt);
  });

  it('JSON wrapped in a ```json fence (previously fell through to an empty "Receipt")', async () => {
    nextReply = '```json\n' + JSON.stringify(receipt, null, 2) + '\n```';
    await expect(scanReceipt('AAAA', 'image/png')).resolves.toEqual(receipt);
  });

  it('JSON surrounded by prose', async () => {
    nextReply = `Here is the data you asked for:\n${JSON.stringify(receipt)}\nLet me know if you need more.`;
    await expect(scanReceipt('AAAA', 'image/png')).resolves.toEqual(receipt);
  });

  it('an unparseable reply is a real failure, not a made-up empty receipt', async () => {
    nextReply = "Sorry, I can't read this image.";
    await expect(scanReceipt('AAAA', 'image/png')).rejects.toMatchObject({ code: 'AI_GENERATION_FAILED', statusCode: 503 });
  });
});

describe('scanReceiptItemized parses the model reply the way models actually format it', () => {
  it('JSON wrapped in a fence', async () => {
    nextReply = '```json\n' + JSON.stringify(itemized) + '\n```';
    const out = await scanReceiptItemized('AAAA', 'image/png');
    expect(out.vendor).toBe('Blue Bottle');
    expect(out.items).toHaveLength(1);
    expect(out.total).toBe(12.5);
    expect(out.reconciled).toBe(false); // arithmetic already added up
  });

  it('an unparseable reply is a real failure, not an empty itemization', async () => {
    nextReply = 'no json here';
    await expect(scanReceiptItemized('AAAA', 'image/png')).rejects.toMatchObject({ code: 'AI_GENERATION_FAILED' });
  });
});
