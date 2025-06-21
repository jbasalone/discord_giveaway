import {
    Message,
    EmbedBuilder,
    TextChannel,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User,
    ChannelType,
    Client
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client as globalClient } from '../index';

function sanitizeArg(arg: string | undefined): string {
    return arg ? arg.replace(/^"|"$/g, '').trim() : '';
}

// Accept scheduled?: { guildId: string, channelId: string } as an optional third param
export async function execute(
    message: Message,
    rawArgs: string[],
    scheduled?: { guildId: string, channelId: string }
) {
    // --- Context Setup ---
    // For scheduled runs, use scheduled.{guildId, channelId}, else use message context
    const guildId = scheduled?.guildId ?? message.guild!.id;
    const channelId = scheduled?.channelId ?? message.channel.id;
    const clientObj: Client = (message.client as Client) ?? globalClient;

    // Fetch the guild and the channel for the giveaway post
    const guild = await clientObj.guilds.fetch(guildId);
    let targetChannel = null;
    try {
        targetChannel = await guild.channels.fetch(channelId) as TextChannel;
    } catch (e) {
        console.error("Failed to fetch target channel, using fallback...", e);
    }
    // Fallback: systemChannel or any text channel
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        targetChannel = guild.systemChannel
            ?? guild.channels.cache.find(
                (ch): ch is TextChannel => ch.type === ChannelType.GuildText
            );
        if (!targetChannel) throw new Error("No valid channel found to start giveaway.");
    }

    // --- Permission & Config Checks (only for live runs) ---
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = guildSettings?.get("prefix") || "!";
    if (!guildSettings && !scheduled) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    if (!scheduled) { // Only check roles/channel for live commands
        const allowedRoles: string[] = JSON.parse(guildSettings?.get("allowedRoles") ?? "[]");
        if (allowedRoles.length > 0 && message.member && !message.member.roles.cache.some(role => allowedRoles.includes(role.id))) {
            return message.reply("❌ You do not have permission to start giveaways.");
        }

        const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });
        if (!allowedChannel) {
            return message.reply("❌ Giveaways can only be started in approved channels.");
        }
    }

    // --- Parse Command Args (same for live and scheduled) ---
    // Remove trailing channel mention, if any (for live commands only)
    if (!scheduled) {
        const lastArg = rawArgs[rawArgs.length - 1];
        const match = lastArg?.match(/^<#(\d+)>$/);
        if (match) {
            const chanId = match[1];
            const found = message.guild?.channels.cache.get(chanId);
            if (found?.isTextBased()) {
                targetChannel = found as TextChannel;
                rawArgs.pop(); // Remove channel mention
            }
        }
    }

    const durationIndex = rawArgs.findIndex(arg => /^\d+$/.test(arg) || /^\d+[smhd]$/.test(arg));
    if (durationIndex === -1) {
        return message.reply("❌ Missing valid duration. Use formats like `30m`, `1h`, etc.");
    }

    const title = sanitizeArg(rawArgs.slice(0, durationIndex).join(" ").trim());
    if (!title || /^\d+[smhd]$/.test(title)) {
        return message.reply(
            `❌ Invalid title.\nExample:\n\`\`\`${prefix} ga custom "Epic Giveaway" 30m 1 --field "Requirement: Level 20"\`\`\``
        );
    }

    rawArgs.splice(0, durationIndex);
    const durationStr = sanitizeArg(rawArgs.shift());
    const winnerCountStr = sanitizeArg(rawArgs.shift());
    let winnerCount = parseInt(winnerCountStr, 10);
    if (isNaN(winnerCount) || winnerCount <= 0) winnerCount = 1;

    let durationMs = 0;
    if (/^\d+$/.test(durationStr)) durationMs = parseInt(durationStr);
    else if (/^\d+s$/.test(durationStr)) durationMs = parseInt(durationStr) * 1000;
    else if (/^\d+m$/.test(durationStr)) durationMs = parseInt(durationStr) * 60 * 1000;
    else if (/^\d+h$/.test(durationStr)) durationMs = parseInt(durationStr) * 60 * 60 * 1000;
    else if (/^\d+d$/.test(durationStr)) durationMs = parseInt(durationStr) * 24 * 60 * 60 * 1000;
    else return message.reply(`❌ Invalid duration format: "${durationStr}". Example: \`30m\`, \`1h\`, \`2d\`.`);

    const options = {
        roleIds: [] as string[], // <-- Array of all valid role IDs
        hostId: message.author.id,
        extraFields: {} as Record<string, string>,
        useExtraEntries: false,
        imageUrl: null as string | null,
        thumbnailUrl: null as string | null
    };
    const roleMappings = JSON.parse(guildSettings?.get("roleMappings") ?? "{}");

    // Parse args for --role (support multi-role, comma and space separated, mentions, names, IDs)
    let i = 0;
    while (i < rawArgs.length) {
        const arg = sanitizeArg(rawArgs[i]);

        if (arg === '--role') {
            let roleArgs: string[] = [];
            // Gather all role args until next flag or end
            while (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("--")) {
                i++;
                // Allow comma-splitting and trim
                roleArgs.push(...sanitizeArg(rawArgs[i]).split(",").map(s => s.trim()).filter(Boolean));
            }
            for (let rawRole of roleArgs) {
                let mentionMatch = rawRole.match(/^<@&(\d+)>$/);
                if (mentionMatch) rawRole = mentionMatch[1];
                if (roleMappings[rawRole]) {
                    if (!options.roleIds.includes(roleMappings[rawRole]))
                        options.roleIds.push(roleMappings[rawRole]);
                } else if (/^\d+$/.test(rawRole) && guild.roles.cache.has(rawRole)) {
                    if (!options.roleIds.includes(rawRole))
                        options.roleIds.push(rawRole);
                } else {
                    let foundRole = guild.roles.cache.find(r => r.name.toLowerCase() === rawRole.toLowerCase());
                    if (foundRole && !options.roleIds.includes(foundRole.id)) {
                        options.roleIds.push(foundRole.id);
                    } else if (!scheduled) {
                        await message.reply(`❌ The role **${rawRole}** is invalid or does not exist.`);
                        return;
                    }
                }
            }
            i++;
            continue;
        } else if (arg === '--host') {
            const next = sanitizeArg(rawArgs[i + 1]);
            const mentionMatch = next?.match(/^<@!?(\d+)>$/);
            options.hostId = mentionMatch ? mentionMatch[1] : next;
            i += 2;
            continue;
        } else if (arg === '--field') {
            i++;
            let fieldRaw = '';
            while (i < rawArgs.length && !rawArgs[i].startsWith('--')) {
                fieldRaw += (fieldRaw ? ' ' : '') + sanitizeArg(rawArgs[i]);
                i++;
            }
            fieldRaw = fieldRaw.trim();
            if (!fieldRaw.includes(":")) {
                return message.reply("❌ Invalid `--field` format. Use `--field \"Key: Value\"`");
            }
            const [key, ...valParts] = fieldRaw.split(":");
            const keyStr = key.trim();
            const valStr = valParts.join(":").trim();
            if (keyStr && valStr) options.extraFields[keyStr] = valStr;
            continue;
        } else if (arg === '--extraentries') {
            options.useExtraEntries = true;
            i++;
            continue;
        } else if (arg === '--image') {
            const next = sanitizeArg(rawArgs[i + 1]);
            if (next?.startsWith("http")) {
                options.imageUrl = next;
                i += 2;
                continue;
            }
        } else if (arg === '--thumbnail') {
            const next = sanitizeArg(rawArgs[i + 1]);
            if (next?.startsWith("http")) {
                options.thumbnailUrl = next;
                i += 2;
                continue;
            }
        }
        i++;
    }

    // Attachments (only if present in live message)
    if (message.attachments?.size > 0) {
        const imageAttachment = message.attachments.find(att => att.contentType?.startsWith("image"));
        if (imageAttachment) {
            const argsStr = rawArgs.map(arg => arg.toLowerCase()).join(" ");
            if (argsStr.includes('--thumbnail') && !argsStr.includes('--image')) {
                options.thumbnailUrl = imageAttachment.url;
            } else if (argsStr.includes('--image') && !argsStr.includes('--thumbnail')) {
                options.imageUrl = imageAttachment.url;
            } else if (!argsStr.includes('--thumbnail') && !argsStr.includes('--image')) {
                options.imageUrl = imageAttachment.url; // fallback
            }
            if (argsStr.includes('--image') && argsStr.includes('--thumbnail')) {
                return message.reply("❌ Cannot use both `--image` and `--thumbnail` with a single upload. Please use separate URLs.");
            }
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const hostId = options.hostId;
    const extraFields = options.extraFields;
    const useExtraEntries = options.useExtraEntries;
    const defaultRole = guildSettings?.get("defaultGiveawayRoleId") ?? null;

    // --- Roles & Pings ---
    if (options.roleIds.length === 0 && defaultRole && guild.roles.cache.has(defaultRole)) {
        options.roleIds.push(defaultRole);
    }
    if (options.roleIds.length === 0 && !scheduled) {
        return message.reply("❌ No valid roles. Use `--role VIP` or set a default role.");
    }
    const rolePing = options.roleIds.map(id => `<@&${id}>`).join(" ");
    const hostUser: User = await clientObj.users.fetch(hostId).catch(() => message.author);
    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    // --- Giveaway Embed ---
    const embed = new EmbedBuilder()
        .setTitle(`🚀 **${title}**`)
        .setDescription(`**Host:** ${hostMention}\n**Server:** ${guild.name}`)
        .setColor("Blue")
        .setFields([
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);
    if (options.imageUrl) embed.setImage(options.imageUrl);
    if (options.thumbnailUrl) embed.setThumbnail(options.thumbnailUrl);
    if (useExtraEntries) {
        embed.addFields([{ name: "✨ Extra Entries Enabled", value: "✅ Yes", inline: true }]);
    }

    // --- Send Giveaway ---
    const giveawayMessage = await targetChannel.send({ content: rolePing, embeds: [embed] });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`gwjoin-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gwleave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );
    await giveawayMessage.edit({ components: [row] });

    // --- Store Giveaway in DB ---
    const giveawayData = await Giveaway.create({
        guildId,
        host: hostUser?.id ?? message.author.id,
        userId: message.author.id,
        channelId: targetChannel.id,
        messageId: giveawayMessage.id,
        title,
        description: `**Host:** ${hostMention}\n**Server:** ${guild.name}`,
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
    await Giveaway.update({ messageId: giveawayMessage.id }, { where: { id: giveawayData.id } });
    startLiveCountdown(giveawayData.id, clientObj);

    // --- Final Feedback (live only) ---
    if (!scheduled) {
        const reply = await message.reply(`🎉 **${title}** started! Hosted by ${hostMention}.`);
        setTimeout(() => reply.delete().catch(() => null), 10_000);
    }
}

export { execute as startCustomGiveaway };