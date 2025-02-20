const NUMBER_LETTER = ["K", "M", "B", "T", "Q", "QQ", "S", "SS", "O", "N", "D", "UN", "DD", "TD", "QD", "Qn", "Sd", "St", "Og"];

/**
 * Converts a large number into ERPG-style readable format (e.g., 1K, 1M, 1B, etc.).
 */
export function numberToPrettyERPGNumber(num: number): string {
    if (num < 1_000) return num.toString();

    let numStr = num.toExponential(2).replace("+", ""); // Convert to scientific notation
    const [base, exponent] = numStr.split("e");

    const expIndex = Math.floor(parseInt(exponent, 10) / 3) - 1;

    if (expIndex < 0 || expIndex >= NUMBER_LETTER.length) {
        return num.toLocaleString(); // If out of range, return comma-separated format
    }

    const formattedBase = parseFloat(base).toFixed(2).replace(/\.?0+$/, ""); // Remove trailing zeros

    return `${formattedBase}${NUMBER_LETTER[expIndex]}`;
}