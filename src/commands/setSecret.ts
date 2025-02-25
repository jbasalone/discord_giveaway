import { Message, PermissionsBitField } from "discord.js";
import { SecretGiveawaySettings } from "../models/SecretGiveaway";

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to configure secret giveaways.");
    }

    const guildId = message.guild?.id;
    if (!guildId) return;

    if (rawArgs.length === 0) {
        return message.reply("❌ Usage: `!ga setsecret on|off <CategoryID|CategoryName> <CategoryID|CategoryName> ...`");
    }

    const toggle = rawArgs.shift()?.toLowerCase();
    if (!["on", "off"].includes(toggle ?? "")) {
        return message.reply("❌ First argument must be `on` or `off`.");
    }

    const enabled = toggle === "on";

    // ✅ Validate category inputs
    const categoryIds: string[] = [];
    rawArgs.forEach(arg => {
        // If it's a direct category ID, store it
        if (/^\d{17,19}$/.test(arg)) {
            categoryIds.push(arg);
        } else {
            // If it's a category name, find its ID
            const categoryChannel = message.guild?.channels.cache.find(
                ch => ch.name.toLowerCase() === arg.toLowerCase() && ch.type === 4
            );
            if (categoryChannel) {
                categoryIds.push(categoryChannel.id);
            }
        }
    });

    if (enabled && categoryIds.length === 0) {
        return message.reply("❌ You must specify at least **one valid category ID or category name** when enabling secret giveaways.");
    }

    // ✅ Store settings in the database
    await SecretGiveawaySettings.upsert({
        guildId,
        enabled,
        categoryIds: JSON.stringify(categoryIds),
    });

    return message.reply(
        `✅ **Secret giveaways have been ${enabled ? "enabled" : "disabled"}**.\n` +
        `📌 **Selected Categories:** ${categoryIds.length > 0 ? categoryIds.map(id => `<#${id}>`).join(", ") : "None"}`
    );
}