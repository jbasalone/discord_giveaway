import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";

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

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let allowedRoles: string[] = [];
    try {
        allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
        allowedRoles = [];
    }

    if (allowedRoles.length > 0 && !message.member?.roles.cache.some(role => allowedRoles.includes(role.id))) {
        return message.reply("❌ You do not have permission to start giveaways.");
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });

    if (!allowedChannel) {
        return message.reply("❌ Giveaways can only be started in **approved channels**. Ask an admin to configure this.");
    }

    console.log("🔍 [DEBUG] Raw Args:", rawArgs);

    // **Sanitize all incoming arguments**
    rawArgs = rawArgs.map(sanitizeArg);

    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;

    // ✅ **Extract Title Properly**
    let title = "";
    if (rawArgs.length >= 3) {
        if (rawArgs[0].startsWith('"')) {
            // ✅ Extract title from quoted string
            const quoteEndIndex = rawArgs.findIndex(arg => arg.endsWith('"'));
            if (quoteEndIndex !== -1) {
                title = rawArgs.splice(0, quoteEndIndex + 1).join(" ").replace(/^"|"$/g, "").trim();
            } else {
                title = rawArgs.shift() ?? "🎉 Giveaway Event!";
            }
        } else {
            // ✅ If no quotes, assume all words before duration are part of the title
            while (rawArgs.length > 2 && !rawArgs[0].match(/^\d+(s|m|h|d)$/)) {
                title += (title ? " " : "") + rawArgs.shift();
            }
            title = title.trim() || "🎉 Giveaway Event!";
        }
    } else {
        // ✅ Default title if no title is given
        title = "🎉 Giveaway Event!";
    }

// ✅ Extract Duration & Winner Count
    const durationStr = sanitizeArg(rawArgs.shift());
    const winnerCountStr = sanitizeArg(rawArgs.shift());

// ✅ Ensure required values are provided
    if (!durationStr || !winnerCountStr) {
        return message.reply("❌ Invalid format! Example: `!ga create \"Super Giveaway\" 30s 1` or `!ga create 30s 1`.");
    }

// ✅ Convert & Validate Duration
    let durationMs = convertToMilliseconds(durationStr);
    if (isNaN(durationMs) || durationMs <= 0) {
        console.warn(`⚠️ [DEBUG] Invalid duration (${durationMs}) detected! Defaulting to 60s.`);
        durationMs = 60000;
    }

// ✅ Convert & Validate Winner Count
    let winnerCount = parseInt(winnerCountStr, 10);
    if (isNaN(winnerCount) || winnerCount <= 0) {
        console.warn(`⚠️ [DEBUG] Invalid winner count (${winnerCount}) detected! Defaulting to 1.`);
        winnerCount = 1;
    }

    console.log(`🎯 [DEBUG] Processed Values -> Title: ${title}, Duration: ${durationMs}ms, WinnerCount: ${winnerCount}`);

    while (rawArgs.length > 0) {
        const arg = sanitizeArg(rawArgs.shift());

        if (arg === "--role" && rawArgs.length > 0) {
            roleId = sanitizeArg(rawArgs.shift());

        } else if (arg === "--host" && rawArgs.length > 0) {
            const mentionMatch = rawArgs[0]?.match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : sanitizeArg(rawArgs.shift());
        } else if (arg === "--field" && rawArgs.length > 0) {
            let fieldData = sanitizeArg(rawArgs.shift());
            if (fieldData.includes(":")) {
                let [key, ...valueParts] = fieldData.split(":");
                key = sanitizeArg(key);
                let value = sanitizeArg(valueParts.join(":"));
                extraFields[key] = value;
            }
        } else if (arg === "--extraentries") {
            useExtraEntries = true;
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const channel = message.channel as TextChannel;

    let roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    let resolvedRoleId = roleId && roleMappings[roleId] ? roleMappings[roleId] : null;
    let rolePing = resolvedRoleId ? `<@&${resolvedRoleId}>` : "";

    // ✅ **Create Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🚀 **${title}** `)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
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

    // ✅ **Send Giveaway Message**
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
        host: hostId,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        title,
        description: `**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`,
        type: "custom",
        duration: durationMs,
        endsAt,
        participants: JSON.stringify([]),
        winnerCount,
        extraFields: JSON.stringify(extraFields),
        forceStart: false,
        useExtraEntries
    });

    startLiveCountdown(giveawayData.id, message.client);

}