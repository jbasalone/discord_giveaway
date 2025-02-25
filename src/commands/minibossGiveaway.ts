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

    let guildId = message.guild.id;
    const allowedRoles = await MinibossRoles.findAll({ where: { guildId } });
    const allowedRoleIds = allowedRoles.map(role => role.get('roleId')).filter(Boolean);

    if (!allowedRoleIds.length) console.warn("⚠️ No Miniboss roles found in DB for this guild.");
    if (!message.member?.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
        return message.reply("❌ You **do not have permission** to start Miniboss Giveaways.");
    }

    const allowedChannel = await AllowedGiveawayChannels.findOne({ where: { guildId, channelId: message.channel.id } });
    if (!allowedChannel) return message.reply("❌ Giveaways can only be started in **approved channels**.");

    console.log("🔍 [DEBUG] Raw Args:", rawArgs);

    let templateId: number | null = parseInt(rawArgs.shift()!, 10);
    if (isNaN(templateId)) {
        return message.reply("❌ Invalid template ID.");
    }

    // ✅ Fetch `savedGiveaway` only ONCE
    let savedGiveaway: SavedGiveaway | null = await SavedGiveaway.findOne({ where: { id: templateId } });
    if (!savedGiveaway) {
        return message.reply(`❌ No saved giveaway found with ID: ${templateId}`);
    }

    // ✅ Extract all values in one step
    let title = savedGiveaway.get("title") ?? "Miniboss Giveaway";
    let durationMs = Number(savedGiveaway.get("duration"));
    let winnerCount = Number(savedGiveaway.get("winnerCount")) || 1;
    let forceStart = Boolean(Number(savedGiveaway.get("forceStart") || 0));
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];
    let roleId: string | null = null;
    let selectedRole: string | null = null;
    let duration = savedGiveaway.duration;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let roleArgIndex = args.findIndex(arg => arg.toLowerCase() === "--role");

    if (roleArgIndex !== -1) {
        selectedRole = args[roleArgIndex + 1] ?? null;
        if (selectedRole) {
            args.splice(roleArgIndex, 2); // Remove `--role` and role argument
        }
    }


    // ✅ Parse extra fields properly
    let extraFields: Record<string, string> = {};
    let guaranteedWinners: string[] = [];

    try {
        extraFields = savedGiveaway.get("extraFields") ? JSON.parse(savedGiveaway.get("extraFields") || "{}") : {};
        const guaranteedWinnersRaw = savedGiveaway.get("guaranteedWinners");
        guaranteedWinners = typeof guaranteedWinnersRaw === "string" ? JSON.parse(guaranteedWinnersRaw) : [];
    } catch (error) {
        console.warn("⚠️ Error parsing extra fields:", error);
    }

    console.log(`📌 [DEBUG] Extracted Template Data -> Title: ${title}, Duration: ${durationMs}ms, Winners: ${winnerCount}, Force Start: ${forceStart}`);

    // ✅ **Parse Additional Arguments** (ONLY user inputs should be converted)
    let i = 0;
    if (rawArgs.length > 0) title = rawArgs.shift()!;
    if (rawArgs.length > 0) duration = parseInt(rawArgs.shift()!, 10);
    if (rawArgs.length > 0) winnerCount = parseInt(rawArgs.shift()!, 10);

    while (rawArgs.length > 0) {
        const keyFlagIndex = rawArgs.indexOf("--field");
        if (keyFlagIndex !== -1 && keyFlagIndex + 1 < rawArgs.length) {
            rawArgs.splice(keyFlagIndex, 1); // Remove `--field`
            const rawField = rawArgs.splice(keyFlagIndex, 1)[0];
            if (rawField) {
                let [key, ...valueParts] = rawField.split(":");
                let value = valueParts.join(":").trim();
                key = key.replace(/^"+|"+$/g, "").trim();
                value = value.replace(/^"+|"+$/g, "").replace(/\\n/g, "\n").trim();
                if (key && value) {
                    extraFields[key] = value;
                }
            }
        } else {
            break;
        }
    }

    console.log("📌 [DEBUG] Extracted Fields:", { templateId, title, duration, winnerCount, extraFields });


    // ✅ **Calculate End Time**
    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(durationMs / 1000);
    console.log(`📌 [DEBUG] Final Duration (ms): ${durationMs}, Ends At: ${endsAt}`);

    const hostId = message.author.id;
    const channel = message.channel as TextChannel;

    // ✅ **Fetch Host's Stats**
    const hostStats = await getUserMinibossStats(hostId);
    if (!hostStats) return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");

    const { userLevel, ttLevel } = hostStats;
    const { min, max } = calculateCoinWinnings(userLevel, ttLevel);
    const minRequiredTT = calculateMinimumTTLevel(max);

    let roleMappings: Record<string, string> = {};
    try {
        roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
        roleMappings = {};
    }

    // ✅ Resolve Role ID for Ping (From `--role` argument or mappings)
    const roleIndex = rawArgs.indexOf("--role");
    if (roleIndex !== -1 && roleIndex + 1 < rawArgs.length) {
        const extractedRole = rawArgs.splice(roleIndex, 2)[1];
        if (typeof extractedRole === "string") {
            roleId = extractedRole;
        }
    }



    // ✅ **Create Giveaway Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🎊 **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
        .setColor("DarkRed")
        .setFields([
            { name: "💰 Expected Coins", value: `${numberToPrettyERPGNumber(min)} - ${numberToPrettyERPGNumber(max)}`, inline: true },
            { name: "🌌 Min Required TT Level", value: `${minRequiredTT}`, inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "🏆 Guaranteed Winners", value: guaranteedWinners.length > 0 ? guaranteedWinners.map(id => `<@${id}>`).join(", ") : "None", inline: true }

        ]);

    for (const [key, value] of Object.entries(extraFields)) {
        embed.addFields({ name: key, value: value.replace(/\\n/g, '\n'), inline: true });
    }
    if (roleId) {
        await channel.send(`<${roleId}> **MB Giveaway** - Level ${userLevel}`);
    }

    let giveawayMessage = await channel.send({ embeds: [embed] });

    // ✅ **Add Buttons**
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ embeds: [embed], components: [row] });

    // ✅ **Save Giveaway to DB and Retrieve ID**
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

    // ✅ Retrieve the correct giveaway ID from the database
    const giveawayId = createdGiveaway.id;

    // ✅ **Pass the correct number (giveaway ID) to startLiveCountdown()**
    startLiveCountdown(giveawayId, message.client);
}