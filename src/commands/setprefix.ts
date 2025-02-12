import { Message } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function setGuildPrefix(message: Message, newPrefix: string) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ You need Administrator permissions to change the prefix.");
  }

  if (newPrefix.length > 5) {
    return message.reply("❌ The prefix must be **5 characters or less**.");
  }

  await GuildSettings.upsert({
    guildId: message.guild!.id,
    prefix: newPrefix // ✅ Store the new prefix
  });

  message.reply(`✅ The bot prefix has been updated to **${newPrefix}**`);
}