import { Message, PermissionsBitField } from "discord.js";
import { SavedGiveaway } from "../models/SavedGiveaway";

export async function execute(message: Message, args: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (args.length < 2) {
        return message.reply(
            "❌ Invalid usage! Example: `!ga edit 2 --name \"New Giveaway\" --title \"Updated Title\" --desc \"New Description\" --role @GiveawayPings --field \"Reward: Nitro\" --winnerCount 5 --duration 2h --force`"
        );
    }

    const templateId = parseInt(args[0], 10);
    if (isNaN(templateId)) {
        return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
    }

    try {
        const template = await SavedGiveaway.findByPk(templateId);
        if (!template) {
            return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
        }

        let updatedFields: Partial<SavedGiveaway> = {};
        let role: string | null = template.get("role");
        let host: string | null = template.get("host");
        let winnerCount: number = template.get("winnerCount") ?? 1;
        let extraFields: Record<string, string> = {};

        try {
            extraFields = template.get("extraFields") ? JSON.parse(template.get("extraFields") as string) : {};
        } catch (error) {
            console.error(`❌ Error parsing extraFields for template ${templateId}:`, error);
        }

        for (let i = 1; i < args.length; i++) {
            if (args[i] === "--name" && args[i + 1]) {
                updatedFields.name = args[i + 1];
                i++;
            } else if (args[i] === "--title" && args[i + 1]) {
                updatedFields.title = args[i + 1];
                i++;
            } else if (args[i] === "--desc" && args[i + 1]) {
                updatedFields.description = args[i + 1];
                i++;
            } else if (args[i] === "--role" && args[i + 1] && message.guild) {
                const roleArg = args[i + 1];
                const roleMatch = roleArg.match(/^<@&(\d+)>$/);
                let roleId: string | undefined;

                if (roleMatch) {
                    roleId = roleMatch[1];
                } else if (/^\d{17,20}$/.test(roleArg)) {
                    roleId = roleArg;
                } else {
                    const foundRoleByName = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
                    if (foundRoleByName) {
                        roleId = foundRoleByName.id;
                    }
                }

                if (!roleId || !message.guild.roles.cache.has(roleId)) {
                    try {
                        const fetchedRole = await message.guild.roles.fetch(roleId!).catch(() => null);
                        if (!fetchedRole) {
                            return message.reply(`❌ Invalid role: **${roleArg}**. Please use a valid role mention, ID, or role name.`);
                        }
                        roleId = fetchedRole.id;
                    } catch (error) {
                        console.error(`❌ Failed to fetch role ${roleId}:`, error);
                        return message.reply(`❌ An error occurred while fetching the role.`);
                    }
                }

                role = roleId;
                i++;
            } else if (args[i] === "--host" && args[i + 1]) {
                const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
                host = mentionMatch ? mentionMatch[1] : args[i + 1];
                i++;
            } else if (args[i] === "--force") {
                updatedFields.forceStart = true;
            } else if (args[i] === "--winnerCount" && args[i + 1] && /^\d+$/.test(args[i + 1])) {
                winnerCount = parseInt(args[i + 1], 10);
                updatedFields.winnerCount = winnerCount;
                i++;
            } else if (/^\d+[smhd]$/.test(args[i])) {
                const durationMatch = args[i].match(/^(\d+)([smhd])$/);
                if (durationMatch) {
                    const value = parseInt(durationMatch[1], 10);
                    const unit = durationMatch[2];
                    let durationMs = value * 1000;
                    if (unit === "m") durationMs *= 60;
                    if (unit === "h") durationMs *= 3600;
                    if (unit === "d") durationMs *= 86400;
                    updatedFields.duration = durationMs;
                }
            }
        }

        // ✅ **Process `--field` Correctly (Prevents Duplicate Fields)**
        for (let i = 1; i < args.length; i++) {
            if (args[i] === "--field" && args[i + 1]) {
                let fieldData = args[i + 1];
                while (i + 2 < args.length && !args[i + 2].startsWith("--")) {
                    fieldData += " " + args[i + 2];
                    args.splice(i + 2, 1);
                }

                // ✅ **Ensure Field Key Matches Correctly**
                fieldData = fieldData.replace(/^"+|"+$/g, ""); // Remove surrounding quotes
                const splitIndex = fieldData.indexOf(":");
                if (splitIndex !== -1) {
                    const key = fieldData.substring(0, splitIndex).trim();
                    const value = fieldData.substring(splitIndex + 1).trim();

                    if (key && value) {
                        extraFields[key] = value; // ✅ **Update instead of duplicating**
                    }
                }
                i++;
            }
        }

        // ✅ Merge new extra fields with existing ones (ensuring no duplicates)
        const mergedExtraFields = {
            ...template.get("extraFields") ? JSON.parse(template.get("extraFields") as string) : {},
            ...extraFields
        };

        // ✅ Update template in database
        await template.update({
            role,
            host,
            winnerCount,
            extraFields: JSON.stringify(mergedExtraFields),
            ...updatedFields,
        });

        return message.reply(
            `✅ Giveaway template **"${updatedFields.name || template.get("name")}"** (ID: ${templateId}) has been updated!\n📌 **Role:** ${role ? `<@&${role}>` : "Not Set"}\n👤 **Host:** <@${host}>\n🏆 **Winner Count:** ${winnerCount}\n📋 **Fields:** ${
                Object.keys(mergedExtraFields).length > 0 ? JSON.stringify(mergedExtraFields, null, 2) : "None"
            }`
        );
    } catch (error) {
        console.error("❌ Error editing saved giveaway:", error);
        return message.reply("❌ Failed to update the saved giveaway. Please check logs.");
    }
}