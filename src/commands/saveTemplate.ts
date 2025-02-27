import { Message, Role } from "discord.js";
import { SavedGiveaway } from "../models/SavedGiveaway";
import { convertToMilliseconds } from "../utils/convertTime";

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    if (rawArgs.length < 3) {
        return message.reply(
            "❌ Invalid usage! Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP --host @User`"
        );
    }

    // ✅ **Improved Argument Parsing (Handles Quotes & Flags Properly)**
    const args =
        rawArgs
            .join(" ")
            .match(/(?:[^\s"]+|"[^"]*")+/g)
            ?.map((arg) => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let forceStart = false;
    let winnerCount: number | null = null;
    let giveawayType: "custom" | "miniboss" = "custom"; // ✅ Default to `custom`
    let selectedRole: string | null = null;
    let hostId: string = message.author.id; // ✅ Default host is the user saving the template
    let creatorId: string = message.author.id; // ✅ Track who created the template

    // ✅ **Ensure `--type` is properly processed**
    if (args[0] === "--type" && args[1]) {
        const type = args[1].toLowerCase();
        if (type === "custom" || type === "miniboss") {
            giveawayType = type as "custom" | "miniboss";
        }
        args.splice(0, 2); // Remove `--type custom` from args
    } else {
        return message.reply(
            "❌ **Missing `--type` flag!** Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: Nitro\"`"
        );
    }

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--force") {
            forceStart = true;
        } else if (args[i] === "--field" && args[i + 1]) {
            // ✅ Preserve entire field (handles quotes properly)
            let fieldValue = args[i + 1];
            while (i + 2 < args.length && !args[i + 2].startsWith("--")) {
                fieldValue += " " + args[i + 2];
                args.splice(i + 2, 1); // Remove merged elements
            }
            fieldArgs.push(fieldValue);
            i++;
        } else if (args[i] === "--role" && args[i + 1]) {
            let roleArg = args[i + 1].trim();
            let roleId: string | undefined;

            // ✅ Check if role is a mention format <@&ROLE_ID>
            const roleMatch = roleArg.match(/^<@&(\d+)>$/);
            if (roleMatch) {
                roleId = roleMatch[1]; // Extract Role ID from mention
            } else if (/^\d{17,20}$/.test(roleArg)) {
                roleId = roleArg; // Direct Role ID input (17-20 digit number)
            } else {
                // ✅ Try to find role by **name** (case insensitive)
                const foundRoleByName = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
                if (foundRoleByName) {
                    roleId = foundRoleByName.id;
                }
            }

            // ✅ Validate Role Exists in Cache
            let foundRole: Role | undefined = roleId ? message.guild.roles.cache.get(roleId) : undefined;

            // ✅ Fetch Role from API if Not Found in Cache
            if (!foundRole && roleId) {
                try {
                    const fetchedRole = await message.guild.roles.fetch(roleId).catch(() => undefined); // ✅ FIXED!
                    foundRole = fetchedRole !== null ? fetchedRole : undefined; // ✅ Explicitly convert `null` to `undefined`
                } catch (error) {
                    console.error(`❌ Error fetching role ${roleId}:`, error);
                }
            }

            // ❌ If still not found, show error and prevent invalid role assignment
            if (!foundRole) {
                return message.reply(`❌ Invalid role: **${roleArg}**. Please use a valid role mention, ID, or role name.`);
            }

            selectedRole = foundRole.id; // ✅ Store the validated role ID
            i++;
        } else if (args[i] === "--host" && args[i + 1]) {
            // ✅ Extract Host User ID (if mentioned)
            const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : args[i + 1];
            i++;
        } else {
            mainArgs.push(args[i]);
        }
    }

    // ✅ **Extract Required Parameters**
    if (mainArgs.length < 2) {
        return message.reply(
            "❌ Invalid usage! Example: `!ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP --host @User`."
        );
    }

    const templateName = mainArgs.shift()?.toLowerCase() ?? "";
    const durationArg = mainArgs.shift()!;

    // ✅ Convert duration to milliseconds
    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0 || duration > 31536000 * 1000) {
        return message.reply(
            "❌ Invalid duration. Must be a positive number (max 1 year)."
        );
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

    // ✅ **Parse `--field` Values (Handles Multi-Colon Fields)**
    let extraFields: Record<string, string> = {};
    fieldArgs.forEach((field) => {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    });

    // ✅ **Ensure Role is Set**
    if (!selectedRole) {
        selectedRole = "None";
    }

    // ✅ **Save Giveaway Template**
    // ✅ Save Giveaway Template
    await SavedGiveaway.create({
        guildId: message.guild.id,
        name: templateName,  // ✅ Properly use the name without including the creator
        title: `🎉 ${templateName}`,
        description: `${giveawayType} giveaway template.`,
        type: giveawayType,
        duration,
        winnerCount,
        forceStart,
        role: selectedRole,
        host: hostId,
        creator: creatorId,  // ✅ Track who created the template
        extraFields: Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null,
    });

// ✅ Format the Response Message (Embed-like structure)
    return message.reply(
        `✅ **"${templateName}"** has been saved! \n👤 **Created By:** <@${creatorId}> \n📌 **Type:** ${giveawayType.toUpperCase()} \n⏳ **Duration:** ${durationArg} \n🏆 **Winners:** ${winnerCount} \n🚀 **Force Start:** ${forceStart ? "Enabled" : "Disabled"} \n👤 **Host:** <@${hostId}> \n📢 **Role Ping:** ${selectedRole ?? "None"} \n📋 **Fields:** ${Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : "None"}`
    );
}