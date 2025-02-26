import {
    Message,
    EmbedBuilder,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { UserProfile } from '../models/UserProfile';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { numberToPrettyERPGNumber } from '../utils/formatNumbers';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";
import { MinibossRoles } from "../models/MinibossRoles";
import { convertToMilliseconds } from "../utils/convertTime";
import { GuildSettings } from "../models/GuildSettings";

async function getUserMinibossStats(userId: string): Promise<{ userLevel: number, ttLevel: number } | null> {
    try {
        const user = await UserProfile.findOne({ where: { userId } });
        return user ? { userLevel: user.get("userLevel") ?? 100, ttLevel: user.get("ttLevel") ?? 100 } : null;
    } catch (error) {
        console.error(`❌ Error retrieving stats for user ${userId}:`, error);
        return null;
    }
}

function calculateCoinWinnings(userLevel: number, ttLevel: number) {
    const min = Math.floor(0.4 * 125 * userLevel * userLevel);
    const max = Math.floor(125 * userLevel * userLevel);
    return { min, max };
}

function calculateMinimumTTLevel(maxCoins: number): number {
    let minTT = 1;
    while (true) {
        const bankCap = 500_000_000 * Math.pow(minTT, 4) + 100_000 * Math.pow(1, 2);
        if (bankCap >= maxCoins) {
            return minTT;
        }
        minTT++;
    }
}

/**
 * Parses user input arguments to extract options.
 */
function parseCommandArgs(rawArgs: string[]): any {
    const args = {
        prize: rawArgs[0] || "Mystery Prize",
        duration: rawArgs[1] || "1h",
        options: [] as string[],
        fields: {} as any,
    };

    for (let i = 2; i < rawArgs.length; i++) {
        if (rawArgs[i].startsWith("--")) {
            args.options.push(rawArgs[i]);
        } else if (rawArgs[i].startsWith("-")) {
            args.fields[rawArgs[i].substring(1)] = rawArgs[i + 1] || true;
        }
    }
    return args;
}

/**
 * Executes the miniboss giveaway command.
 */


export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    const channel = message.channel as TextChannel; // ✅ Move this before `roleId` is used

    let guildId = message.guild.id;

    const allowedRoles = await MinibossRoles.findAll({ where: { guildId } });
    const allowedRoleIds = allowedRoles.map(role => role.get('roleId')).filter(Boolean);

    if (!allowedRoleIds.length) console.warn("⚠️ No Miniboss roles found in DB for this guild.");
    if (!message.member?.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
        return message.reply("❌ You **do not have permission** to start Miniboss Giveaways.");
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });
    if (!allowedChannel) return message.reply("❌ Giveaways can only be started in **approved channels**.");

    console.log("🔍 [DEBUG] Raw Args:", rawArgs);

    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let templateId: number | null = null;

// Check if the first argument is a valid number (template ID)
    if (!isNaN(Number(rawArgs[0]))) {
        templateId = parseInt(rawArgs.shift()!, 10);
    }

    let savedGiveaway: SavedGiveaway | null = templateId !== null
        ? await SavedGiveaway.findOne({ where: { id: templateId } })
        : null;

    // ✅ Extract all values in one step
    const args = parseCommandArgs(rawArgs);
    let forceStart: boolean = args.options.includes("--force");

// Ensure `savedGiveaway` is valid before accessing properties
    let title: string = "Miniboss Giveaway";
    let durationMs: number;
    let winnerCount: number = 1;

    // ✅ Extract Extra Fields Correctly (Handles Spaces & Multiple Words)
    // ✅ Extract Extra Fields Correctly
    let extraFields: Record<string, string> = savedGiveaway
        ? JSON.parse(savedGiveaway.get("extraFields") || "{}")
        : {};

