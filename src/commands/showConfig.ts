import { Message, EmbedBuilder, PermissionsBitField, Colors } from 'discord.js';
import { getGuildPrefix } from '../utils/getGuildPrefix';
import { GuildSettings } from '../models/GuildSettings';
import { ExtraEntries } from '../models/ExtraEntries';
import { BlacklistedRoles } from '../models/BlacklistedRoles';
import { AllowedGiveawayChannels } from '../models/AllowedGiveawayChannels';
import { MinibossRoles } from '../models/MinibossRoles';
import { SecretGiveawaySettings } from '../models/SecretGiveaway';

export async function execute(message: Message, guildId?: string) {
  if (!message.guild) {
    return message.reply("❌ This command must be used inside a server.");
  }

  const guildIdResolved = guildId || message.guild.id;
  const settings = await GuildSettings.findOne({ where: { guildId: guildIdResolved } });

  if (!settings) {
    return message.reply("❌ No settings found for this server.");
  }

  const allowedRolesRaw = settings.get("allowedRoles") ?? "[]";
  let allowedRoles: string[];

  try {
    allowedRoles = JSON.parse(allowedRolesRaw);
  } catch {
    allowedRoles = [];
  }

  const hasAccess = message.member?.roles.cache.some(role => allowedRoles.includes(role.id));

  if (!hasAccess) {
    return message.reply("❌ You do not have permission to view this configuration.");
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
        ? minibossRoles.map(entry => `<@&${entry.get("roleId")}>`).join(", ")
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

    // ✅ **Fetch Secret Giveaway Settings**
    const secretGiveawaySettings = await SecretGiveawaySettings.findOne({ where: { guildId } });

    const secretGiveawaysEnabled = secretGiveawaySettings?.get("enabled") ? "✅ Enabled" : "❌ Disabled";
    let secretGiveawayChannelsText = "❌ No channels set.";

    if (secretGiveawaySettings) {
      const secretCategoryIds: string[] = JSON.parse(secretGiveawaySettings.get("categoryIds") ?? "[]");
      if (secretCategoryIds.length > 0) {
        secretGiveawayChannelsText = secretCategoryIds.map(id => `<#${id}>`).join(", ");
      }
    }

    // ✅ **Fetch Miniboss TT Level Roles**
    let minibossTTRoles: Record<string, string> = {};
    try {
      minibossTTRoles = JSON.parse(guildSettings.get("ttLevelRoles") ?? "{}");
    } catch {
      minibossTTRoles = {};
    }

    const minibossTTRolesText = Object.keys(minibossTTRoles).length > 0
        ? Object.entries(minibossTTRoles).map(([ttLevel, roleId]) => `**${ttLevel}**: <@&${roleId}>`).join("\n")
        : "❌ No Miniboss TT Level roles set.";

    // ✅ **Create Compact Embed**
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
            { name: "⚔️ Miniboss TT Level Roles", value: minibossTTRolesText, inline: false }, // ✅ Added this field
            { name: "📣 Giveaway Ping Roles", value: roleMappingsText, inline: false },
            { name: "🎟️ Extra Entry Roles", value: extraEntriesText, inline: false },
            { name: "🚫 Blacklisted Roles", value: blacklistedRolesText, inline: false },
            { name: "🕵️ Secret Giveaways", value: secretGiveawaysEnabled, inline: true },
            { name: "📂 Secret Giveaway Channels", value: secretGiveawayChannelsText, inline: false }
        )
        .setFooter({ text: "Only server admins can modify these settings." });

    await message.reply({ embeds: [embed] });

  } catch (error) {
    console.error("❌ Error fetching guild configuration:", error);
    return message.reply("❌ **Failed to retrieve guild configuration.** Please try again.");
  }
}