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
        const endsAt = giveaway.get("endsAt");

        // ✅ **Check if the giveaway has ended**
        if (endsAt <= currentTime) {
            console.log(`✅ Giveaway ${giveawayId} has ended, processing winners immediately.`);
            await handleGiveawayEnd(client);
            return; // Stop further updates
        }

        // ✅ Fix `extraFields` Parsing
        const rawExtraFields = giveaway.get("extraFields") ?? "{}";
        let extraFields;
        try {
            extraFields = JSON.parse(rawExtraFields);
        } catch (error) {
            console.error(`❌ Error parsing extraFields for Giveaway ${giveawayId}:`, error);
            extraFields = {};
        }

        // ✅ **Update Embed with Retained Fields**
        const embed = EmbedBuilder.from(updatedMessage.embeds[0])
            .setFields([
                { name: "🎟️ Total Participants", value: `${JSON.parse(giveaway.get("participants") || "[]").length} users`, inline: true },
                { name: "🏆 Winners", value: `${giveaway.get("winnerCount") ?? "N/A"}`, inline: true },
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value: String(value), inline: true }))
            ])
            .setColor("Gold");

        await updatedMessage.edit({ embeds: [embed] });

        // ✅ **Schedule Next Countdown Update**
        const timeLeft = endsAt - currentTime;
        if (timeLeft > 0) {
            setTimeout(() => startLiveCountdown(giveawayId, client), 5000); // Update every 5s
        } else {
            console.log(`✅ Timer hit 0 for Giveaway ${giveawayId}, calling handleGiveawayEnd.`);
            await handleGiveawayEnd(client); // Call ending function immediately
        }

    } catch (error) {
        console.error("❌ Error updating giveaway countdown:", error);
    }
}