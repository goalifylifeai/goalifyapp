import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@goalify/sync_queue';

export type QueueItem = {
  id: string;
  table: 'goals' | 'goal_subtasks' | 'habits' | 'habit_logs' | 'journal_entries';
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
  retries: number;
};

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

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

const MAX_RETRIES = 5;

export async function drainQueue(
  syncFn: (item: QueueItem) => Promise<void>,
): Promise<void> {
  const queue = await getQueue();
  const remaining: QueueItem[] = [];

  for (const item of queue) {
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

  await saveQueue(remaining);
}
