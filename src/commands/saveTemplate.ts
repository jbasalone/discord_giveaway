import { Message, Role } from "discord.js";
import { SavedGiveaway } from "../models/SavedGiveaway";
import { convertToMilliseconds } from "../utils/convertTime";
import { GuildSettings } from '../models/GuildSettings';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    const guildId = message.guild?.id;
    const settings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = settings?.get("prefix") || "!";

    if (rawArgs.length < 3) {
        return message.reply(
            `❌ Invalid usage! Example:\n\`\`\`\n${prefix} ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP,Mod --host @User\n\`\`\``
        );
    }

    const args = rawArgs
        .join(" ")
        .match(/(?:[^\s"]+|"[^"]*")+/g)
        ?.map((arg) => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let forceStart = false;
    let winnerCount: number | null = null;
    let giveawayType: "custom" | "miniboss" = "custom";
    let selectedRoles: string[] = [];
    let hostId: string = message.author.id;
    let creatorId: string = message.author.id;
    let imageUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    let useExtraEntries = false;

    // --type flag
    if (args[0] === "--type" && args[1]) {
        const type = args[1].toLowerCase();
        if (type === "custom" || type === "miniboss") {
            giveawayType = type as "custom" | "miniboss";
        }
        args.splice(0, 2);
    } else {
        return message.reply(
            `❌ **Missing --type flag!** Example:\n\`\`\`\n${prefix} ga save --type custom \"My Giveaway\" 30s --field \"Reward: Nitro\"\n\`\`\``
        );
    }

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--force") {
            forceStart = true;
        } else if (args[i] === "--field" && args[i + 1]) {
            let fieldValue = args[i + 1];
            while (i + 2 < args.length && !args[i + 2].startsWith("--")) {
                fieldValue += " " + args[i + 2];
                args.splice(i + 2, 1);
            }
            fieldArgs.push(fieldValue);
            i++;
        } else if (args[i] === "--role" && args[i + 1]) {
            // --- NEW MULTI-ROLE PARSING BLOCK ---
            let roleChunk = args[i + 1]
                .split(/[\s,]+/) // split by comma or whitespace
                .map(r => r.trim())
                .filter(Boolean);

            for (let roleArg of roleChunk) {
                let roleId: string | undefined;
                const roleMatch = roleArg.match(/^<@&(\d+)>$/);
                if (roleMatch) {
                    roleId = roleMatch[1];
                } else if (/^\d{17,20}$/.test(roleArg)) {
                    roleId = roleArg;
                } else {
                    const foundByName = message.guild.roles.cache.find(
                        r => r.name.toLowerCase() === roleArg.toLowerCase()
                    );
                    if (foundByName) roleId = foundByName.id;
                }

                let foundRole: Role | undefined = roleId ? message.guild.roles.cache.get(roleId) : undefined;
                if (!foundRole && roleId) {
                    try {
                        const fetched = await message.guild.roles.fetch(roleId).catch(() => undefined);
                        foundRole = fetched !== null ? fetched : undefined;
                    } catch {}
                }

                if (!foundRole) {
                    return message.reply(`❌ Invalid role: **${roleArg}**. Please use a valid role mention, ID, or role name.`);
                }
                if (!selectedRoles.includes(foundRole.id)) selectedRoles.push(foundRole.id);
            }
            i++;
        } else if (args[i] === "--host" && args[i + 1]) {
            const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : args[i + 1];
            i++;
        } else if (args[i] === "--image" && args[i + 1]) {
            const next = args[i + 1];
            if (next.startsWith("http")) {
                imageUrl = next;
                i++;
            }
        } else if (args[i] === "--thumbnail" && args[i + 1]) {
            const next = args[i + 1];
            if (next.startsWith("http")) {
                thumbnailUrl = next;
                i++;
            }
        } else if (args[i] === "--extraentries") {
            useExtraEntries = true;
        } else {
            mainArgs.push(args[i]);
        }
    }

    // Required params
    if (mainArgs.length < 2) {
        return message.reply(
            `❌ Invalid usage! Example:\n\`\`\`\n${prefix} ga save --type custom \"My Giveaway\" 30s --field \"Reward: 100 Gold\" --role VIP Mod --host @User\n\`\`\``
        );
    }
    const templateName = mainArgs.shift()?.toLowerCase() ?? "";
    const durationArg = mainArgs.shift()!;
    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0 || duration > 31536000 * 1000) {
        return message.reply(
            "❌ Invalid duration. Must be a positive number (max 1 year)."
        );
    }
    // Winner count
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

    // Parse extra fields
    let extraFields: Record<string, string> = {};
    fieldArgs.forEach((field) => {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    });

    // Save the template
    await SavedGiveaway.create({
        guildId: message.guild.id,
        name: templateName,
        title: `🎉 ${templateName}`,
        description: `${giveawayType} giveaway template.`,
        type: giveawayType,
        duration,
        winnerCount,
        forceStart,
        role: selectedRoles.length ? selectedRoles.join(",") : "None",
        host: hostId,
        creator: creatorId,
        extraFields: Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : null,
        imageUrl,
        thumbnailUrl,
        useExtraEntries
    });

    return message.reply(
        `✅ **"${templateName}"** has been saved! \n👤 **Created By:** <@${creatorId}> \n📌 **Type:** ${giveawayType.toUpperCase()} \n⏳ **Duration:** ${durationArg} \n🏆 **Winners:** ${winnerCount} \n🚀 **Force Start:** ${forceStart ? "Enabled" : "Disabled"} \n👤 **Host:** <@${hostId}> \n📢 **Role Ping(s):** ${selectedRoles.length ? selectedRoles.map(id => `<@&${id}>`).join(" ") : "None"} \n📋 **Fields:** ${Object.keys(extraFields).length > 0 ? JSON.stringify(extraFields) : "None"}`
    );
}