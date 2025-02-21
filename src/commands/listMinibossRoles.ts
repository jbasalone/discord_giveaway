import { Message, EmbedBuilder, PermissionsBitField, Colors } from 'discord.js';
import { MinibossRoles } from '../models/MinibossRoles';

export async function execute(message: Message, guildId?: string) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to view allowed Miniboss roles.");
    }

    guildId = guildId || message.guild.id;

    try {
        // ✅ Fetch Allowed Roles for Miniboss Giveaways
        const allowedRoles = await MinibossRoles.findAll({ where: { guildId } });

        const allowedRolesText = allowedRoles.length > 0
            ? allowedRoles.map(entry => `<@&${entry.roleId}>`).join("\n")
            : "❌ No roles are currently allowed to start Miniboss giveaways.";

        // ✅ Create Embed
        const embed = new EmbedBuilder()
            .setTitle(`👑 Miniboss Giveaway Allowed Roles`)
            .setDescription(`These roles are permitted to start **Miniboss Giveaways** in **${message.guild.name}**.`)
            .setColor(Colors.Gold)
            .addFields({ name: "🛡 Allowed Roles", value: allowedRolesText, inline: false })
            .setFooter({ text: "Only server admins can modify these settings." });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error("❌ Error fetching Miniboss allowed roles:", error);
        return message.reply("❌ **Failed to retrieve Miniboss roles.** Please try again.");
    }
}