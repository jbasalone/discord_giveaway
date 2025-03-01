export function convertToMilliseconds(time: string | number): number {
  if (typeof time === "number") return time; // Already in ms
  if (!time) return NaN;

  const match = time.match(/(\d+)(s|m|h|d)/);
  if (!match) return NaN;

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value * 1000;
    case "m": return value * 60000;
    case "h": return value * 3600000;
    case "d": return value * 86400000;
    default: return NaN;
  }
}