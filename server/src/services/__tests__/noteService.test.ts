import { describe, it, expect } from 'vitest';
import { scopeWhere } from '../noteService';

describe('scopeWhere', () => {
  it('resolves trip scope', () => {
    expect(scopeWhere({ type: 'trip', tripId: 't1' }, 'u1')).toEqual({ tripId: 't1' });
  });

  it('resolves group scope', () => {
    expect(scopeWhere({ type: 'group', groupId: 'g1' }, 'u1')).toEqual({ groupId: 'g1' });
  });

  it('resolves personal scope to both FKs null, scoped to the user', () => {
    expect(scopeWhere({ type: 'personal' }, 'u1')).toEqual({ tripId: null, groupId: null, userId: 'u1' });
  });
});
