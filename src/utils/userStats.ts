import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbFile = path.resolve(__dirname, '../../db/userstats.sqlite');

const dbPromise = open({ filename: dbFile, driver: sqlite3.Database });

async function ensureTable() {
    const db = await dbPromise;
    await db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      userId TEXT,
      guildId TEXT,
      joined INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      rerolled INTEGER DEFAULT 0,
      PRIMARY KEY (userId, guildId)
    )
  `);
    return db;
}

export async function incrementStat(userId: string, guildId: string, field: 'joined' | 'won' | 'rerolled') {
    const db = await ensureTable();
    await db.run(`
    INSERT INTO user_stats (userId, guildId, ${field})
    VALUES (?, ?, 1)
    ON CONFLICT(userId, guildId) DO UPDATE SET ${field} = ${field} + 1
  `, userId, guildId);
}

export async function getUserStats(userId: string, guildId: string) {
    const db = await ensureTable();
    const row = await db.get(`
    SELECT joined, won, rerolled FROM user_stats
    WHERE userId = ? AND guildId = ?
  `, userId, guildId);

    return row ?? { joined: 0, won: 0, rerolled: 0 };
}