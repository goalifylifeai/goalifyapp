// DJB2 hash of goal id, clamped to positive int32 range.
export function seedFromGoalId(goalId: string): number {
  let hash = 5381;
  for (let i = 0; i < goalId.length; i++) {
    hash = ((hash << 5) + hash) ^ goalId.charCodeAt(i);
    hash = hash >>> 0;
  }
  return (hash % 2_147_483_647) + 1;
}
