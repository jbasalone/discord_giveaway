import {
    Message,
    EmbedBuilder,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";
import { client } from '../index';

/**
 * Removes surrounding quotes from a string.
 */
function sanitizeArg(arg: string | undefined): string {
    return arg ? arg.replace(/^"|"$/g, '').trim() : '';
}

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    const guildId = message.guild.id;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });
    const argMatches = rawArgs.join(" ").match(/"([^"]+)"|[^\s]+/g) || [];
    const parsedArgs = argMatches.map(arg => arg.replace(/^"|"$/g, '').trim());
    let remainingArgs = [...parsedArgs];

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let allowedRoles: string[] = [];
    try {
        allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
        allowedRoles = [];
    }

    if (allowedRoles.length > 0 && message.member) {
        const isScheduled = message.author.id === client.user?.id; // Bot started it

        if (!isScheduled && !message.member.roles.cache.some(role => allowedRoles.includes(role.id))) {
            console.log("[ERROR] [CUSTOMGIVEAWAY.ts] ❌ You do not have permission to start giveaways.", [allowedRoles]);
            return message.reply("❌ You do not have permission to start giveaways.");
        }
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });

    if (!allowedChannel) {
        return message.reply("[ERROR] [CUSTOMGIVEAWAY.ts] ❌ Giveaways can only be started in **approved channels**. Ask an admin to configure this.");
    }

    console.log("🔍 [DEBUG][CUSTOMGIVEAWAY.ts] Raw Args:", rawArgs);

    // ✅ **Check if the first argument is a valid template ID**
    let templateId: number | null = null;
    if (!isNaN(parseInt(rawArgs[0], 10))) {
        rawArgs.shift(); // Remove numeric template ID if present
    }
    let savedGiveaway: SavedGiveaway | null = null;
    // ✅ Extract title properly until first valid duration format
    let titleParts: string[] = [];
    let durationIndex = rawArgs.findIndex(arg => /^\d+$/.test(arg) || arg.match(/^\d+(s|m|h|d)$/));

    if (durationIndex === -1) {
        return message.reply("❌ Missing a valid duration. Example: `30m`, `1h`, `2d`.");
    }

// ✅ Title consists of everything before the first valid duration
    titleParts = rawArgs.splice(0, durationIndex);
    let title = titleParts.join(" ").trim();
    if (!title || title.match(/^\d+(s|m|h|d)$/)) {
        return message.reply("❌ Invalid title. Example: `!ga custom \"Super Giveaway\" 30m 1 --field \"Requirement: Level 50+\" --role VIP`.");
    }

    if (title.length === 0) {
        return message.reply("❌ Missing title. Example: `!ga custom \"Super Giveaway\" 30m 1 --field \"Requirement: Level 50+\" --role VIP`.");
    }

// ✅ Extract duration & winner count properly
    let durationStr = rawArgs.shift()!;
    let winnerCountStr = rawArgs.shift()!;
    let winnerCount = parseInt(winnerCountStr, 10);

    if (isNaN(winnerCount) || winnerCount <= 0) {
        console.warn(`⚠️ [DEBUG] Invalid winner count (${winnerCountStr}) detected! Defaulting to 1.`);
        winnerCount = 1;
    }

    let durationMs = 0;

// ✅ If duration is numeric (milliseconds), use it directly
    if (!isNaN(durationMs) && durationMs >= 1000) {
        console.log(`✅ [DEBUG] Numeric duration detected: ${durationMs}ms`);
    }
// ✅ Otherwise, try parsing it as a human-readable format (e.g., "30m")
    if (/^\d+$/.test(durationStr) && Number(durationStr) >= 1000) {
        durationMs = Number(durationStr); // Directly use millisecond values
        console.log(`✅ [DEBUG] Numeric duration detected: ${durationMs}ms`);
    } else if (/^\d+s$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 1000;
    } else if (/^\d+m$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 1000;
    } else if (/^\d+h$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 60 * 1000;
    } else if (/^\d+d$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 24 * 60 * 60 * 1000;
    } else {
        return message.reply(`❌ Invalid duration format: "${durationStr}". Example: \`30m\`, \`1h\`, \`2d\`.`);
    }

    console.log(`📌 [DEBUG] Parsed Duration (ms): ${durationMs}`);

