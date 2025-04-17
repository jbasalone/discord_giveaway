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
import { GuildSettings } from '../models/GuildSettings';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

/**
 * Remove leading/trailing quotes.
 */
function sanitizeArg(arg: string | undefined): string {
    return arg ? arg.replace(/^"|"$/g, '').trim() : '';
}

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    const guildId = message.guild.id;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = guildSettings?.get("prefix") || "!";
    const parsedArgs = (rawArgs.join(" ").match(/"([^"]+)"|[^\s]+/g) || []).map(arg => arg.replace(/^"|"$/g, '').trim());
    let remainingArgs = [...parsedArgs];

    if (!guildSettings) return message.reply("❌ Guild settings not found. Admins need to configure roles first.");

    const allowedRoles: string[] = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    if (allowedRoles.length > 0 && message.member && !message.member.roles.cache.some(role => allowedRoles.includes(role.id))) {
        return message.reply("❌ You do not have permission to start giveaways.");
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });
    if (!allowedChannel) {
        return message.reply("❌ Giveaways can only be started in approved channels.");
    }

    let targetChannel: TextChannel = message.channel as TextChannel;
    const lastArg = rawArgs[rawArgs.length - 1];
    const match = lastArg?.match(/^<#(\d+)>$/);
    if (match) {
        const channelId = match[1];
        const found = message.guild.channels.cache.get(channelId);
        if (found?.isTextBased()) {
            targetChannel = found as TextChannel;
            rawArgs.pop(); // Remove channel mention
        }
    }

    const durationIndex = rawArgs.findIndex(arg => /^\d+$/.test(arg) || /^\d+[smhd]$/.test(arg));
    if (durationIndex === -1) {
        return message.reply("❌ Missing valid duration. Use formats like `30m`, `1h`, etc.");
    }

    const title = sanitizeArg(rawArgs.slice(0, durationIndex).join(" ").trim());
    if (!title || /^\d+[smhd]$/.test(title)) {
        return message.reply(`❌ Invalid title.\nExample:\n\`\`\`${prefix} ga custom "Epic Giveaway" 30m 1 --field "Requirement: Level 20"\`\`\``);
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
        roleId: null as string | null,
        hostId: message.author.id,
        extraFields: {} as Record<string, string>,
        useExtraEntries: false,
        imageUrl: null as string | null,
        thumbnailUrl: null as string | null

    };

    let i = 0;
    while (i < rawArgs.length) {
        const arg = sanitizeArg(rawArgs[i]);

        if (arg === '--role') {
            const next = sanitizeArg(rawArgs[i + 1]);
            if (next && !next.match(/^\d+[smhd]?$/)) {
                options.roleId = next;
                i += 2;
                continue;
            }
        } else if (arg === '--host') {
            const next = sanitizeArg(rawArgs[i + 1]);
            const mentionMatch = next?.match(/^<@!?(\d+)>$/);
            options.hostId = mentionMatch ? mentionMatch[1] : next;
            i += 2;
            continue;
        } else if (arg === '--field') {
            i++;
            let fieldRaw = '';

            // Collect all parts of the field until we hit another flag or end
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
            if (keyStr && valStr) {
                options.extraFields[keyStr] = valStr;
            }
            continue;
        } else if (arg === '--extraentries') {
            options.useExtraEntries = true;
            i++;
            continue;
        }else if (arg === '--image') {
                const next = sanitizeArg(rawArgs[i + 1]);
                if (next?.startsWith("http")) {
                    options.imageUrl = next;
                    i += 2;
                    continue;
                }
            }

            else if (arg === '--thumbnail') {
                const next = sanitizeArg(rawArgs[i + 1]);
                if (next?.startsWith("http")) {
                    options.thumbnailUrl = next;
                    i += 2;
                    continue;
                }
            }

        i++;
    }
    // ✅ Infer attachment **only if no URL already set**
    if (message.attachments.size > 0) {
        const imageAttachment = message.attachments.find(att => att.contentType?.startsWith("image"));
        if (imageAttachment) {
            const argsStr = rawArgs.map(arg => arg.toLowerCase()).join(" ");

            if (argsStr.includes('--thumbnail') && !argsStr.includes('--image')) {
                options.thumbnailUrl = imageAttachment.url;
            } else if (argsStr.includes('--image') && !argsStr.includes('--thumbnail')) {
                options.imageUrl = imageAttachment.url;
            } else if (!argsStr.includes('--thumbnail') && !argsStr.includes('--image')) {
                options.imageUrl = imageAttachment.url; // default fallback
            }

            // ❌ Explicitly prevent both being set by default
            if (argsStr.includes('--image') && argsStr.includes('--thumbnail')) {
                return message.reply("❌ Cannot use both `--image` and `--thumbnail` with a single upload. Please use separate URLs.");
            }
        }
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const hostId = options.hostId;
    const extraFields = options.extraFields;
    const useExtraEntries = options.useExtraEntries;
    const defaultRole = guildSettings.get("defaultGiveawayRoleId") ?? null;

    let rolePings: string[] = [];
    let roleId = options.roleId;
    const roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    if (roleId && roleMappings.hasOwnProperty(roleId)) {
        roleId = roleMappings[roleId];
    }

    const roleList = roleId ? roleId.split(",") : [];
    for (const id of roleList) {
        if (message.guild.roles.cache.has(id)) {
            rolePings.push(`<@&${id}>`);
        } else {
            return message.reply(`❌ The role ID **${id}** is invalid.`);
        }
    }

    if (rolePings.length === 0 && defaultRole && message.guild.roles.cache.has(defaultRole)) {
        rolePings.push(`<@&${defaultRole}>`);
    }

    if (rolePings.length === 0) {
        return message.reply("❌ No valid roles. Use `--role VIP` or set a default role.");
    }

    const rolePing = rolePings.join(" ");
    const hostUser: User = await client.users.fetch(hostId).catch(() => message.author);
    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    const embed = new EmbedBuilder()
        .setTitle(`🚀 **${title}**`)
        .setDescription(`**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`)
        .setColor("Blue");

    if (options.imageUrl) embed.setImage(options.imageUrl);
    if (options.thumbnailUrl) embed.setThumbnail(options.thumbnailUrl);

    embed.setFields([
        { name: "🎟️ Total Participants", value: "0 users", inline: true },
        { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
        { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
        ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
    ]);

    if (useExtraEntries) {
        embed.addFields([{ name: "✨ Extra Entries Enabled", value: "✅ Yes", inline: true }]);
    }


    const giveawayMessage = await targetChannel.send({ content: rolePing, embeds: [embed] });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    const giveawayData = await Giveaway.create({
        guildId,
        host: hostUser?.id ?? message.author.id,
        userId: message.author.id,
        channelId: targetChannel.id,
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

    await Giveaway.update({ messageId: giveawayMessage.id }, { where: { id: giveawayData.id } });
    startLiveCountdown(giveawayData.id, message.client);

    const reply = await message.reply(`🎉 **${title}** started! Hosted by ${hostMention}.`);
    setTimeout(() => reply.delete().catch(() => null), 10_000);}

export { execute as startCustomGiveaway };