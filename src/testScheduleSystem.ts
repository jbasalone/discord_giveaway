import { GuildSettings } from '../models/GuildSettings';

const guildId = message.guild?.id;
const settings = await GuildSettings.findOne({ where: { guildId } });
const prefix = settings?.get("prefix") || "!";