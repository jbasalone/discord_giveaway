import { Message } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function executeSetDefaultRole(message: Message) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ You need Administrator permissions to use this command.");
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return message.reply("❌ Please mention a role.");
  }

  await GuildSettings.upsert({
    guildId: message.guild!.id,
    defaultGiveawayRoleId: role.id
  });

  message.reply(`✅ The default giveaway role has been set to **${role.name}**.`);
}
