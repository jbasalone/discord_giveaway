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

async function getUserMinibossStats(userId: string): Promise<{ userLevel: number, ttLevel: number } | null> {
    try {
        const user = await UserProfile.findOne({ where: { userId } });

        console.log(`🔍 Debug: Retrieved User Data for ${userId}:`, user?.toJSON());

        if (!user) return null;

        return {
            userLevel: user.get("userLevel") ?? 100,
            ttLevel: user.get("ttLevel") ?? 100
        };
    } catch (error) {
        console.error(`❌ Error retrieving stats for user ${userId}:`, error);
        return null;
    }
}

function calculateCoinWinnings(userLevel: number, ttLevel: number) {
    const safeLevel = isNaN(userLevel) ? 100 : userLevel;
    const min = Math.floor(0.4 * 125 * safeLevel * safeLevel);
    const max = Math.floor(125 * safeLevel * safeLevel);

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
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    console.log("🔍 [DEBUG] Raw Args:", rawArgs);

    let templateId = null;
    let title = "Unknown Giveaway";
    let duration = 60;
    let winnerCount = 1;
    let extraFields: Record<string, string> = {};
    let roleId: string | null = null;

    // ✅ Check if using a template
    if (!isNaN(parseInt(rawArgs[0], 10))) {
        templateId = parseInt(rawArgs.shift()!, 10);
        console.log(`📌 Using Saved Template ID: ${templateId}`);

        const savedGiveaway = await SavedGiveaway.findOne({ where: { id: templateId } });

        if (!savedGiveaway) {
            return message.reply(`❌ No saved giveaway found with ID: ${templateId}`);
        }

        // ✅ Load data from template
        title = savedGiveaway.title;
        duration = savedGiveaway.duration;
        winnerCount = savedGiveaway.winnerCount;
        extraFields = JSON.parse(savedGiveaway.extraFields ?? "{}");
    }

    // ✅ Extract remaining arguments
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

    const roleIndex = rawArgs.indexOf("--role");
    if (roleIndex !== -1 && roleIndex + 1 < rawArgs.length) {
        const extractedRole = rawArgs.splice(roleIndex, 2)[1];
        if (typeof extractedRole === "string") {
            roleId = extractedRole;
        }
    }

    const hostId = message.author.id;
    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
    const channel = message.channel as TextChannel;

    // ✅ Fetch Host's Stats (Level & TT Level)
    const hostStats = await getUserMinibossStats(hostId);
    if (!hostStats) {
        return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");
    }

    const { userLevel, ttLevel } = hostStats;

    // ✅ Calculate Expected Coin Winnings
    const { min, max } = calculateCoinWinnings(userLevel, ttLevel);
    const formattedMin = numberToPrettyERPGNumber(min);
    const formattedMax = numberToPrettyERPGNumber(max);


    // ✅ Determine Minimum TT Level Required
    const minRequiredTT = calculateMinimumTTLevel(max);

    let extraFieldEntries = Object.entries(extraFields).map(([key, value]) => ({
        name: key.trim(),
        value: String(value).trim(),
        inline: true
    }));

    if (roleId) {
        await channel.send(`<@&${roleId}> **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`);
    }

    // ✅ Create Embed
    const embed = new EmbedBuilder()
        .setTitle(`🎊 **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
        .setColor("DarkRed")
        .setFields([
            { name: "🪙 Host Level:", value: `${userLevel}`, inline: true },
            { name: "🌌 Host TT Level:", value: `${ttLevel}`, inline: true },
            { name: "🌌 Min Required TT Level", value: `${minRequiredTT}`, inline: true },
            { name: "💰 Expected Coins", value: `${formattedMin} - ${formattedMax}`, inline: true },
            { name: "🏆 Required Participants", value: `${winnerCount} Required`, inline: true },
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            ...extraFieldEntries
        ]);

    let giveawayMessage = await channel.send({ embeds: [embed] });

    // ✅ Save Giveaway
    const createdGiveaway = await Giveaway.create({
        guildId: message.guild.id,
        host: hostId,
        channelId: channel.id,
        messageId: giveawayMessage.id,
        title,
        description: embed.data.description ?? "",
        type: "miniboss",
        duration,
        endsAt,
        participants: JSON.stringify([]),
        winnerCount,
        extraFields: JSON.stringify(extraFields)
    });

    const giveawayId = createdGiveaway.id;

    // ✅ Add Join/Leave Buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    startLiveCountdown(giveawayId, message.client);
}