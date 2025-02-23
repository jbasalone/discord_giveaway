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

    let templateId: number | null = null;
    let savedGiveaway: SavedGiveaway | null = null;
    let title = "Miniboss Giveaway";
    let duration = 60;
    let winnerCount = 1;
    let extraFields: Record<string, string> = {};
    let guaranteedWinners: string[] = [];

    // ✅ **Extract Values Regardless of Order**
    let i = 0;
    while (i < rawArgs.length) {
        const arg = rawArgs[i];

        if (!isNaN(parseInt(arg, 10)) && !templateId) {
            templateId = parseInt(arg, 10);
            savedGiveaway = await SavedGiveaway.findOne({ where: { id: templateId } });
            if (!savedGiveaway) return message.reply(`❌ No saved giveaway found with ID: ${templateId}`);

            title = savedGiveaway.title;
            duration = savedGiveaway.duration;
            winnerCount = savedGiveaway.winnerCount;
            extraFields = JSON.parse(savedGiveaway.extraFields ?? "{}");
        } else if (arg.startsWith("--winners")) {
            i++;
            while (i < rawArgs.length && rawArgs[i].startsWith("<@")) {
                const mentionMatch = rawArgs[i].match(/^<@!?(\d+)>$/);
                if (mentionMatch) guaranteedWinners.push(mentionMatch[1]);
                i++;
            }
            continue;
        } else if (arg.match(/^\d+[smhd]$/) && !duration) {
            duration = parseInt(arg, 10);
        } else if (!isNaN(parseInt(arg, 10)) && !winnerCount) {
            winnerCount = parseInt(arg, 10);
        } else if (!arg.startsWith("--")) {
            title = arg;
        }
        i++;
    }

    console.log(`📌 [DEBUG] Title: ${title}, Duration: ${duration}, Winners: ${winnerCount}, Guaranteed:`, guaranteedWinners);

    const hostId = message.author.id;
    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
    const channel = message.channel as TextChannel;

    // ✅ **Fetch Host's Stats**
    const hostStats = await getUserMinibossStats(hostId);
    if (!hostStats) return message.reply("⚠️ Your stats are not set! Use: `!setlevel <your_level> <tt_level>`.");

    const { userLevel, ttLevel } = hostStats;
    const { min, max } = calculateCoinWinnings(userLevel, ttLevel);

    // ✅ **Create Giveaway Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🎊 **MB Giveaway - Level ${userLevel} (TT ${ttLevel})** 🎊`)
        .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
        .setColor("DarkRed")
        .setFields([
            { name: "🎟️ Total Participants", value: "0 users", inline: true },
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "💰 Expected Coins", value: `${numberToPrettyERPGNumber(min)} - ${numberToPrettyERPGNumber(max)}`, inline: true },
            { name: "🏆 Guaranteed Winners", value: guaranteedWinners.length > 0 ? guaranteedWinners.map(id => `<@${id}>`).join(", ") : "None", inline: true }
        ]);

    let giveawayMessage = await channel.send({ embeds: [embed] });

    // ✅ **Save Giveaway**
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
        extraFields: JSON.stringify(extraFields),
        guaranteedWinners: JSON.stringify(guaranteedWinners)
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave 💨").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    startLiveCountdown(createdGiveaway.id, message.client);
}