// ✅ Parse `--field` values from rawArgs
    while (true) {
        const keyFlagIndex = rawArgs.indexOf("--field");
        if (keyFlagIndex !== -1 && keyFlagIndex + 1 < rawArgs.length) {
            rawArgs.splice(keyFlagIndex, 1); // Remove `--field`
            let keyValuePair = rawArgs.splice(keyFlagIndex, 1)[0]; // Capture the full field entry

            // ✅ Handle cases where spaces split values
            while (rawArgs.length > 0 && !rawArgs[0].startsWith("--")) {
                keyValuePair += " " + rawArgs.shift();
            }

            // ✅ Ensure proper key-value parsing
            const splitIndex = keyValuePair.indexOf(":");
            if (splitIndex !== -1) {
                let key = keyValuePair.substring(0, splitIndex).trim();
                let value = keyValuePair.substring(splitIndex + 1).trim();

                key = key.replace(/^"+|"+$/g, "");  // Remove surrounding quotes
                value = value.replace(/^"+|"+$/g, "").replace(/\\n/g, "\n");  // Normalize newlines

                if (key && value) {
                    extraFields[key] = value;
                }
            }
        } else {
            break;
        }
    }
    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Extracted Extra Fields:`, extraFields);

    let guaranteedWinners: string[] = [];
    const winnersIndex = rawArgs.indexOf("--winners");
    if (winnersIndex !== -1 && winnersIndex + 1 < rawArgs.length) {
        let i = winnersIndex + 1;
        while (i < rawArgs.length && !rawArgs[i].startsWith("--")) {
            let winnerId = rawArgs[i].trim();
            if (winnerId.startsWith("<@") && winnerId.endsWith(">")) {
                guaranteedWinners.push(winnerId.replace(/<@|>/g, "")); // Strip `<@>` for consistent formatting
            }
            i++;
        }
        rawArgs.splice(winnersIndex, guaranteedWinners.length + 1);
    }
    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Extracted Guaranteed Winners:`, guaranteedWinners);


    let roleId: string | null = null;

    if (savedGiveaway) {
        title = savedGiveaway.get("title") ?? "Miniboss Giveaway";
        durationMs = Number(savedGiveaway.get("duration"));

        console.log(`✅ [DEBUG] [minibossGiveaway] FINAL duration used for giveaway (no conversion): ${durationMs} ms`);

        winnerCount = Number(savedGiveaway.get("winnerCount")) || 1;
        forceStart = Boolean(savedGiveaway.get("forceStart")) || args.options.includes("--force");
    } else {
        if (rawArgs.length > 0) {
            let durationArg = rawArgs.shift();
            durationMs = durationArg ? convertToMilliseconds(durationArg) : 60000; // ✅ Convert manual input
        } else {
            durationMs = 60000; // ✅ Default to 1 minute
        }

        console.log(`✅ [DEBUG] [minibossGiveaway] Final Parsed Duration (ms): ${durationMs}`);

        if (rawArgs.length > 0) winnerCount = parseInt(rawArgs.shift()!, 10) || 1;
    }

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let roleArgIndex = args.options.findIndex((arg: string) => arg.toLowerCase() === "--role");
    if (roleArgIndex !== -1 && roleArgIndex + 1 < args.options.length) {
        roleId = args.options[roleArgIndex + 1];
        args.options.splice(roleArgIndex, 2);
    }

// If using a saved giveaway, check if a role is stored
    if (!roleId && savedGiveaway) {
        const storedRoleId = savedGiveaway.get("requiredRole");
        roleId = typeof storedRoleId === "string" ? storedRoleId : null;
    }

