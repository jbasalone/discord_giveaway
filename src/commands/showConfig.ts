import { Message, EmbedBuilder, PermissionsBitField, Colors } from 'discord.js';
import { getGuildPrefix } from '../utils/getGuildPrefix';
import { GuildSettings } from '../models/GuildSettings';
import { ExtraEntries } from '../models/ExtraEntries';

export async function execute(message: Message, guildId?: string) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ You need **Administrator** permissions to view the guild configuration.");
  }

  guildId = guildId || message.guild.id;

  try {
    const prefix = await getGuildPrefix(guildId);
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
      return message.reply("❌ No settings found for this server.");
    }

    // ✅ Retrieve Values Safely
    const defaultRoleId = guildSettings.get("defaultGiveawayRoleId") ?? null;
    const defaultRoleMention = defaultRoleId ? `<@&${defaultRoleId}>` : "❌ Not Set";

    const minibossChannelId = guildSettings.get("minibossChannelId") ?? null;
    const minibossChannelMention = minibossChannelId ? `<#${minibossChannelId}>` : "❌ Not Set";

    // ✅ Fetch Allowed Roles (Who Can Start Giveaways)
    let allowedRoles: string[] = [];
    try {
      allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
      allowedRoles = [];
    }
    const allowedRolesText = allowedRoles.length > 0
        ? allowedRoles.map(roleId => `<@&${roleId}>`).join("\n")
        : "❌ No restrictions set.";

    // ✅ Fetch Role Mappings (Roles to Ping When GA Starts)
    let roleMappings: Record<string, string> = {};
    try {
      roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
      roleMappings = {};
    }
    const roleMappingsText = Object.keys(roleMappings).length > 0
        ? Object.entries(roleMappings).map(([roleName, roleId]) => `**${roleName}**: <@&${roleId}>`).join("\n")
        : "❌ No ping roles set.";

    // ✅ Fetch Extra Entries Roles (🔍 FIXED)
    const extraEntries = await ExtraEntries.findAll({ where: { guildId } });

    const extraEntriesText = extraEntries.length > 0
        ? extraEntries
            .map(entry => {
              const roleId = entry.get("roleId") ?? "Unknown Role";
              const bonusEntries = entry.get("bonusEntries") ?? 0;

              return `<@&${roleId}>: **+${bonusEntries} Entries**`;
            })
            .join("\n")
        : "❌ No extra entry roles set.";

    // ✅ Create Embed
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Server Giveaway Configuration`)
        .setDescription(`Here are the current giveaway settings for **${message.guild.name}**.`)
        .setColor(Colors.Blue)
        .addFields(
            { name: "🛠 Prefix", value: `\`${prefix}\``, inline: true },
            { name: "🎭 Default Giveaway Role", value: defaultRoleMention, inline: true },
            { name: "📌 Miniboss Channel", value: minibossChannelMention, inline: true },
            { name: "🔐 Allowed Roles (Who Can Start Giveaways)", value: allowedRolesText, inline: false },
            { name: "📣 Giveaway Ping Roles", value: roleMappingsText, inline: false },
            { name: "🎟️ Extra Entry Roles", value: extraEntriesText, inline: false } // ✅ FIXED FIELD
        )
        .setFooter({ text: "Only server admins can modify these settings." });

    await message.reply({ embeds: [embed] });

  } catch (error) {
    console.error("❌ Error fetching guild configuration:", error);
    return message.reply("❌ **Failed to retrieve guild configuration.** Please try again.");
  }
}