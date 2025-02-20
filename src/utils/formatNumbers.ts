const NUMBER_LETTER = ["K", "M", "B", "T", "Q", "QQ", "S", "SS", "O", "N", "D", "UN", "DD", "TD", "QD", "Qn", "Sd", "St", "Og"];

/**
 * Converts a large number into ERPG-style readable format (e.g., 1K, 1M, 1B, etc.).
 */
export function numberToPrettyERPGNumber(num: number): string {
    if (num < 1_000) return num.toString();

    const exponent = Math.floor(Math.log10(num));
    const expIndex = Math.floor(exponent / 3) - 1;

    if (expIndex < 0 || expIndex >= NUMBER_LETTER.length) {
        return num.toLocaleString(); // ✅ If out of range, return comma-separated format
    }

    const divisor = Math.pow(10, (expIndex + 1) * 3);
    const formattedBase = (num / divisor).toFixed(2).replace(/\.?0+$/, ""); // ✅ Keep correct number scale.

    return `${formattedBase}${NUMBER_LETTER[expIndex]}`;
}