// ✅ Extract additional fields & options
    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;

    while (rawArgs.length > 0) {
        const arg = sanitizeArg(rawArgs.shift());

        if (arg === "--role" && rawArgs.length > 0) {
            let nextArg = sanitizeArg(rawArgs.shift());
            if (!nextArg.match(/^\d+(s|m|h|d)$/)) { // Ensure it's not a duration
                roleId = nextArg;
            }
        } else if (arg === "--host" && rawArgs.length > 0) {
            const mentionMatch = rawArgs[0]?.match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : sanitizeArg(rawArgs.shift());
        } else if (arg === "--field" && rawArgs.length > 0) {
            let fieldData = rawArgs.shift() || "";

            // ✅ Ensure fieldData is defined
            if (!fieldData) {
                return message.reply("❌ Missing value for `--field`. Example: `--field \"Requirement: Level 50+\"`.");
            }

            // ✅ Handle quoted multi-word fields correctly
            if (fieldData.startsWith('"')) {
                while (rawArgs.length > 0 && !rawArgs[0].endsWith('"')) {
                    fieldData += " " + rawArgs.shift();
                }
                if (rawArgs[0]?.endsWith('"')) {
                    fieldData += " " + rawArgs.shift();
                }
                fieldData = fieldData.replace(/^"|"$/g, '').trim();
            }

            // ✅ Ensure fieldData contains a `:`
            if (!fieldData.includes(":")) {
                return message.reply("❌ Invalid field format. Example: `--field \"Requirement: Level 50+\"`.");
            }

            let [key, ...valueParts] = fieldData.split(":");
            extraFields[key.trim()] = valueParts.join(":").trim();
        } else if (arg === "--extraentries") {
            useExtraEntries = true;
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const channel = message.channel as TextChannel;
    let defaultRole = guildSettings.get("defaultGiveawayRoleId") ?? null;
    console.log(`✅ [DEBUG] Final Parsed Values -> Title: "${title}", Duration: "${durationMs}ms", Winner Count: "${winnerCount}"`);


    if (!roleId){
        roleId = defaultRole
    }

    if (roleId) {
        let roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
        roleId = roleMappings[roleId] || roleId; // Resolve role ID from mappings
    }

    let resolvedRoleId = roleId && roleId !== "--field" ? roleId : defaultRole;
    let rolePing = resolvedRoleId ? `<@&${resolvedRoleId}>` : "";
    console.log(`✅ [DEBUG] Role ID: "${roleId}", Role Mention: "${rolePing}"`);

    let hostUser: User | null = null;
    try {
        hostUser = await client.users.fetch(hostId);
    } catch (error) {
        console.error("❌ Failed to fetch host user:", error);
    }

    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    // ✅ **Create Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🚀 **${title}** `)
        .setDescription(`**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`)
        .setColor("Blue")
        .setFields([
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);

    if (useExtraEntries) {
        embed.addFields([{ name: "✨ Extra Entries Enabled", value: "✅ Yes", inline: true }]);
    }

    let giveawayMessage = await channel.send({ content: rolePing, embeds: [embed] });


    // ✅ **Create "Join" and "Leave" Buttons**
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`join-${giveawayMessage.id}`)
            .setLabel("Join 🎉")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`leave-${giveawayMessage.id}`)
            .setLabel("Leave 💨")
            .setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });


    // ✅ **Create Giveaway Entry in Database**
    let giveawayData = await Giveaway.create({
        guildId,
        host: hostUser?.id ?? message.author.id,
        userId: message.author.id,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        title,
        description: `**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`,
        type: "custom",
        duration: durationMs,
        endsAt,
        participants: JSON.stringify([]),
        winnerCount,
        extraFields: JSON.stringify(extraFields),
        forceStart: false,
        status: "approved",
        useExtraEntries
    });

    if (!giveawayMessage.id) {
        console.error(`[ERROR] [customGiveaway.ts] ❌ Failed to send giveaway message. Skipping.`);
        return;
    }

    await Giveaway.update(
        { messageId: giveawayMessage.id },
        { where: { id: giveawayData.id } }
    );

    startLiveCountdown(giveawayData.id, message.client);

    return message.reply(`🎉 **${title}** started! Hosted by ${hostMention}.`);
}

export { execute as startCustomGiveaway };