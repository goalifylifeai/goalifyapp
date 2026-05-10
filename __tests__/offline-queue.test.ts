// ── Mocks ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
}));

import { enqueue, getQueue, dequeue, drainQueue, clearQueue, type QueueItem } from '../lib/offline-queue';

const makeItem = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: `item-${Math.random()}`,
  table: 'goals',
  operation: 'upsert',
  payload: { id: 'g1' },
  created_at: new Date().toISOString(),
  retries: 0,
  ...overrides,
});

describe('offline-queue', () => {
  beforeEach(async () => {
    await clearQueue();
    jest.clearAllMocks();
  });

  it('starts empty', async () => {
    expect(await getQueue()).toEqual([]);
  });

  it('enqueue appends items and persists', async () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b' });
    await enqueue(a);
    await enqueue(b);
    const q = await getQueue();
    expect(q).toHaveLength(2);
    expect(q[0].id).toBe('a');
    expect(q[1].id).toBe('b');
  });

  it('dequeue removes only the specified item', async () => {
    const a = makeItem({ id: 'a' });
    const b = makeItem({ id: 'b' });
    await enqueue(a);
    await enqueue(b);
    await dequeue('a');
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].id).toBe('b');
  });

  it('drainQueue processes FIFO and removes successful items', async () => {
    const processed: string[] = [];
    await enqueue(makeItem({ id: 'x' }));
    await enqueue(makeItem({ id: 'y' }));

    await drainQueue(async item => { processed.push(item.id); });

    expect(processed).toEqual(['x', 'y']);
    expect(await getQueue()).toHaveLength(0);
  });

  it('drainQueue retries failed items and increments retries', async () => {
    const item = makeItem({ id: 'fail', retries: 0 });
    await enqueue(item);

    await drainQueue(async () => { throw new Error('network'); });

    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].retries).toBe(1);
  });

  it('drainQueue drops item after MAX_RETRIES failures', async () => {
    const item = makeItem({ id: 'dead', retries: 4 }); // 4 previous retries
    await enqueue(item);

    await drainQueue(async () => { throw new Error('network'); });

    // retries hit 5 → dropped
    expect(await getQueue()).toHaveLength(0);
  });

  it('queue survives simulated restart (read back from storage)', async () => {
    const item = makeItem({ id: 'persist-me' });
    await enqueue(item);
    // Simulate fresh read (same AsyncStorage mock preserves the store object)
    const q = await getQueue();
    expect(q[0].id).toBe('persist-me');
  });

  it('clearQueue empties the queue', async () => {
    await enqueue(makeItem());
    await clearQueue();
    expect(await getQueue()).toHaveLength(0);
  });
});
