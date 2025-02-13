import { Message, PermissionsBitField } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function setGuildPrefix(message: Message, newPrefix: string) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need **Administrator** permissions to change the prefix.");
  }

  if (newPrefix.length > 5) {
    return message.reply("❌ The prefix must be **5 characters or less**.");
  }

  try {
    await GuildSettings.upsert({
      guildId: message.guild.id,
      prefix: newPrefix // ✅ Store the new prefix
    });

    return message.reply(`✅ The bot prefix has been updated to **${newPrefix}**`);
  } catch (error) {
    console.error("❌ Error updating prefix:", error);
    return message.reply("❌ **Failed to update the prefix.** Please try again.");
  }
}