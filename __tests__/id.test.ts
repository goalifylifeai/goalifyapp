import { newId } from '../lib/id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('newId', () => {
  it('returns a valid UUID', () => {
    expect(newId()).toMatch(UUID_PATTERN);
  });

  it('returns unique values across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newId()));
    expect(ids.size).toBe(20);
  });
});
