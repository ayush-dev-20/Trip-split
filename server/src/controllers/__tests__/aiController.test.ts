import { describe, it, expect } from 'vitest';
import { buildAnomalyWhereClause } from '../aiController';

describe('buildAnomalyWhereClause', () => {
  it('scopes to the trip when tripId is provided', () => {
    expect(buildAnomalyWhereClause('user-1', 'FOOD', 'trip-1', undefined))
      .toEqual({ tripId: 'trip-1', category: 'FOOD' });
  });

  it('scopes to the group when groupId is provided and tripId is not', () => {
    expect(buildAnomalyWhereClause('user-1', 'FOOD', undefined, 'group-1'))
      .toEqual({ groupId: 'group-1', category: 'FOOD' });
  });

  it("scopes to the user's own personal expenses when neither tripId nor groupId is provided", () => {
    expect(buildAnomalyWhereClause('user-1', 'FOOD', undefined, undefined))
      .toEqual({ paidById: 'user-1', tripId: null, groupId: null, category: 'FOOD' });
  });

  it('prefers tripId over groupId if both are somehow provided', () => {
    expect(buildAnomalyWhereClause('user-1', 'FOOD', 'trip-1', 'group-1'))
      .toEqual({ tripId: 'trip-1', category: 'FOOD' });
  });
});
