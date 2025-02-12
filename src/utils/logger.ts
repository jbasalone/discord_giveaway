import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../../logs/bot.log');

export function logAction(action: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${action}\n`;

    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage);
}