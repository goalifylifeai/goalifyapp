import { newId } from './id';
import type { JournalEntry } from '../store/reducer';

export function roughSentiment(text: string): number {
  const positive = /\b(good|great|proud|happy|steady|moved|shipped|win|better|love|calm|grateful|strong|joy|excited)\b/gi;
  const negative = /\b(hard|miss|fail|sad|tired|struggle|heavy|guilt|hurt|anxiety|worried|stuck|low|skip)\b/gi;
  const pos = (text.match(positive) ?? []).length;
  const neg = (text.match(negative) ?? []).length;
  const base = (pos - neg) / (pos + neg + 3);
  return Math.min(Math.max(base, -0.9), 0.9);
}

/** A Journal entry from free text: full body, ≤140-char excerpt, rough sentiment. */
export function buildJournalEntry(raw: string, date: string): JournalEntry {
  const text = raw.trim();
  return {
    id: newId(),
    date,
    sentiment: roughSentiment(text),
    excerpt: text.length > 140 ? text.slice(0, 138) + '…' : text,
    body: text,
  };
}
