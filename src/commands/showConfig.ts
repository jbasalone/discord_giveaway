import { Message, EmbedBuilder, PermissionsBitField, Colors } from 'discord.js';
import { getGuildPrefix } from '../utils/getGuildPrefix';
import { GuildSettings } from '../models/GuildSettings';
import { ExtraEntries } from '../models/ExtraEntries';
import config from '../config.json';

export async function execute(message: Message, guildId?: string) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need **Administrator** permissions to view the guild configuration.");
  }

  guildId = guildId || message.guild.id;

  try {
    // ✅ Fetch all necessary settings
    const prefix = await getGuildPrefix(guildId);
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
      return message.reply("❌ No settings found for this server.");
    }

    // ✅ Always use `.get()` to retrieve values
    const defaultRoleId = guildSettings.get("defaultGiveawayRoleId") ?? null;
    const defaultRoleMention = defaultRoleId ? `<@&${defaultRoleId}>` : "❌ Not Set";

    // ✅ Fix: Ensure Miniboss Channel ID is retrieved correctly
    const minibossChannelId = guildSettings.get("minibossChannelId") ?? null;
    const minibossChannelMention = minibossChannelId ? `<#${minibossChannelId}>` : "❌ Not Set";

    // ✅ Fetch extra entry roles
    const extraEntries = await ExtraEntries.findAll({ where: { guildId } });
    const extraEntriesText = extraEntries.length > 0
        ? extraEntries.map(entry => `<@&${entry.get("roleId")}> ➝ **+${entry.get("bonusEntries")} entries**`).join("\n")
        : "❌ No extra entry roles set.";

    // ✅ Allowed Giveaway Channels (Ensure correct structure)
    const allowedGuilds: Record<string, string[]> = config.allowedGuilds;
    const allowedChannels = allowedGuilds[guildId] ?? [];
    const allowedChannelsText = allowedChannels.length > 0
        ? allowedChannels.map(channelId => `<#${channelId}>`).join("\n")
        : "❌ No restricted giveaway channels.";

    // ✅ Create Embed
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Server Giveaway Configuration`)
        .setDescription(`Here are the current giveaway settings for **${message.guild.name}**.`)
        .setColor(Colors.Blue)
        .addFields(
            { name: "🛠 Prefix", value: `\`${prefix}\``, inline: true },
            { name: "🎭 Default Giveaway Role", value: defaultRoleMention, inline: true },
            { name: "📌 Miniboss Channel", value: minibossChannelMention, inline: true }, // ✅ Now retrieves correctly
            { name: "➕ Extra Entry Roles", value: extraEntriesText, inline: false },
            { name: "📢 Allowed Giveaway Channels", value: allowedChannelsText, inline: false }
        )
        .setFooter({ text: "Only server admins can modify these settings." });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Error fetching guild configuration:", error);
    return message.reply("❌ **Failed to retrieve guild configuration.** Please try again.");
  }
}