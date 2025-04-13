import { Message, PermissionsBitField } from 'discord.js';
import { ExtraEntries } from '../models/ExtraEntries';
import { GuildSettings } from '../models/GuildSettings';


export async function execute(message: Message, args: string[], guildId: string) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need **Administrator** permissions to set extra entry roles.");
  }

  const guild = message.guild?.id;
  const settings = await GuildSettings.findOne({ where: { guild } });
  const prefix = settings?.get("prefix") || "!";

  if (args.length < 2) {
    return message.reply(`❌ Usage:\n\`\`\`\n${prefix} ga setextraentry @role <entries>\n\`\`\``);
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return message.reply("❌ Please **mention a valid role**.");
  }

  const bonusEntries = parseInt(args[1], 10);
  if (isNaN(bonusEntries) || bonusEntries < 1) {
    return message.reply("❌ Invalid entry count! Must be a **positive number**.");
  }

  try {
    const existingEntry = await ExtraEntries.findOne({ where: { guildId, roleId: role.id } });

    if (existingEntry) {
      await existingEntry.update({ bonusEntries });
      return message.reply(`✅ Updated extra entries for **${role.name}** to **${bonusEntries}**.`);
    } else {
      await ExtraEntries.create({
        guildId,
        roleId: role.id,
        bonusEntries
      });

      return message.reply(`✅ Assigned **${bonusEntries}** extra entries to **${role.name}**.`);
    }
  } catch (error) {
    console.error("❌ Error setting extra entry role:", error);
    return message.reply("❌ **Failed to set extra entries.** Please try again.");
  }
}