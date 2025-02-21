import { Message, PermissionsBitField } from 'discord.js';
import { BlacklistedRoles } from '../models/BlacklistedRoles';

export async function execute(message: Message, args: string[], guildId: string) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to blacklist roles.");
    }

    const role = message.mentions.roles.first();
    if (!role) {
        return message.reply("❌ Please **mention a valid role** to blacklist.");
    }

    try {
        const existingEntry = await BlacklistedRoles.findOne({ where: { guildId, roleId: role.id } });

        if (existingEntry) {
            await existingEntry.destroy();
            return message.reply(`✅ Removed **${role.name}** from the blacklist.`);
        } else {
            await BlacklistedRoles.create({ guildId, roleId: role.id });
            return message.reply(`✅ Blacklisted **${role.name}** from joining giveaways.`);
        }
    } catch (error) {
        console.error("❌ Error setting blacklisted role:", error);
        return message.reply("❌ **Failed to update blacklist.** Please try again.");
    }
}