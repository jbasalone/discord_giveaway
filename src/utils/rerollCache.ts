import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbFile = path.resolve(__dirname, '../../db/reroll.sqlite');

const dbPromise = open({
    filename: dbFile,
    driver: sqlite3.Database,
});

// ✅ Initialize once with full schema
async function ensureTable() {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS joiners (
                                               messageId TEXT PRIMARY KEY,
                                               giveawayId INTEGER,
                                               guildId TEXT,
                                               channelId TEXT,
                                               participants TEXT,
                                               winnerCount INTEGER,
                                               originalWinners TEXT,
                                               rerollCount INTEGER,
                                               rerolledAt INTEGER
        );
    `);
    return db;
}

// ✅ Save joiners + metadata
export async function saveJoiners(
    messageId: string,
    guildId: string,
    channelId: string,
    participants: string[],
    winnerCount: number,
    originalWinners: string[] = [],
    rerollCount = 0,
    giveawayId?: number
) {
    const db = await ensureTable();
    await db.run(
        `INSERT OR REPLACE INTO joiners 
         (messageId, giveawayId, guildId, channelId, participants, winnerCount, originalWinners, rerollCount, rerolledAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        messageId,
        giveawayId ?? null,
        guildId,
        channelId,
        JSON.stringify(participants),
        winnerCount,
        JSON.stringify(originalWinners),
        rerollCount,
        Math.floor(Date.now() / 1000)
    );
    console.log(`[rerollCache] ✅ Tracked giveaway ${messageId} with reroll #${rerollCount}`);
}

// ✅ Get participant list only
export async function getJoinersFromDb(messageId: string): Promise<string[]> {
    const db = await ensureTable();
    const row = await db.get(
        `SELECT participants FROM joiners WHERE messageId = ?`,
        messageId
    );
    if (!row?.participants) return [];
    try {
        const parsed = JSON.parse(row.participants);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ✅ Get winner count + minimal context
export async function getJoinerMetaFromDb(messageId: string): Promise<{ guildId: string; channelId: string; winnerCount: number } | null> {
    const db = await ensureTable();
    const row = await db.get(`SELECT guildId, channelId, winnerCount FROM joiners WHERE messageId = ?`, messageId);
    if (!row) return null;
    return {
        guildId: row.guildId,
        channelId: row.channelId,
        winnerCount: Number(row.winnerCount ?? 1)
    };
}

// ✅ Get full historical record
export async function getFullJoinerMeta(messageId: string): Promise<{
    guildId: string,
    channelId: string,
    participants: string[],
    winnerCount: number,
    originalWinners: string[],
    rerollCount: number,
    rerolledAt: number
} | null> {
    const db = await ensureTable();
    const row = await db.get(`SELECT * FROM joiners WHERE messageId = ?`, messageId);
    if (!row) return null;

    return {
        guildId: row.guildId,
        channelId: row.channelId,
        participants: JSON.parse(row.participants ?? "[]"),
        winnerCount: Number(row.winnerCount ?? 1),
        originalWinners: JSON.parse(row.originalWinners ?? "[]"),
        rerollCount: Number(row.rerollCount ?? 0),
        rerolledAt: Number(row.rerolledAt ?? 0)
    };
}