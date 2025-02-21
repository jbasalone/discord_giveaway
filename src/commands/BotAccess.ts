import { Message, PermissionsBitField } from 'discord.js';
import { BotAccess } from '../models/BotAccess';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to use this command.");
    }

    if (!args[0] || !["add", "remove"].includes(args[0].toLowerCase())) {
        return message.reply("❌ Usage: `!ga setbotaccess add/remove <guildId>`");
    }

    const action = args[0].toLowerCase();
    const guildId = args[1];

    if (!guildId || isNaN(Number(guildId))) {
        return message.reply("❌ Please provide a **valid Guild ID**.");
    }

    if (action === "add") {
        await BotAccess.create({ guildId });
        return message.reply(`✅ **Guild ${guildId}** has been **authorized** to use the bot.`);
    }

    if (action === "remove") {
        await BotAccess.destroy({ where: { guildId } });
        return message.reply(`✅ **Guild ${guildId}** has been **removed** from the bot's access list.`);
    }
}