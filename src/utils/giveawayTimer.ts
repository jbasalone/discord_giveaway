import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        const giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) return;

        const channel = client.channels.cache.get(giveaway.channelId) as TextChannel;
        if (!channel) return;

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

        if (!updatedMessage || !updatedMessage.embeds.length) return;

        const embed = EmbedBuilder.from(updatedMessage.embeds[0]);

        // ✅ **Ensure participants are correctly parsed**
        let participants: string[] = [];
        try {
            participants = typeof giveaway.participants === "string"
                ? JSON.parse(giveaway.participants)
                : giveaway.participants;
            if (!Array.isArray(participants)) participants = [];
        } catch (error) {
            console.error(`❌ Error parsing participants for Giveaway ${giveawayId}:`, error);
            participants = [];
        }

        // ✅ **Ensure `extraFields` persist without duplication**
        let extraFields: { name: string; value: string }[] = [];
        try {
            extraFields = typeof giveaway.extraFields === "string"
                ? JSON.parse(giveaway.extraFields)
                : giveaway.extraFields;
            if (!Array.isArray(extraFields)) extraFields = [];
        } catch (error) {
            console.error(`❌ Error parsing extraFields for Giveaway ${giveawayId}:`, error);
            extraFields = [];
        }

        // ✅ **Ensure Giveaway Stops When It Ends**
        const currentTime = Math.floor(Date.now() / 1000);
        if (giveaway.endsAt <= currentTime) {
            console.log(`✅ Giveaway ${giveawayId} has ended, stopping countdown.`);

            embed.setFields([
                { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
                { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
                { name: "⏳ Status", value: "🛑 Ended!", inline: true } // ✅ Status changed to "Ended"
            ]);

            await updatedMessage.edit({ embeds: [embed] });

            return; // ✅ Stop countdown after updating the message
        }

        // ✅ **Update active countdown without duplicating fields**
        embed.setFields([
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
            { name: "⏳ Ends In", value: `<t:${giveaway.endsAt}:R>`, inline: true }
        ]);

        await updatedMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Error updating giveaway countdown:", error);
    }
}