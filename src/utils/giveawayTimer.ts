import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        const giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) {
            console.warn(`[ERROR] [giveawayTimer.ts] ⚠️ Giveaway not found for ID ${giveawayId}. Skipping countdown.`);
            return;
        }

        const channel = client.channels.cache.get(giveaway.get("channelId")) as TextChannel;
        if (!channel) {
            console.warn(`⚠️ Channel not found for Giveaway ID ${giveawayId}.`);
            return;
        }

        const messageId = giveaway.get("messageId");
        if (!messageId || messageId === "PENDING") {
            console.warn(`⚠️ Giveaway ${giveawayId} has an invalid messageId: ${messageId}. Skipping update.`);
            return;
        }

        let updatedMessage: Message | null = null;
        try {
            updatedMessage = await channel.messages.fetch(messageId);
        } catch (error) {
            console.error(`[ERROR] ❌ Could not fetch giveaway message ${messageId}. Skipping update.`);
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        const endsAt = giveaway.get("endsAt");
        const timeLeft = endsAt - currentTime;

        const embed = EmbedBuilder.from(updatedMessage.embeds[0] || new EmbedBuilder().setTitle("Giveaway").setColor("Blue"));

        const participants: string[] = JSON.parse(giveaway.get("participants") || "[]");

        const currentFields = embed.data.fields ?? [];

        // ✅ Clean + update the fields
        const updatedFields = currentFields
            .filter(f => !["⏳ Ends In", "🎟️ Total Participants"].includes(f.name))
            .concat([
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true }
            ]);

        embed.setFields(...updatedFields);
        await updatedMessage.edit({ embeds: [embed] });

        // ✅ Ended condition
        if (timeLeft <= 0) {
            const exists = await Giveaway.findOne({ where: { id: giveawayId } });
            if (!exists) {
                console.warn(`⚠️ Giveaway ${giveawayId} already ended and removed.`);
                return;
            }

            console.log(`✅ Giveaway ${giveawayId} has ended. Freezing embed and processing...`);

            const embed = EmbedBuilder.from(updatedMessage.embeds[0] || new EmbedBuilder().setTitle("Giveaway").setColor("Red"));

            const frozenFields = (embed.data.fields ?? []).filter(
                f => !["⏳ Ends In", "🎟️ Total Participants"].includes(f.name)
            ).concat([
                { name: "⏳ Ends In", value: ":warning: Ended!", inline: true },
                { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true }
            ]);

            embed.setFields(...frozenFields);
            await updatedMessage.edit({ embeds: [embed] });

            // ✅ Call the official end processor
            await handleGiveawayEnd(client, giveawayId);

            return;
        }

        if (await Giveaway.findByPk(giveawayId)) {
            const nextUpdate = Math.min(5000, timeLeft * 1000);
            setTimeout(() => startLiveCountdown(giveawayId, client), nextUpdate);
        }

    } catch (error) {
        console.error("❌ Critical Error in `startLiveCountdown()`:", error);
    }
}