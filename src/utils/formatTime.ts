export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Giveaway ended!";

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);

  return `${minutes}m ${seconds}s`;
}