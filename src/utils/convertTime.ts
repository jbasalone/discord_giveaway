export function convertToMilliseconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 60000; // Default to 1 minute if invalid

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000; // Seconds
    case 'm': return value * 60 * 1000; // Minutes
    case 'h': return value * 60 * 60 * 1000; // Hours
    case 'd': return value * 24 * 60 * 60 * 1000; // Days
    default: return 60000;
  }
}
