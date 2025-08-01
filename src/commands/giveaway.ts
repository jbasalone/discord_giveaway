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
        return message.reply("  ❌ This command must be used inside a server.");
    }

    const guildId = message.guild?.id;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = guildSettings?.get("prefix") || "!";

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure GA System first.");
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
    let targetChannel: TextChannel = message.channel as TextChannel;

    const lastArg = rawArgs[rawArgs.length - 1];
    const channelMatch = lastArg?.match(/^<#(\d+)>$/);

    if (channelMatch) {
        const channelId = channelMatch[1];
        const found = message.guild.channels.cache.get(channelId);
        if (found?.isTextBased()) {
            targetChannel = found as TextChannel;
            rawArgs.pop(); // Remove the channel mention from args
            console.log(`✅ [DEBUG] Target channel override detected: ${channelId}`);
        }
    }

    // **Sanitize all incoming arguments**
    rawArgs = rawArgs.map(sanitizeArg);

    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;
    let roleIds: string[] = [];


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
        return message.reply(`❌ Invalid format! Examples:\n\`\`\`\n ${prefix} ga create \"Super Giveaway\" 30s 1 --role <rolename> #CHANNEL\n\`\`\`\n ${prefix} ga create 30s 1\n\`\`\``);
    }

// ✅ Convert & Validate Duration
    let durationMs = 0;

// ✅ Handle cases where durationStr is already in milliseconds
    if (!isNaN(Number(durationStr)) && Number(durationStr) > 1000) {
        durationMs = Number(durationStr);
    }
    else if (/^\d+s$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 1000;
    } else if (/^\d+m$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 1000;
    } else if (/^\d+h$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 60 * 60 * 1000;
    } else if (/^\d+d$/.test(durationStr)) {
        durationMs = parseInt(durationStr) * 24 * 60 * 60 * 1000;
    } else {
        console.warn(`⚠️ [DEBUG] [checkScheduledGivaway.ts]  Invalid duration format detected (${durationStr}). Defaulting to 60s.`);
        durationMs = 60000;
    }

    console.log(`📌 [DEBUG] [checkScheduledGivaway.ts] Parsed Duration (ms): ${durationMs}`);

// ✅ Convert & Validate Winner Count
    let winnerCount = parseInt(winnerCountStr, 10);
    if (isNaN(winnerCount) || winnerCount <= 0) {
        console.warn(`⚠️ [DEBUG] [checkScheduledGivaway.ts]  Invalid winner count (${winnerCount}) detected! Defaulting to 1.`);
        winnerCount = 1;
    }

    console.log(`🎯 [DEBUG]  [checkScheduledGivaway.ts]  Processed Values -> Title: ${title}, Duration: ${durationMs}ms, WinnerCount: ${winnerCount}`);

    while (rawArgs.length > 0) {
        const arg = sanitizeArg(rawArgs.shift());

        if (arg === "--role") {
            let roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
            // Gather ALL role args until next flag or end
            let roleArgs: string[] = [];
            while (rawArgs.length > 0 && !rawArgs[0].startsWith("--")) {
                // Allow comma split within one arg (e.g. "--role VIP,<@&123>,AnotherRole")
                roleArgs.push(...sanitizeArg(rawArgs.shift()).split(",").map(s => s.trim()).filter(Boolean));
            }
            // Now: roleArgs = ["VIP", "<@&123>", "<@&456>", "AnotherRole", ...]
            for (let rawRole of roleArgs) {
                let mentionMatch = rawRole.match(/^<@&(\d+)>$/);
                if (mentionMatch) rawRole = mentionMatch[1];
                if (roleMappings[rawRole]) {
                    if (!roleIds.includes(roleMappings[rawRole]))
                        roleIds.push(roleMappings[rawRole]);
                } else if (/^\d+$/.test(rawRole) && message.guild.roles.cache.has(rawRole)) {
                    if (!roleIds.includes(rawRole))
                        roleIds.push(rawRole);
                } else {
                    let foundRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === rawRole.toLowerCase());
                    if (foundRole && !roleIds.includes(foundRole.id)) {
                        roleIds.push(foundRole.id);
                    } else {
                        await message.reply(`❌ The role **${rawRole}** is invalid or does not exist.`);
                        return;
                    }
                }
            }
        }
        if (arg === "--host" && rawArgs.length > 0) {
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

    if (roleIds.length === 0) {
        let defaultRole = guildSettings.get("defaultGiveawayRoleId") ?? null;
        if (defaultRole && message.guild.roles.cache.has(defaultRole)) {
            roleIds.push(defaultRole);
            console.log("✅ [DEBUG] Using defaultGiveawayRoleId as fallback role.");
        } else {
            return message.reply("❌ No valid roles were provided, and no default role is set in server config. Use `--role VIP` or ask an admin to configure one.");
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const channel = targetChannel;

// ✅ Join all role pings into one string
    let rolePing = roleIds.map(id => `<@&${id}>`).join(" ");


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
    console.log(`✅ [DEBUG] Resolved Role Pings: ${rolePing}`);
    let giveawayMessage = await channel.send({ content: rolePing, embeds: [embed] });

    // ✅ **Create "Join" and "Leave" Buttons**
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`gwjoin-${giveawayMessage.id}`)
            .setLabel("Join 🎉")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`gwleave-${giveawayMessage.id}`)
            .setLabel("Leave 💨")
            .setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

// ✅ **Create Giveaway Entry in Database**
    const giveawayData = await Giveaway.create({
        guildId,
        host: hostId,
        userId: message.author.id,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        title,
        description: `**Host:** <@${hostId}> | **Server:** ${message.guild?.name}`,
        type: "custom",
        duration: durationMs,
        endsAt,
        participants: JSON.stringify([]),
        winnerCount,
        status:"approved",
        extraFields: JSON.stringify(extraFields),
        forceStart: false,
        useExtraEntries,
        roleRestriction: roleIds.join(",") // Optionally store role IDs in a DB column
    });

    startLiveCountdown(giveawayData.id, message.client);
}