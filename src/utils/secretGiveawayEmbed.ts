import { TextChannel, EmbedBuilder } from "discord.js";
import { Giveaway } from "../models/Giveaway";
import { client } from "../index";
import { SecretGiveawaySettings } from "../models/SecretGiveaway";

const UPDATE_INTERVAL = 5 * 60 * 1000; // Every 5 minutes

export async function updateSecretGiveawaySummary(guildId: string) {
    try {
        const settings = await SecretGiveawaySettings.findOne({ where: { guildId } });
        if (!settings || !settings.get("summaryChannelId")) {
            console.warn(`⚠️ No secret giveaway summary channel configured for guild ${guildId}`);
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return console.error(`❌ Guild ${guildId} not found.`);
        
        const channelId = settings.summaryChannelId;
        if (!channelId) {
            console.error("❌ No summary channel ID found.");
            return;
        }

        const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel) {
            console.error(`❌ Channel with ID ${channelId} not found.`);
            return;
        }

        const activeGiveaways = await Giveaway.findAll({ where: { guildId, type: "secret" } });

        if (activeGiveaways.length === 0) {
            console.log("📌 No active secret giveaways.");
            return;
        }

        let totalParticipants = 0;
        let totalWinnersSelected = 0;
        let soonestEndTime = Infinity;

        for (const giveaway of activeGiveaways) {
            const participants = JSON.parse(giveaway.get("participants") ?? "[]");
            totalParticipants += participants.length;
            totalWinnersSelected += Math.min(participants.length, giveaway.get("winnerCount"));
            soonestEndTime = Math.min(soonestEndTime, giveaway.get("endsAt"));
        }

        const remainingTime = soonestEndTime - Math.floor(Date.now() / 1000);
        const formattedRemainingTime = remainingTime > 0 ? `<t:${soonestEndTime}:R>` : "✅ **Ended**";

        const embed = new EmbedBuilder()
            .setTitle("🎭 **Secret Giveaway Summary** 🎭")
            .setColor("DarkPurple")
            .setFields([
                { name: "🎟️ Total Participants", value: `${totalParticipants} users`, inline: true },
                { name: "🏆 Winners Selected", value: `${totalWinnersSelected}`, inline: true },
                { name: "⏳ Ends In", value: formattedRemainingTime, inline: true }
            ])
            .setFooter({ text: "Secret giveaways are still running! Stay alert!" });

        // ✅ **Check if Summary Message Exists**
        let summaryMessageId = settings.get("summaryMessageId");

        if (summaryMessageId) {
            try {
                const summaryMessage = await channel.messages.fetch(summaryMessageId);
                await summaryMessage.edit({ embeds: [embed] });
                return;
            } catch {
                console.log(`📌 Old summary message not found, creating a new one.`);
            }
        }

        // ✅ **Post New Summary Message if Not Found**
        const newMessage = await channel.send({ embeds: [embed] });
        await settings.update({ summaryMessageId: newMessage.id });

    } catch (error) {
        console.error("❌ Error updating Secret Giveaway Summary:", error);
    }
}

// ✅ **Auto-Update the Summary Every 5 Minutes**
setInterval(async () => {
    const allGuilds = await SecretGiveawaySettings.findAll();
    for (const settings of allGuilds) {
        await updateSecretGiveawaySummary(settings.get("guildId"));
    }
}, UPDATE_INTERVAL);