// If a role exists, send a mention message
    if (roleId) {
        await channel.send(`<@&${roleId}> **MB Giveaway**`);
    }


    // ✅ Parse extra fields properly
    if (savedGiveaway) {
        try {
            extraFields = savedGiveaway.get("extraFields") ? JSON.parse(savedGiveaway.get("extraFields") || "{}") : {};
            const guaranteedWinnersRaw = savedGiveaway.get("guaranteedWinners");
            guaranteedWinners = typeof guaranteedWinnersRaw === "string" ? JSON.parse(guaranteedWinnersRaw) : [];
        } catch (error) {
            console.warn("⚠️ Error parsing extra fields:", error);
        }
    }

    // ✅ **Parse Additional Arguments** (ONLY user inputs should be converted)
    if (rawArgs.length > 0) title = rawArgs.shift()!;
    if (rawArgs.length > 0) {
        let durationArg = rawArgs.shift();
        durationMs = durationArg ? convertToMilliseconds(durationArg) : 60000;
        if (isNaN(durationMs) || durationMs <= 0) {
            console.warn(`⚠️ [DEBUG] Invalid duration detected! Defaulting to 1 minute.`);
            durationMs = 60000; // Default 1 minute
        }
    } else {
        durationMs = 60000; // ✅ Default to 1 minute
    }

    console.log(`✅ [DEBUG] [minibossGiveaway] Final Parsed Duration (ms): ${durationMs}`);
    if (rawArgs.length > 0) winnerCount = parseInt(rawArgs.shift()!, 10);

    while (rawArgs.length > 0) {
        const keyFlagIndex = rawArgs.indexOf("--field");
        if (keyFlagIndex !== -1 && keyFlagIndex + 1 < rawArgs.length) {
            rawArgs.splice(keyFlagIndex, 1); // Remove `--field`
            const rawField = rawArgs.splice(keyFlagIndex, 1)[0];
            if (rawField) {
                let [key, ...valueParts] = rawField.split(":");
                let value = valueParts.join(":").trim();
                key = key.replace(/^"+|"+$/g, "").trim();
                value = value.replace(/^"+|"+$/g, "").replace(/\\n/g, "\n").trim();
                if (key && value) {
                    extraFields[key] = value;
                }
            }
        } else {
            break;
        }
    }

    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const endsAt = currentTime + Math.ceil(durationMs / 1000); // Ensure proper rounding
    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Calculated endsAt: ${endsAt} (Current: ${currentTime}, Duration: ${durationMs} ms)`);
    const hostId = message.author.id;

    // ✅ **Fetch Host's Stats**
    const hostStats = await getUserMinibossStats(hostId);
    if (!hostStats) return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");

    const { userLevel, ttLevel } = hostStats;
    const { min, max } = calculateCoinWinnings(userLevel, ttLevel);
    const minRequiredTT = calculateMinimumTTLevel(max);


    // ✅ Resolve Role ID for Ping (From `--role` argument or mappings)
    const roleIndex = rawArgs.indexOf("--role");
    if (roleIndex !== -1 && roleIndex + 1 < rawArgs.length) {
        const extractedRole = rawArgs.splice(roleIndex, 2)[1];
        if (typeof extractedRole === "string") {
            roleId = extractedRole;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`🎊 **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
        .setColor("DarkRed")
        .setFields([
            { name: "💰 Expected Coins", value: `${numberToPrettyERPGNumber(min)} - ${numberToPrettyERPGNumber(max)}`, inline: true },
            { name: "🌌 Min Required TT Level", value: `${minRequiredTT}`, inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "🏆 Guaranteed Winners", value: guaranteedWinners.length > 0 ? guaranteedWinners.map(id => `<@${id}>`).join(", ") : "None", inline: true }
        ]);

// ✅ Ensure `--fields` Are Added to Embed
    for (const [key, value] of Object.entries(extraFields)) {
        embed.addFields({ name: key, value: value, inline: true });
    }

    if (roleId) {
        await channel.send(`<${roleId}> **MB Giveaway** - Level ${userLevel}`);
    }

    let giveawayMessage = await channel.send({ embeds: [embed] });

    // ✅ **Add Buttons**
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ embeds: [embed], components: [row] });

    // ✅ **Save Giveaway to DB and Retrieve ID**
    const createdGiveaway = await Giveaway.create({
        guildId: message.guild.id,
        host: hostId,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        title,
        description: embed.data.description ?? "",
        type: "miniboss",
        duration: durationMs,
        endsAt,
        participants: JSON.stringify([]),
        winnerCount,
        extraFields: JSON.stringify(extraFields),
        guaranteedWinners: JSON.stringify(guaranteedWinners),
        forceStart: forceStart ? 1 : 0
    });



    // ✅ Retrieve the correct giveaway ID from the database
    const giveawayId = createdGiveaway.id;

    // ✅ **Pass the correct number (giveaway ID) to startLiveCountdown()**
    startLiveCountdown(giveawayId, message.client);
}