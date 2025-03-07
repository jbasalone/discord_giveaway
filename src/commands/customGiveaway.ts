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
    let savedGiveaway: SavedGiveaway | null = null;
    let title = "";
    let durationStr = "";
    let winnerCountStr = "";
    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;

    // **Sanitize all incoming arguments**
    const argMatches = rawArgs.join(" ").match(/"([^"]+)"|(\S+)/g);
    const parsedArgs = argMatches ? argMatches.map(arg => arg.replace(/^"|"$/g, '').trim()) : [];

    console.log("🔍 [DEBUG] [customGiveaway.ts] Parsed Args:", parsedArgs);


    if (!isNaN(parseInt(rawArgs[0], 10))) {
        templateId = parseInt(rawArgs.shift()!, 10);
        console.log(`📌 Using Saved Template ID: ${templateId}`);

        let savedGiveaway: SavedGiveaway | null = await SavedGiveaway.findOne({ where: { id: templateId } });

        if (!savedGiveaway) {
            return message.reply(` ❌ No saved giveaway found with ID: ${templateId}`);
        }


        title = savedGiveaway.get("title") || "Giveaway";
        durationStr = savedGiveaway.get("duration").toString();
        winnerCountStr = savedGiveaway.get("winnerCount").toString();
        extraFields = JSON.parse(savedGiveaway.get("extraFields") || "{}");
        roleId = savedGiveaway.get("role") ?? null;
    } else {
        if (parsedArgs.length < 3) {
            return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIP --extraentries`.");
        }
        title = parsedArgs.shift()!;
        durationStr = parsedArgs.shift()!;
        winnerCountStr = parsedArgs.shift()!;
    }

    if (!title || !durationStr || !winnerCountStr) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIP --extraentries`.");
    }

    // ✅ Convert & Validate Duration
    let durationMs = 0;

// ✅ Handle cases where durationStr is already in milliseconds
    if (!isNaN(Number(durationStr)) && Number(durationStr) > 1000) {
        durationMs = Number(durationStr);
    }
// ✅ Handle relative time formats (e.g., 30s, 10m, 2h, 1d)
    else if (/^\d+s$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 1000;
    } else if (/^\d+m$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 1000;
    } else if (/^\d+h$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 60 * 1000;
    } else if (/^\d+d$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 24 * 60 * 60 * 1000;
    } else {
        console.warn(`⚠️ [DEBUG] [customGiveawy.ts] Invalid duration format detected (${durationStr}). Defaulting to 60s.`);
        durationMs = 60000;
    }

    console.log(`📌 [DEBUG] [customGiveawy.ts] Parsed Duration (ms): ${durationMs}`);


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

            // ✅ **Handle Multi-word Fields Properly**
            while (rawArgs[0] && !rawArgs[0].startsWith("--")) {
                fieldData += " " + sanitizeArg(rawArgs.shift());
            }

            if (fieldData.includes(":")) {
                let [key, ...valueParts] = fieldData.split(":");
                key = sanitizeArg(key);
                let value = sanitizeArg(valueParts.join(":"));

                // ✅ **Append New Fields Instead of Overwriting**
                if (!extraFields[key]) {
                    extraFields[key] = value;
                } else {
                    extraFields[key] += `\n${value}`; // Append values on a new line if the same key appears multiple times
                }
            }
        } else if (arg === "--extraentries") {
            useExtraEntries = true;
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const channel = message.channel as TextChannel;
    let defaultRole = guildSettings.get("defaultGiveawayRoleId") ?? null;

    if (!roleId){
        roleId = defaultRole
    }

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