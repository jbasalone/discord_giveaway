import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { convertToMilliseconds } from '../utils/convertTime';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (rawArgs.length < 3) {
        return message.reply("❌ Invalid usage! Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP --host @User`");
    }

    // ✅ **Fix Argument Parsing (Supports Quotes and Proper Flag Detection)**
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let forceStart = false;
    let winnerCount: number | null = null;
    let giveawayType: "custom" | "miniboss" = "custom"; // ✅ Default to `custom`
    let selectedRole: string | null = null;
    let hostId: string = message.author.id; // ✅ Default host is the user saving the template

    // ✅ **Ensure `--type` comes right after `ga save`**
    if (args[0] === "--type" && args[1]) {
        const type = args[1].toLowerCase();
        if (type === "custom" || type === "miniboss") {
            giveawayType = type as "custom" | "miniboss";
        }
        args.splice(0, 2); // Remove `--type custom` from args
    } else {
        return message.reply("❌ **Missing `--type` flag!** Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: Nitro\"`");
    }

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--force") {
            forceStart = true;
        } else if (args[i] === "--field" && args[i + 1]) {
            fieldArgs.push(args[i + 1]);
            i++;
        } else if (args[i] === "--role" && args[i + 1]) {
            selectedRole = args[i + 1];
            i++;
        } else if (args[i] === "--host" && args[i + 1]) {
            const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : args[i + 1];
            i++;
        } else {
            mainArgs.push(args[i]);
        }
    }

    // ✅ **Extract Required Parameters**
    if (mainArgs.length < 2) {
        return message.reply("❌ Invalid usage! Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP --host @User`.");
    }

    const templateName = mainArgs.shift()?.toLowerCase() ?? "";
    const durationArg = mainArgs.shift()!;

    // ✅ Convert duration to milliseconds
    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0 || duration > 31536000 * 1000) {
        return message.reply("❌ Invalid duration. Must be a positive number (max 1 year).");
    }

    // ✅ Auto-Assign Winner Count Based on Type
    if (mainArgs.length > 0) {
        const parsedWinnerCount = Number(mainArgs[0]);
        if (!isNaN(parsedWinnerCount) && Number.isInteger(parsedWinnerCount) && parsedWinnerCount > 0) {
            winnerCount = parsedWinnerCount;
            mainArgs.shift();
        }
    }

    if (winnerCount === null) {
        winnerCount = giveawayType === "miniboss" ? (forceStart ? 9 : 0) : 1;
    }

    // ✅ Parse `--field` Values (Handles Multi-Colon Fields)
    let extraFields: Record<string, string> = {};
    fieldArgs.forEach(field => {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    });

    // ✅ Save Giveaway Template
    await SavedGiveaway.create({
        guildId: message.guild.id,
        name: templateName,
        title: `🎉 ${templateName}`,
        description: `${giveawayType} giveaway template.`,
        type: giveawayType,
        duration,
        winnerCount,
        forceStart,
        role: selectedRole,
        host: hostId,
        extraFields: Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null
    });

    return message.reply(
        `✅ **"${templateName}"** saved! \n📌 **Type:** ${giveawayType.toUpperCase()} \n⏳ **Duration:** ${durationArg} \n🏆 **Winners:** ${winnerCount} \n🚀 **Force Start:** ${forceStart ? "Enabled" : "Disabled"} \n👤 **Host:** <@${hostId}> \n📢 **Role Ping:** ${selectedRole ?? "None"} \n📋 **Fields:** ${Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : "None"}`
    );
}