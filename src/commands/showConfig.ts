import { Message, EmbedBuilder } from 'discord.js';
import { getGuildPrefix } from '../utils/getGuildPrefix';
import { GuildSettings } from '../models/GuildSettings';
import { ExtraEntries } from '../models/ExtraEntries';
import config from '../config.json';

export async function execute(message: Message, guildId?: string) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ You need Administrator permissions to view the guild configuration.");
  }

  if (!guildId) guildId = message.guild!.id;

  const prefix = await getGuildPrefix(guildId);
  const guildSettings = await GuildSettings.findOne({ where: { guildId }, raw: true }); // ✅ Fetch from `guild_settings`
  const extraEntries = await ExtraEntries.findAll({ where: { guildId } });

  const defaultRoleId = guildSettings?.defaultGiveawayRoleId;
  const defaultRoleMention = defaultRoleId ? `<@&${defaultRoleId}>` : "❌ Not Set";

  // ✅ Fetch Miniboss Channel
  const minibossChannelId = guildSettings?.minibossChannelId;
  const minibossChannelMention = minibossChannelId ? `<#${minibossChannelId}>` : "❌ Not Set";

  let extraEntriesText = extraEntries.length > 0
      ? extraEntries.map(entry => `<@&${entry.roleId}> ➝ **+${entry.bonusEntries} entries**`).join("\n")
      : "❌ No extra entry roles set.";

  const allowedChannels: string[] = (config.allowedGuilds as Record<string, string[]>)[guildId] || [];
  let allowedChannelsText = allowedChannels.length > 0
      ? allowedChannels.map((channelId: string) => `<#${channelId}>`).join("\n")
      : "❌ No restricted giveaway channels.";

  const embed = new EmbedBuilder()
      .setTitle(`⚙️ Server Giveaway Configuration`)
      .setDescription(`Here are the current giveaway settings for **${message.guild!.name}**.`)
      .addFields(
          { name: "🛠 Prefix", value: `\`${prefix}\``, inline: true },
          { name: "🎭 Default Giveaway Role", value: defaultRoleMention, inline: true },
          { name: "📌 Miniboss Channel", value: minibossChannelMention, inline: true }, // ✅ Now correctly displays Miniboss channel
          { name: "➕ Extra Entry Roles", value: extraEntriesText, inline: false },
          { name: "📢 Allowed Giveaway Channels", value: allowedChannelsText, inline: false }
      )
      .setColor("Blue")
      .setFooter({ text: "Only server admins can modify these settings." });

  await message.reply({ embeds: [embed] });
}