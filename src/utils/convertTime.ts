export function convertToMilliseconds(timeString: string): number {
  const timeRegex = /^(\d+)(s|m|h|d)$/; // Matches 10s, 5m, 2h, 1d, etc.
  const match = timeString.match(timeRegex);

  if (!match) {
    console.warn(`⚠️ Invalid time format: ${timeString}`);
    return NaN; // Invalid format
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000; // Seconds to milliseconds
    case 'm': return value * 60 * 1000; // Minutes to milliseconds
    case 'h': return value * 60 * 60 * 1000; // Hours to milliseconds
    case 'd': return value * 24 * 60 * 60 * 1000; // Days to milliseconds
    default: return NaN;
  }
}