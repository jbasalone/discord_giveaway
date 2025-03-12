import { Message, EmbedBuilder } from 'discord.js';
import { MinibossRoles } from '../models/MinibossRoles';

export async function execute (message: Message, guildId: string) {
    try {
        if (!guildId) {
            return message.reply("❌ This command can only be used in a server.");
        }

        console.log("🔍 [DEBUG] Fetching Miniboss allowed roles...");


        // Fetch roles from the database
        const roles = await MinibossRoles.findAll({ where: { guildId } });

        if (!roles || roles.length === 0) {
            return message.reply("❌ No Miniboss allowed roles found for this server.");
        }

        const roleMentions = roles.length > 0
            ? roles
                .map(entry => {
                    const roleId = entry.get("roleId") ?? null;
                    return roleId ? `<@&${roleId}>` : "❌ Unknown Role";
                })
                .join(", ")
            : "❌ No roles assigned to start Miniboss giveaways.";


        // ✅ Embed with role mentions
        const embed = new EmbedBuilder()
            .setTitle("Miniboss Allowed Roles")
            .setDescription(roleMentions)
            .setColor(0x3498db);

        await message.reply({ embeds: [embed] });

        console.log("✅ [DEBUG] Successfully sent Miniboss roles.");
    } catch (error) {
        console.error("❌ Error fetching Miniboss allowed roles:", error);
        return message.reply("❌ An error occurred while fetching Miniboss roles.");
    }
}