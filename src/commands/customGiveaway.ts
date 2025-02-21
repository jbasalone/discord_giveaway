import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, PermissionsBitField, User } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { AllowedGiveawayChannels } from "../models/AllowedGiveawayChannels";

import { client } from '../index';


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


    // Extract the first 3 required arguments (Title, Duration, Winner Count)
    let title = "";
    let duration = "";
    let winnerCount = "";
    let extraFields: Record<string, string> = {};
    let selectedRole: string | null = null;
    let hostId: string = message.author.id;
    let useExtraEntries = false;

    let i = 0;
    while (i < rawArgs.length) {
        const arg = rawArgs[i];

        if (arg === "--role" && rawArgs[i + 1]) {
            selectedRole = rawArgs[i + 1];
            i += 2;
        } else if (arg === "--host" && rawArgs[i + 1]) {
            const mentionMatch = rawArgs[i + 1].match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : rawArgs[i + 1];
            i += 2;
        } else if (arg === "--field" && rawArgs[i + 1]) {
            while (i + 1 < rawArgs.length && rawArgs[i + 1].includes(":")) {
                const [key, ...valueParts] = rawArgs[i + 1].split(":");
                if (key && valueParts.length > 0) {
                    extraFields[key.trim()] = valueParts.join(":").trim();
                }
                i++;
            }
            i++;
        } else if (arg === "--extraentries") {
            useExtraEntries = true;
            i++;
        } else if (!title) {
            title = arg;
            i++;
        } else if (!duration) {
            duration = arg;
            i++;
        } else if (!winnerCount) {
            winnerCount = arg;
            i++;
        } else {
            i++;
        }
    }

    if (!title || !duration || !winnerCount) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIP --extraentries`.");
    }

    const durationMs = convertToMilliseconds(duration);
    if (durationMs <= 0) {
        return message.reply("❌ Invalid duration format. Example: `30s`, `5m`, `1h`.");
    }

    const winnerCountParsed = parseInt(winnerCount, 10);
    if (isNaN(winnerCountParsed) || winnerCountParsed < 1) {
        return message.reply("❌ Winner count must be a positive number.");
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    const channel = message.channel as TextChannel;

    let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
    if (existingGiveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    let roleMappings: Record<string, string> = {};
    try {
        roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
        roleMappings = {};
    }

    let rolePing = "";
    if (selectedRole) {
        const resolvedRole = roleMappings[selectedRole] || selectedRole;
        rolePing = `<@&${resolvedRole}>`;
    }

    let hostUser: User | null = null;
    try {
        hostUser = await client.users.fetch(hostId);
    } catch (error) {
        console.error("❌ Failed to fetch host user:", error);
    }

    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    const embed = new EmbedBuilder()
        .setTitle(`🎁 **${title}** 🎁`)
        .setDescription(`**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`)
        .setColor("Blue")
        .setFields([
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCountParsed}`, inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);

    if (useExtraEntries) {
        embed.addFields([{ name: "✨ Extra Entries Enabled", value: "✅ Yes", inline: true }]);
    }

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({
            content: rolePing ? `🎉 ${rolePing} ${message.guild?.name} Giveaway!` : undefined,
            embeds: [embed]
        });
    } catch (error) {
        console.error("❌ Failed to send custom giveaway message:", error);
        return message.reply("❌ Could not start custom giveaway. Bot might lack permissions.");
    }

    if (!giveawayMessage.id) {
        return message.reply("❌ Giveaway message failed to send.");
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

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
        winnerCount: winnerCountParsed,
        extraFields: JSON.stringify(extraFields),
        forceStart: false,
        useExtraEntries
    });

    startLiveCountdown(giveawayData.id, message.client);
    return message.reply(`**${title}** started! Hosted by ${hostMention}.`);
}