import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message, args: string[]) {
    if (args.length < 3) {
        return message.reply("❌ Invalid usage! Example: `!ga save MyTemplate 30s 1 --fields Reward=100 Gold, Level=10`");
    }

    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    // ✅ Parse & Validate Duration and Winner Count
    const templateName = args[0].toLowerCase(); // ✅ Normalize template name for uniqueness
    const duration = parseInt(args[1], 10);
    const winnerCount = parseInt(args[2], 10);

    if (isNaN(duration) || duration <= 0 || duration > 31536000) { // Max 1 year
        return message.reply("❌ Invalid duration. Must be a positive number (max 1 year).");
    }

    if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 100) { // Prevent excessive winners
        return message.reply("❌ Invalid winner count. Must be between 1 and 100.");
    }

    // ✅ Parse `--fields` from args
    let extraFields: Record<string, string> = {};
    const fieldArgsIndex = args.indexOf("--fields");
    if (fieldArgsIndex !== -1 && fieldArgsIndex + 1 < args.length) {
        const fieldsString = args.slice(fieldArgsIndex + 1).join(" ");
        fieldsString.split(",").forEach(field => {
            const [key, value] = field.split("=").map((s) => s.trim());
            if (key && value) extraFields[key.toLowerCase()] = value; // ✅ Normalize field keys
        });
    }

    // ✅ Ensure unique template name (case-insensitive)
    const existingTemplate = await SavedGiveaway.findOne({
        where: { name: templateName, guildId: message.guild.id },
    });

    if (existingTemplate) {
        return message.reply(`⚠️ A template named **${templateName}** already exists. Use a different name.`);
    }

    // ✅ Save the giveaway template
    await SavedGiveaway.create({
        guildId: message.guild.id,
        name: templateName,
        title: "🎉 Giveaway Template",
        description: "This is a saved giveaway template.",
        role: null,
        duration,
        winnerCount,
        extraFields: Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null, // ✅ Store fields safely
    });

    return message.reply(`✅ Template **${templateName}** saved successfully! Fields: ${Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : "None"}`);
}