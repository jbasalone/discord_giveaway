import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        let giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) {
            console.warn(`[ERROR] [giveawayTimer.ts] ⚠️ Giveaway not found for ID ${giveawayId}. Skipping countdown.`);
            return;
        }

        const channel = client.channels.cache.get(giveaway.get('channelId')) as TextChannel;
        if (!channel) {
            console.warn(`⚠️ Channel not found for Giveaway ID ${giveawayId}.`);
            return;
        }

        const messageId = giveaway.get('messageId');

        // ✅ Ensure messageId is valid before attempting to fetch
        if (!messageId || messageId === "PENDING") {
            console.warn(`⚠️ Giveaway ${giveawayId} has an invalid messageId: ${messageId}. Skipping update.`);
            return;
        }

        let updatedMessage: Message | null = null;
        try {
            updatedMessage = await channel.messages.fetch(messageId);
        } catch (error) {
            console.error(`[ERROR] [giveawayTimer.ts] ❌ Could not fetch giveaway message ${messageId}. Skipping update.`);
            return;
        }

        // ✅ Ensure updatedMessage is not null before proceeding
        if (!updatedMessage) {
            console.warn(`[ERROR] [giveawayTimer.ts] ⚠️ updatedMessage is null for Giveaway ${giveawayId}. Skipping update.`);
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        const endsAt = giveaway.get('endsAt');
        const timeLeft = endsAt - currentTime;

        let embed = EmbedBuilder.from(updatedMessage.embeds[0] || new EmbedBuilder().setTitle("Giveaway").setColor("Blue"));

        // ✅ Fetch latest participant count from the database
        let participants: string[] = JSON.parse(giveaway.get('participants') || '[]');
        const participantCount = participants.length;

        // Ensure fields exist before modifying
        if (!embed.data.fields) embed.setFields([]);

        // Find "⏳ Ends In" field safely
        const timeRemainingIndex = embed.data.fields?.findIndex(f => f.name.includes('⏳ Ends In')) ?? -1;
        const participantsIndex = embed.data.fields?.findIndex(f => f.name.includes('🎟️ Total Participants')) ?? -1;

        if (timeLeft <= 0) {
            console.log(`✅ Giveaway ${giveawayId} has ended, checking if it's already being processed...`);

            const existingGiveaway = await Giveaway.findOne({ where: { id: giveawayId } });
            if (!existingGiveaway) {
                console.warn(`⚠️ Giveaway ${giveawayId} is already processed and removed.`);
                return;
            }

            console.log(`✅ Processing giveaway ${giveawayId} for ending.`);
            await handleGiveawayEnd(client, giveawayId);
            return;
        }

        // ✅ Update only the "Ends In" and "Total Participants" fields
        if (timeRemainingIndex !== -1) {
            embed.spliceFields(timeRemainingIndex, 1, {
                name: '⏳ Ends In',
                value: `<t:${endsAt}:R>`,
                inline: true
            });
        } else {
            embed.addFields({
                name: '⏳ Ends In',
                value: `<t:${endsAt}:R>`,
                inline: true
            });
        }

        // ✅ Ensure "Total Participants" field is updated properly
        if (participantsIndex !== -1) {
            embed.spliceFields(participantsIndex, 1, {
                name: '🎟️ Total Participants',
                value: `${participantCount} users`,
                inline: true
            });
        } else {
            embed.addFields({
                name: '🎟️ Total Participants',
                value: `${participantCount} users`,
                inline: true
            });
        }

        // ✅ Check again if updatedMessage is valid before editing
        if (updatedMessage) {
            await updatedMessage.edit({ embeds: [embed] });
        } else {
            console.warn(`[ERROR] [giveawayTimer.ts] ❌ updatedMessage is unexpectedly null when trying to update.`);
        }

        // ✅ Schedule next update only if giveaway is still running
        const nextUpdateInMs = Math.min(5000, timeLeft * 1000);
        setTimeout(() => startLiveCountdown(giveawayId, client), nextUpdateInMs);

    } catch (error) {
        console.error('❌ Critical Error in `startLiveCountdown()`:', error);
    }
}