export type AutoSaveStatus =
  | "loading"
  | "pending"
  | "saving"
  | "saved"
  | "error";

export function formatSavedTime(savedAt: number, now: number) {
  const elapsed = Math.max(0, now - savedAt);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 60 * 60_000) {
    const minutes = Math.floor(elapsed / 60_000);
    return `${minutes} min ago`;
  }
  if (elapsed < 24 * 60 * 60_000) {
    const hours = Math.floor(elapsed / (60 * 60_000));
    return `${hours} hr ago`;
  }
  return new Date(savedAt).toLocaleString();
}
