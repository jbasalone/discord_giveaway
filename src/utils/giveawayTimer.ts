import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        const giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) {
            console.warn(`⚠️ Giveaway not found for ID ${giveawayId}. Skipping countdown.`);
            return;
        }

        const channel = client.channels.cache.get(giveaway.get("channelId")) as TextChannel;
        if (!channel) {
            console.warn(`⚠️ Channel not found for Giveaway ID ${giveawayId}.`);
            return;
        }

        if (!giveaway.get("messageId")) {
            console.warn(`⚠️ No messageId found for Giveaway ID ${giveawayId}. Skipping update.`);
            return;
        }

        let updatedMessage: Message<true> | null = null;
        try {
            updatedMessage = await channel.messages.fetch(giveaway.get("messageId"));
        } catch (error) {
            console.error(`❌ Could not fetch giveaway message ${giveaway.get("messageId")}. Skipping update.`);
            return;
        }

        if (!updatedMessage || !updatedMessage.embeds.length) {
            console.warn(`⚠️ Giveaway message missing embeds for ID ${giveawayId}.`);
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);

        // ✅ **If the giveaway has ended, call handleGiveawayEnd**
        if (giveaway.get("endsAt") <= currentTime) {
            console.log(`✅ Giveaway ${giveawayId} has ended, processing winners.`);
            await handleGiveawayEnd(client);

            // ✅ Stop countdown loop
            return;
        }

        // ✅ **Update the embed if giveaway is still running**
        const embed = EmbedBuilder.from(updatedMessage.embeds[0])
            .setFields([
                { name: "🎟️ Total Participants", value: `${JSON.parse(giveaway.get("participants") || "[]").length} users`, inline: true },
                { name: "🏆 Winners", value: `${giveaway.get("winnerCount") ?? "N/A"}`, inline: true },
                { name: "⏳ Ends In", value: `<t:${giveaway.get("endsAt") ?? currentTime}:R>`, inline: true }
            ])
            .setColor("Gold");

        await updatedMessage.edit({ embeds: [embed] });

        // ✅ **Only continue countdown if giveaway is still active**
        const timeLeft = giveaway.get("endsAt") - currentTime;
        if (timeLeft > 0) {
            setTimeout(() => startLiveCountdown(giveawayId, client), 10000); // Update every 10s
        }

    } catch (error) {
        console.error("❌ Error updating giveaway countdown:", error);
    }
}