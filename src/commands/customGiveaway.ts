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

    // ✅ **Check if the first argument is a valid template ID**
    let templateId: number | null = null;
    let savedGiveaway: SavedGiveaway | null = null;
    let title = "";
    let durationStr = "";
    let winnerCountStr = "";
    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;

    // **Sanitize all incoming arguments**
    rawArgs = rawArgs.map(sanitizeArg);

    if (!isNaN(parseInt(rawArgs[0], 10))) {
        templateId = parseInt(rawArgs.shift()!, 10);
        console.log(`📌 Using Saved Template ID: ${templateId}`);

        savedGiveaway = await SavedGiveaway.findOne({ where: { id: templateId } });

        if (!savedGiveaway) {
            return message.reply(`❌ No saved giveaway found with ID: ${templateId}`);
        }

        // ✅ Load data from template
        title = savedGiveaway.title;
        durationStr = savedGiveaway.duration.toString();
        winnerCountStr = savedGiveaway.winnerCount.toString();
        extraFields = JSON.parse(savedGiveaway.extraFields ?? "{}");
        roleId = savedGiveaway.role;
    } else {
        // ✅ **Extract Proper Arguments for Custom Giveaways**
        title = sanitizeArg(rawArgs.shift());
        durationStr = sanitizeArg(rawArgs.shift());
        winnerCountStr = sanitizeArg(rawArgs.shift());
    }

    if (!title || !durationStr || !winnerCountStr) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIP --extraentries`.");
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

    // ✅ **Extract Additional Flags & Extra Fields**
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

    let rolePing = roleId ? `<@&${roleId}>` : "";

    let hostUser: User | null = null;
    try {
        hostUser = await client.users.fetch(hostId);
    } catch (error) {
        console.error("❌ Failed to fetch host user:", error);
    }

    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    // ✅ **Create Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🎁 **${title}** 🎁`)
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
            .setLabel("Leave ❌")
            .setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    // ✅ **Create Giveaway Entry in Database**
    let giveawayData = await Giveaway.create({
        guildId,
        host: hostUser?.id ?? message.author.id,
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
        useExtraEntries
    });

    startLiveCountdown(giveawayData.id, message.client);

    return message.reply(`🎉 **${title}** started! Hosted by ${hostMention}.`);
}