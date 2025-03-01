export function parseScheduleTime(input: string): Date | null {
    const now = new Date();

    if (/^\d+[smhd]$/.test(input)) {
        const match = input.match(/^(\d+)([smhd])$/);
        if (!match) return null;

        let value = parseInt(match[1], 10);
        let unit = match[2];

        if (unit === "m") value *= 60;
        if (unit === "h") value *= 3600;
        if (unit === "d") value *= 86400;

        return new Date(now.getTime() + value * 1000);
    }

    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
}