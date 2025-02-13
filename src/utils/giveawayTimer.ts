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

        if (!giveaway.messageId) {
            console.warn(`⚠️ No messageId found for Giveaway ID ${giveawayId}. Skipping update.`);
            return;
        }

        let updatedMessage: Message<true> | null = null;
        try {
            updatedMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (error) {
            console.error(`❌ Could not fetch giveaway message ${giveaway.messageId}. Skipping update.`);
            return;
        }

        if (!updatedMessage || !updatedMessage.embeds.length) {
            console.warn(`⚠️ Giveaway message missing embeds for ID ${giveawayId}.`);
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);

        // ✅ **If the giveaway has ended, call handleGiveawayEnd**
        if (giveaway.endsAt <= currentTime) {
            console.log(`✅ Giveaway ${giveawayId} has ended, processing winners.`);
            await handleGiveawayEnd(client);

            // ✅ Update Embed to Show Giveaway is Ended
            const embed = EmbedBuilder.from(updatedMessage.embeds[0])
                .setFields([
                    { name: "🎟️ Total Participants", value: `${JSON.parse(giveaway.participants || "[]").length} users`, inline: true },
                    { name: "🏆 Winners", value: "Selecting...", inline: true },
                    { name: "⏳ Status", value: "🛑 Ended!", inline: true }
                ])
                .setColor("Red");

            await updatedMessage.edit({ embeds: [embed] });
            return;
        }

        // ✅ **Update the embed if giveaway is still running**
        const embed = EmbedBuilder.from(updatedMessage.embeds[0])
            .setFields([
                { name: "🎟️ Total Participants", value: `${JSON.parse(giveaway.participants || "[]").length} users`, inline: true },
                { name: "🏆 Winners", value: `${giveaway?.winnerCount ?? "N/A"}`, inline: true },
                { name: "⏳ Ends In", value: `<t:${giveaway?.endsAt ?? currentTime}:R>`, inline: true }
            ])
            .setColor("Gold");

        await updatedMessage.edit({ embeds: [embed] });

        // ✅ Schedule next countdown check
        setTimeout(() => startLiveCountdown(giveawayId, client), 30000); // Repeat every 30 seconds

    } catch (error) {
        console.error("❌ Error updating giveaway countdown:", error);
    }
}