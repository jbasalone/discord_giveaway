import { Message, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ You need `Manage Roles` permission to view the giveaway role settings.");
    }

    const guildId = message.guild.id;

    // ✅ **Fetch GuildSettings for Role Data**
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
        return message.reply("❌ No server settings found. Please configure giveaway roles first.");
    }

    // ✅ **Retrieve Allowed Roles (Who Can Start Giveaways)**
    let allowedRoles: string[] = [];
    try {
        allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
        allowedRoles = [];
    }

    // ✅ **Retrieve Role Mappings (Roles Assigned for Giveaways)**
    let roleMappings: Record<string, string> = {};
    try {
        roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
        roleMappings = {};
    }

    // ✅ **Format Role Data**
    const allowedRolesList = allowedRoles
        .map(roleId => {
            const role = message.guild?.roles.cache.get(roleId);
            return role ? `✅ ${role.name} (\`${role.id}\`)` : `❌ Unknown Role (\`${roleId}\`)`;
        })
        .join("\n") || "❌ No roles set.";

    const roleMappingsList = Object.entries(roleMappings)
        .map(([roleName, roleId]) => {
            const role = message.guild?.roles.cache.get(roleId);
            return role ? `📌 **${roleName}** → ${role.name} (\`${role.id}\`)` : `❌ **${roleName}** → Unknown Role (\`${roleId}\`)`;
        })
        .join("\n") || "❌ No role mappings set.";

    // ✅ **Create and Send Embed**
    const embed = new EmbedBuilder()
        .setTitle("🎭 Giveaway Role Settings")
        .setDescription("Here are the configured roles for giveaways in this server:")
        .setColor("Purple")
        .addFields(
            { name: "🔐 Allowed Roles (Can Start Giveaways)", value: allowedRolesList, inline: false },
            { name: "📢 Giveaway Ping Roles", value: roleMappingsList, inline: false }
        );

    return message.reply({ embeds: [embed] });
}