import { Message, PermissionsBitField } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function executeSetDefaultRole(message: Message) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need **Administrator** permissions to set a default giveaway role.");
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return message.reply("❌ Please **mention a valid role**.");
  }

  try {
    await GuildSettings.upsert({
      guildId: message.guild.id,
      defaultGiveawayRoleId: role.id
    });

    return message.reply(`✅ The **default giveaway role** has been set to **${role.name}**.`);
  } catch (error) {
    console.error("❌ Error setting default giveaway role:", error);
    return message.reply("❌ **Failed to set the default giveaway role.** Please try again.");
  }
}