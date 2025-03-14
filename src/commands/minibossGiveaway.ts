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
import { Op } from "sequelize";

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

    const activeMiniboss = await Giveaway.findOne({
        where: { guildId, type: "miniboss", endsAt: { [Op.gt]: Math.floor(Date.now() / 1000) } },
    });

    if (activeMiniboss) {
        return message.reply("⚠️ A **Miniboss Giveaway** is already running! Please wait until it ends before starting another.");
    }

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
        if ((rawArgs[i] === "--field" || rawArgs[i] === "--fields" )&& i + 1 < rawArgs.length) {
            let rawField = rawArgs[i + 1];

            // 🔍 Handle potential multi-word fields that were split
            while (i + 2 < rawArgs.length && !rawArgs[i + 2].startsWith("--")) {
                rawField += " " + rawArgs[i + 2];
                rawArgs.splice(i + 2, 1); // Remove merged elements
            }

            // ✅ Clean up quotes and split key:value correctly
            rawField = rawField.replace(/^"+|"+$/g, "").trim(); // Remove outer quotes
            const splitIndex = rawField.indexOf(":");
            if (splitIndex !== -1) {
                let key = rawField.substring(0, splitIndex).trim();
                let value = rawField.substring(splitIndex + 1).trim();

                value = value.replace(/\\n/g, "\n"); // Convert `\n` into actual newline

                if (key.length > 0 && value.length > 0) {
                    extraFields[key] = value;
                }
            }
            rawArgs.splice(i, 2); // Remove processed `--field` and its argument
            i--; // Adjust index
        }
    }
    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Extracted Extra Fields:`, extraFields);

    let guaranteedWinners: string[] = [];

    if (savedGiveaway) {
        try {
            const savedWinners = savedGiveaway.get("guaranteedWinners");
            const winnersString = typeof savedWinners === "string" ? savedWinners : "[]"; // Ensure it's a string
            guaranteedWinners = JSON.parse(winnersString);
        } catch (error) {
            console.error("❌ Error parsing guaranteed winners from template:", error);
            guaranteedWinners = [];
        }
    }

    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Template Winners:`, guaranteedWinners);

// ✅ Process manual winners from `--winners`
    const winnersIndex = rawArgs.indexOf("--winners");
    let manualWinners: string[] = [];

    if (winnersIndex !== -1) {
        let i = winnersIndex + 1;
        while (i < rawArgs.length && !rawArgs[i].startsWith("--")) {
            let winnerId = rawArgs[i].trim();
            if (winnerId.startsWith("<@") && winnerId.endsWith(">")) {
                manualWinners.push(winnerId.replace(/<@|>/g, ""));
            }
            i++;
        }
        rawArgs.splice(winnersIndex, manualWinners.length + 1);
    }

// ✅ Merge both manual and template winners, ensuring no duplicates
    guaranteedWinners = [...new Set([...guaranteedWinners, ...manualWinners])];

    console.log(`✅ [DEBUG] [minibossGiveaway.ts] Final Guaranteed Winners:`, guaranteedWinners);

    let roleId: string | null = null;
    const roleMappings: Record<string, string> = JSON.parse(guildSettings.get("roleMappings") || "{}");
    const ttLevelMappings: Record<string, string> = JSON.parse(guildSettings.get("ttLevelRoles") || "{}");

// ✅ Step 1: Check if `--role` is provided
    const roleArgIndex = rawArgs.indexOf("--role");
    if (roleArgIndex !== -1 && roleArgIndex + 1 < rawArgs.length) {
        let roleName = rawArgs[roleArgIndex + 1];
        roleId = roleMappings[roleName] || roleName; // Allow both role name & ID
        rawArgs.splice(roleArgIndex, 2);
    }

// ✅ Step 2: If `--role` is not provided, calculate TT Level & use mappings
    if (!roleId) {
        const hostStats = await getUserMinibossStats(message.author.id);
        if (!hostStats) return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");

        const { userLevel, ttLevel } = hostStats;
        const { min, max } = calculateCoinWinnings(userLevel, ttLevel);
        const minRequiredTT = calculateMinimumTTLevel(max);

        console.log(`✅ [DEBUG] Min Required TT Level: ${minRequiredTT}`);

        // Select appropriate role based on TT level
        if (minRequiredTT >= 25 && ttLevelMappings["TT25"]) {
            roleId = ttLevelMappings["TT25"];
        } else if (minRequiredTT >= 1 && minRequiredTT <= 24 && ttLevelMappings["TT1-25"]) {
            roleId = ttLevelMappings["TT1-25"];
        } else if (minRequiredTT === 0 && ttLevelMappings["TT01"]) {
            roleId = ttLevelMappings["TT01"];
        } else {
            return message.reply("❌ No valid TT level mappings found in `guild_settings`. An admin needs to configure `ttLevelRoles`.");
        }
    }

    console.log(`✅ [DEBUG] Selected Role ID: ${roleId}`);
    let forceStart: boolean = rawArgs.includes("--force");

    if (savedGiveaway) {
        forceStart = Boolean(savedGiveaway.get("forceStart")) || forceStart; // ✅ Convert to boolean first
    }

    let roleMention = "None";

    if (roleId) {
        const roleExists = message.guild.roles.cache.has(roleId);
        if (!roleExists) {
            return message.reply(`❌ The role ID **${roleId}** is invalid or does not exist.`);
        }
        roleMention = `<@&${roleId}>`;
    }
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
    console.log(`✅ [DEBUG] Selected Role ID: ${roleId}`);
    console.log(`✅ [DEBUG] Role Mention: ${roleMention}`);
    console.log(`✅ [DEBUG] TT Level Mappings:`, ttLevelMappings);

    let giveawayMessage = await channel.send({ embeds: [embed] });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ embeds: [embed], components: [row] });

    const createdGiveaway = await Giveaway.create({
        guildId: message.guild.id,
        host: hostId,
        userId: hostId,
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
        status: "approved",
        forceStart: forceStart ? 1 : 0
    });

    startLiveCountdown(createdGiveaway.id, message.client);
}