import { Message } from 'discord.js';
import { ExtraEntries } from '../models/ExtraEntries';

export async function execute(message: Message, args: string[], guildId: string) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ You need Administrator permissions to set extra entry roles.");
  }

  if (args.length < 2) {
    return message.reply("❌ Usage: `!ga setextraentry @role <entries>` - Assigns extra entries to a role.");
  }

  const roleMention = args[0];
  const roleId = roleMention.replace(/\D/g, ""); // ✅ Extract role ID
  const bonusEntries = parseInt(args[1], 10);

  if (isNaN(bonusEntries) || bonusEntries < 1) {
    return message.reply("❌ Invalid entry count! Must be a positive number.");
  }

  const existingEntry = await ExtraEntries.findOne({ where: { guildId, roleId } });

  if (existingEntry) {
    await existingEntry.update({ bonusEntries });
    return message.reply(`✅ Updated extra entries for <@&${roleId}> to **${bonusEntries}**.`);
  } else {
    await ExtraEntries.create({
      guildId,
      roleId,
      bonusEntries
    });
    return message.reply(`✅ Assigned **${bonusEntries}** extra entries to <@&${roleId}>.`);
  }
}