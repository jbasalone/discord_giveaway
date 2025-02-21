import { Message, EmbedBuilder, PermissionsBitField, Colors } from 'discord.js';
import { getGuildPrefix } from '../utils/getGuildPrefix';
import { GuildSettings } from '../models/GuildSettings';
import { ExtraEntries } from '../models/ExtraEntries';
import { BlacklistedRoles } from '../models/BlacklistedRoles';
import { AllowedGiveawayChannels } from '../models/AllowedGiveawayChannels';
import { MinibossRoles } from '../models/MinibossRoles';

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

    //  Retrieve Core Settings
    const defaultRoleId = guildSettings.get("defaultGiveawayRoleId") ?? null;
    const minibossChannelId = guildSettings.get("minibossChannelId") ?? null;
    const defaultRoleMention = defaultRoleId ? `<@&${defaultRoleId}>` : "❌ Not Set";
    const minibossChannelMention = minibossChannelId ? `<#${minibossChannelId}>` : "❌ Not Set";

    //  Fetch Allowed Giveaway Channels
    const allowedChannels = await AllowedGiveawayChannels.findAll({ where: { guildId } });
    const allowedChannelsText = allowedChannels.length > 0
        ? allowedChannels.map(entry => `<#${entry.get("channelId")}>`).join(", ")
        : "❌ No restrictions (all channels allowed).";

    // Fetch Allowed Roles
    let allowedRoles: string[] = [];
    try {
      allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
      allowedRoles = [];
    }
    const allowedRolesText = allowedRoles.length > 0
        ? allowedRoles.map(roleId => `<@&${roleId}>`).join(", ")
        : "❌ No restrictions set.";

    //  Fetch Miniboss Allowed Roles
    const minibossRoles = await MinibossRoles.findAll({ where: { guildId } });

    const minibossRolesText = minibossRoles.length > 0
        ? minibossRoles
            .map(entry => {
              const roleId = entry.get("roleId") ?? null;
              return roleId ? `<@&${roleId}>` : "❌ Unknown Role";
            })
            .join(", ")
        : "❌ No roles assigned to start Miniboss giveaways.";

    //  Fetch Blacklisted Roles
    const blacklistedRoles = await BlacklistedRoles.findAll({ where: { guildId } });
    const blacklistedRolesText = blacklistedRoles.length > 0
        ? blacklistedRoles.map(entry => `<@&${entry.get("roleId")}>`).join(", ")
        : "❌ No blacklisted roles.";

    //  Fetch Extra Entry Roles
    const extraEntries = await ExtraEntries.findAll({ where: { guildId } });
    const extraEntriesText = extraEntries.length > 0
        ? extraEntries.map(entry => `<@&${entry.get("roleId")}>: **+${entry.get("bonusEntries")} Entries**`).join("\n")
        : "❌ No extra entry roles set.";

    //  Fetch Role Mappings
    let roleMappings: Record<string, string> = {};
    try {
      roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
      roleMappings = {};
    }
    const roleMappingsText = Object.keys(roleMappings).length > 0
        ? Object.entries(roleMappings).map(([roleName, roleId]) => `**${roleName}**: <@&${roleId}>`).join("\n")
        : "❌ No ping roles set.";

    // Create Compact Embed
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Server Giveaway Configuration`)
        .setDescription(`📜 **Server Settings for** **${message.guild.name}**`)
        .setColor(Colors.Blue)
        .addFields(
            { name: "🛠 Prefix", value: `\`${prefix}\``, inline: true },
            { name: "🎭 Default Giveaway Role", value: defaultRoleMention, inline: true },
            { name: "📌 Allowed Channels", value: allowedChannelsText, inline: false },
            { name: "📌 Miniboss Channel", value: minibossChannelMention, inline: true },
            { name: "🔐 Allowed Roles", value: allowedRolesText, inline: false },
            { name: "👑 Miniboss Roles", value: minibossRolesText, inline: false },
            { name: "📣 Giveaway Ping Roles", value: roleMappingsText, inline: false },
            { name: "🎟️ Extra Entry Roles", value: extraEntriesText, inline: false },
            { name: "🚫 Blacklisted Roles", value: blacklistedRolesText, inline: false }
        )
        .setFooter({ text: "Only server admins can modify these settings." });

    await message.reply({ embeds: [embed] });

  } catch (error) {
    console.error("❌ Error fetching guild configuration:", error);
    return message.reply("❌ **Failed to retrieve guild configuration.** Please try again.");
  }
}