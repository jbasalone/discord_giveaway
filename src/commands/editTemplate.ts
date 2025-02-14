import { Message, PermissionsBitField } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { execute as startCustomGiveaway } from '../commands/customGiveaway';
import { execute as startMinibossGiveaway } from '../commands/minibossGiveaway';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply("❌ You need `Manage Messages` permission to start a saved giveaway.");
    }

    if (args.length < 1) {
        return message.reply("❌ You must specify a template **ID number**.");
    }

    const templateId = parseInt(args[0], 10);
    if (isNaN(templateId)) {
        return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
    }

    try {
        // ✅ Fetch saved giveaway template by ID
        const template = await SavedGiveaway.findByPk(templateId);

        if (!template) {
            return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
        }

        // ✅ Extract key values from template
        const giveawayName = template.get("name") as string;
        const duration = template.get("duration");
        const winnerCount = template.get("winnerCount");
        const forceStart = template.get("forceStart") ?? false;
        const giveawayType = template.get("type") ?? "custom"; // Defaults to "custom"
        const isMiniboss = giveawayType === "miniboss";

        // ✅ Ensure `extraFields` is always an object
        let extraFields: Record<string, string> = {};
        try {
            extraFields = template.get("extraFields") ? JSON.parse(template.get("extraFields") as string) : {};
        } catch (error) {
            console.error(`❌ Error parsing extraFields for ${giveawayName}:`, error);
        }

        // ✅ Construct argument array correctly
        const argsToPass = [
            `"${giveawayName}"`, // Properly format title
            `${duration}`, // Giveaway Duration
            ...(isMiniboss ? (forceStart ? ["--force"] : []) : [`${winnerCount}`]), // Force or Winner Count
            ...Object.entries(extraFields).flatMap(([key, value]) => ["--field", `"${key}: ${value}"`]) // Proper field formatting
        ];

        // ✅ Determine correct giveaway function to execute
        if (isMiniboss) {
            console.log(`🚀 Starting Miniboss Giveaway: ${giveawayName}`);
            await startMinibossGiveaway(message, argsToPass);
        } else {
            console.log(`🚀 Starting Custom Giveaway: ${giveawayName}`);
            await startCustomGiveaway(message, argsToPass);
        }

        return message.reply(`✅ Giveaway **"${giveawayName}"** (ID: ${templateId}) has started!`);

    } catch (error) {
        console.error("❌ Error starting giveaway from template:", error);
        return message.reply("❌ Failed to start the saved giveaway. Please check logs.");
    }
}