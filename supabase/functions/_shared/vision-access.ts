// Accounts that never get vision images (e.g. the QA account), from the
// VISION_DISABLED_USER_IDS secret: comma-separated auth user ids.
export function imagesDisabledFor(userId: string, setting: string | undefined): boolean {
  if (!setting) return false;
  const id = userId.toLowerCase();
  return setting.split(',').some(s => s.trim().toLowerCase() === id);
}
