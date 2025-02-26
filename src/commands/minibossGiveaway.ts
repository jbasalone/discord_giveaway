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

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");
    const channel = message.channel as TextChannel;
    const guildId = message.guild.id;

    const allowedRoles = await MinibossRoles.findAll({ where: { guildId } });
    const allowedRoleIds = allowedRoles.map(role => role.get('roleId')).filter(Boolean);

    if (!message.member?.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
        return message.reply("❌ You **do not have permission** to start Miniboss Giveaways.");
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });
    if (!allowedChannel) return message.reply("❌ Giveaways can only be started in **approved channels**.");

    console.log("🔍 [DEBUG] Raw Args:", rawArgs);
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });
    if (!guildSettings) return message.reply("❌ Guild settings not found. Admins need to configure roles first.");

    let templateId: number | null = !isNaN(Number(rawArgs[0])) ? parseInt(rawArgs.shift()!, 10) : null;
    let savedGiveaway: SavedGiveaway | null = templateId !== null
        ? await SavedGiveaway.findOne({ where: { id: templateId } })
        : null;

    let title: string = "Miniboss Giveaway";
    let durationMs: number = 60000; // Default to 1 minute
    let winnerCount: number = 9;
    let extraFields: Record<string, string> = savedGiveaway
        ? JSON.parse(savedGiveaway.get("extraFields") || "{}")
        : {};

    for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === "--field" && i + 1 < rawArgs.length) {
            const rawField = rawArgs[i + 1].replace(/^"+|"+$/g, "").trim(); // Remove outer quotes
            const [key, ...valueParts] = rawField.split(":");
            if (key && valueParts.length) {
                let value = valueParts.join(":").trim();
                value = value.replace(/\\n/g, "\n"); // ✅ Convert `\n` from text to actual newline
                extraFields[key] = value;
            }
            rawArgs.splice(i, 2);
            i--; // Adjust index since we removed two elements
        }
    }
    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Extracted Extra Fields:`, extraFields);



    let guaranteedWinners: string[] = [];
    const winnersIndex = rawArgs.indexOf("--winners");
    if (winnersIndex !== -1) {
        let i = winnersIndex + 1;
        while (i < rawArgs.length && !rawArgs[i].startsWith("--")) {
            let winnerId = rawArgs[i].trim();
            if (winnerId.startsWith("<@") && winnerId.endsWith(">")) {
                guaranteedWinners.push(winnerId.replace(/<@|>/g, ""));
            }
            i++;
        }
        rawArgs.splice(winnersIndex, guaranteedWinners.length + 1);
    }

    let roleId: string | null = null;
    if (guildSettings) {
        const roleMappings: Record<string, string> = JSON.parse(guildSettings.get("roleMappings") || "{}");
        const roleArgIndex = rawArgs.indexOf("--role");
        if (roleArgIndex !== -1 && roleArgIndex + 1 < rawArgs.length) {
            let roleName = rawArgs[roleArgIndex + 1];
            roleId = roleMappings[roleName] || null;
            rawArgs.splice(roleArgIndex, 2);
        }
    }

    let forceStart: boolean = rawArgs.includes("--force");

    const roleMention = roleId ? `<@&${roleId}>` : "None";
    const currentTime = Math.floor(Date.now() / 1000);
    const endsAt = currentTime + Math.ceil(durationMs / 1000);

    const hostId = message.author.id;
    const hostStats = await getUserMinibossStats(hostId);
    if (!hostStats) return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");

    const { userLevel, ttLevel } = hostStats;
    const { min, max } = calculateCoinWinnings(userLevel, ttLevel);
    const minRequiredTT = calculateMinimumTTLevel(max);

    const embed = new EmbedBuilder()
        .setTitle(`🎊 **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
        .setColor("DarkRed")
        .setFields([
            { name: "💰 Expected Coins", value: `${numberToPrettyERPGNumber(min)} - ${numberToPrettyERPGNumber(max)}`, inline: true },
            { name: "🌌 Min Required TT Level", value: `${minRequiredTT}`, inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Guaranteed Winners", value: guaranteedWinners.length > 0 ? guaranteedWinners.map(id => `<@${id}>`).join(", ") : "None", inline: true },
            { name: "🎟️ Total Participants", value: "0 users", inline: true }
        ]);

    for (const [key, value] of Object.entries(extraFields)) {
        embed.addFields({ name: key, value: value, inline: true });
    }

    if (roleId) {
        await channel.send(`${roleMention} **MB Giveaway**`);
    }

    let giveawayMessage = await channel.send({ embeds: [embed] });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ embeds: [embed], components: [row] });

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

    startLiveCountdown(createdGiveaway.id, message.client);
}