import { Message, PermissionsBitField } from 'discord.js';
import { MinibossRoles } from '../models/MinibossRoles';

export async function execute(message: Message, args: string[], guildId: string) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to set Miniboss roles.");
    }

    const role = message.mentions.roles.first();
    if (!role) {
        return message.reply("❌ Please **mention a valid role**.");
    }

    const action = args[0]?.toLowerCase();
    if (!["add", "remove"].includes(action)) {
        return message.reply("❌ Usage: `!ga setminibossrole add/remove @role`.");
    }

    if (action === "add") {
        await MinibossRoles.create({ guildId, roleId: role.id });
        return message.reply(`✅ **${role.name}** can now start Miniboss Giveaways.`);
    }

    if (action === "remove") {
        await MinibossRoles.destroy({ where: { guildId, roleId: role.id } });
        return message.reply(`✅ **${role.name}** can **no longer** start Miniboss Giveaways.`);
    }
}