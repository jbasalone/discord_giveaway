import { GuildSettings } from '../models/GuildSettings';

export async function getGuildPrefix(guildId: string): Promise<string> {
  const settings = await GuildSettings.findOne({ where: { guildId } });

  return settings ? settings.getDataValue('prefix') : '!'; // ✅ Fetch prefix safely
}