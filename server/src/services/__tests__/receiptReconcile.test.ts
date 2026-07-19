import { describe, it, expect } from 'vitest';
import { reconcileReceipt } from '../aiService';

const base = {
  vendor: 'Cafe Goa', date: '2026-07-12', currency: 'INR', category: 'FOOD',
  subtotal: 2440, tax: 700, serviceCharge: 100, total: 3240,
};

describe('reconcileReceipt', () => {
  it('passes through when everything sums', () => {
    const r = reconcileReceipt({
      ...base,
      items: [
        { name: 'Paneer Tikka', quantity: 1, unitPrice: 340, totalPrice: 340 },
        { name: 'Kingfisher', quantity: 3, unitPrice: 300, totalPrice: 900 },
        { name: 'Dal Makhani', quantity: 1, unitPrice: 280, totalPrice: 280 },
        { name: 'Steak', quantity: 1, unitPrice: 450, totalPrice: 450 },
        { name: 'Veg Biryani', quantity: 1, unitPrice: 470, totalPrice: 470 },
      ],
    });
    expect(r.reconciled).toBe(false);
    expect(r.items).toHaveLength(5);
  });

  it('adds an adjustment line when items miss the subtotal', () => {
    const r = reconcileReceipt({
      ...base,
      items: [{ name: 'Thali', quantity: 2, unitPrice: 1000, totalPrice: 2000 }], // 440 short
    });
    const adj = r.items.find((i) => i.isAdjustment);
    expect(adj?.totalPrice).toBe(440);
    expect(r.reconciled).toBe(true);
  });

  it('recomputes total when components disagree', () => {
    const r = reconcileReceipt({
      ...base,
      total: 9999,
      items: [{ name: 'Thali', quantity: 1, unitPrice: 2440, totalPrice: 2440 }],
    });
    expect(r.total).toBe(3240); // subtotal + tax + serviceCharge
    expect(r.reconciled).toBe(true);
  });

  it('tolerates missing tax/service (treated as 0)', () => {
    const r = reconcileReceipt({
      vendor: 'X', date: null, currency: 'USD', category: 'FOOD',
      items: [{ name: 'Coffee', quantity: 1, unitPrice: 5, totalPrice: 5 }],
      subtotal: 5, tax: undefined, serviceCharge: undefined, total: 5,
    });
    expect(r.tax).toBe(0);
    expect(r.total).toBe(5);
  });
});
