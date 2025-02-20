import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        console.log(`🔍 Checking countdown for Giveaway ID: ${giveawayId}`);

        let giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) {
            console.warn(`⚠️ Giveaway not found for ID ${giveawayId}. Skipping countdown.`);
            return;
        }

        const channel = client.channels.cache.get(giveaway.get('channelId')) as TextChannel;
        if (!channel) {
            console.warn(`⚠️ Channel not found for Giveaway ID ${giveawayId}.`);
            return;
        }

        let updatedMessage: Message | null = null;
        try {
            updatedMessage = await channel.messages.fetch(giveaway.get('messageId'));
        } catch (error) {
            console.error(`❌ Could not fetch giveaway message ${giveaway.get('messageId')}. Skipping update.`);
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        const endsAt = giveaway.get('endsAt');
        const timeLeft = endsAt - currentTime;

        let embed = EmbedBuilder.from(updatedMessage.embeds[0]);

        // Ensure fields exist before modifying
        if (!embed.data.fields) embed.setFields([]);

        // Find "⏳ Ends In" field safely
        const timeRemainingIndex = embed.data.fields?.findIndex(f => f.name.includes('⏳ Ends In')) ?? -1;

        if (timeLeft <= 0) {
            console.log(`✅ Giveaway ${giveaway.get('id')} has ended, calling handleGiveawayEnd()`);

            // ✅ Set status to "🛑 Ended!"
            if (timeRemainingIndex !== -1) {
                embed.spliceFields(timeRemainingIndex, 1, {
                    name: '⏳ Status',
                    value: '🛑 Ended!',
                    inline: true
                });
            } else {
                embed.addFields({
                    name: '⏳ Status',
                    value: '🛑 Ended!',
                    inline: true
                });
            }

            await updatedMessage.edit({ embeds: [embed] });

            // ✅ Call handleGiveawayEnd to finalize giveaway
            await handleGiveawayEnd(client, giveaway.get('id'));

            return;
        }

        // ✅ Update existing countdown if giveaway is still running
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

        await updatedMessage.edit({ embeds: [embed] });

        // ✅ Schedule next update only if giveaway is still running
        const nextUpdateInMs = Math.min(5000, timeLeft * 1000);
        setTimeout(() => startLiveCountdown(giveawayId, client), nextUpdateInMs);

    } catch (error) {
        console.error('❌ Critical Error in `startLiveCountdown()`:', error);
    }
}