import { Message } from 'discord.js';
import { UserProfile } from '../models/UserProfile';
import { GuildSettings } from '../models/GuildSettings';


export async function execute(message: Message, args: string[]) {
    const guildId = message.guild?.id;
    const settings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = settings?.get("prefix") || "!";
    if (args.length < 1) {
        return message.reply(`❌ Please provide your level and optionally your TT level. Example:\n\`\`\`\n ${prefix} ga setlevel 10000 50\n\`\`\``);
    }

    const userLevel = parseInt(args[0], 10);
    const ttLevel = args.length > 1 ? parseInt(args[1], 10) : 100; // ✅ Default TT level to 100 if not provided

    if (isNaN(userLevel) || userLevel < 0 || isNaN(ttLevel) || ttLevel < 0) {
        return message.reply("❌ Invalid levels. Please enter positive numbers.");
    }

    await UserProfile.upsert({ userId: message.author.id, userLevel, ttLevel });

    return message.reply(`✅ Your Level has been set to **${userLevel}**, and TT Level to **${ttLevel}**.`);
}