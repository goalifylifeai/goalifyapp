import { buildJournalEntry, roughSentiment } from '../lib/journal-entry';

describe('buildJournalEntry', () => {
  it('keeps the full text as the body and dates it', () => {
    const e = buildJournalEntry('Shipped the thing, proud of it.', '2026-09-23');
    expect(e.date).toBe('2026-09-23');
    expect(e.body).toBe('Shipped the thing, proud of it.');
    expect(e.excerpt).toBe('Shipped the thing, proud of it.');
    expect(e.id).toEqual(expect.any(String));
  });

  it('trims the text and truncates the excerpt to 140 chars', () => {
    const long = `  ${'a'.repeat(200)}  `;
    const e = buildJournalEntry(long, '2026-09-23');
    expect(e.body).toBe('a'.repeat(200));
    expect(e.excerpt).toHaveLength(139);
    expect(e.excerpt.endsWith('…')).toBe(true);
  });
});

describe('roughSentiment', () => {
  it('scores positive, negative and neutral lines', () => {
    expect(roughSentiment('good day, proud')).toBeGreaterThan(0);
    expect(roughSentiment('tired and stuck')).toBeLessThan(0);
    expect(roughSentiment('went to the shop')).toBe(0);
  });
});
