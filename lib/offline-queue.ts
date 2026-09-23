import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@goalify/sync_queue';

export type QueueItem = {
  id: string;
  table: 'goals' | 'goal_subtasks' | 'habits' | 'habit_logs' | 'journal_entries';
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
  /** User who made the write. Replayed only for them; dropped when another user drains. */
  owner?: string;
};

// Items queued before `owner` existed fall back to the payload's user_id.
function ownerOf(item: QueueItem): string | undefined {
  return item.owner ?? (item.payload.user_id as string | undefined);
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(item: QueueItem): Promise<void> {
  const queue = await getQueue();
  queue.push(item);
  await saveQueue(queue);
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  await saveQueue(queue.filter(item => item.id !== id));
}

// Bumped by clearQueue so a drain that was already running doesn't write its
// failed items back afterwards (e.g. a deleted account's journal text).
let generation = 0;

export async function clearQueue(): Promise<void> {
  generation++;
  await AsyncStorage.removeItem(QUEUE_KEY);
}

const itemKey = (i: QueueItem) => `${i.id}|${i.created_at}`;

const MAX_RETRIES = 5;

export async function drainQueue(
  syncFn: (item: QueueItem) => Promise<void>,
  ownerId?: string,
): Promise<void> {
  const startGeneration = generation;
  const queue = await getQueue();
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    // Another account's write: drop it. A different account signed in on this
    // device, and the previous one's unsynced data (journal text included)
    // must not stay behind on it.
    const owner = ownerOf(item);
    if (ownerId && owner && owner !== ownerId) continue;
    try {
      await syncFn(item);
      // success — drop from queue
    } catch {
      const updated = { ...item, retries: item.retries + 1 };
      if (updated.retries >= MAX_RETRIES) {
        console.warn(`[sync] Dropping queued ${item.operation} on ${item.table} after ${MAX_RETRIES} retries.`);
      } else {
        remaining.push(updated);
      }
    }
  }

  // Merge with what's stored now instead of overwriting it: keep items
  // enqueued while this drain ran, and drop our leftovers if the queue was
  // cleared in the meantime.
  const seen = new Set(queue.map(itemKey));
  const added = (await getQueue()).filter(i => !seen.has(itemKey(i)));
  await saveQueue(generation === startGeneration ? [...remaining, ...added] : added);
}
