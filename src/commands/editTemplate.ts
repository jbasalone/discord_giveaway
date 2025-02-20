import { Message, PermissionsBitField } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply("❌ You need `Manage Messages` permission to edit a saved giveaway.");
    }

    if (args.length < 2) {
        return message.reply("❌ Invalid usage! Example: `!ga edit 2 --role @GiveawayPings --field \"Reward: Nitro\"`");
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

        // ✅ Extract existing template data
        let updatedFields: Partial<SavedGiveaway> = {};
        let roleValue = template.get("role");
        let role: string | null = typeof roleValue === "string" ? roleValue : null;
        let extraFields: Record<string, string> = {};
        try {
            extraFields = template.get("extraFields") ? JSON.parse(template.get("extraFields") as string) : {};
        } catch (error) {
            console.error(`❌ Error parsing extraFields for template ${templateId}:`, error);
        }

        // ✅ **Process Arguments & Detect Changes**
        for (let i = 1; i < args.length; i++) {
            if (args[i] === "--role" && args[i + 1]) {
                role = args[i + 1].match(/^<@&(\d+)>$/)?.[1] || args[i + 1]; // Extract role ID
                i++;
            } else if (args[i] === "--field" && args[i + 1]) {
                const fieldData = args[i + 1].split(":").map(str => str.trim());
                if (fieldData.length === 2) {
                    extraFields[fieldData[0]] = fieldData[1];
                }
                i++;
            } else if (args[i] === "--force") {
                updatedFields.forceStart = true;
            } else if (/^\d+[smhd]$/.test(args[i])) {
                updatedFields.duration = parseInt(args[i], 10) * 1000;
            } else if (/^\d+$/.test(args[i])) {
                updatedFields.winnerCount = parseInt(args[i], 10);
            }
        }

        // ✅ Update template in database
        await template.update({
            role,
            extraFields: JSON.stringify(extraFields),
            ...updatedFields
        });

        return message.reply(`✅ Giveaway template **"${template.get("name")}"** (ID: ${templateId}) has been updated!\n📌 **Role:** ${role ? `<@&${role}>` : "Not Set"}\n📋 **Fields:** ${Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields, null, 2) : "None"}`);

    } catch (error) {
        console.error("❌ Error editing saved giveaway:", error);
        return message.reply("❌ Failed to update the saved giveaway. Please check logs.");
    }
}