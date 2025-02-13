import { EmbedBuilder, TextChannel, Client, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';

/**
 * Updates the giveaway embed in Discord when participants change.
 *
 * @param giveaway The giveaway object that needs an embed update.
 * @param client The Discord client instance.
 */
export async function updateGiveawayEmbed(giveaway: Giveaway, client: Client) {
    try {
        // ✅ Fetch the channel where the giveaway is running
        const channel = client.channels.cache.get(giveaway.channelId) as TextChannel;
        if (!channel) {
            console.warn(`⚠️ Channel not found for Giveaway ID ${giveaway.id}.`);
            return;
        }

        // ✅ Fetch the giveaway message
        let giveawayMessage: Message;
        try {
            giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        } catch (error) {
            console.error(`❌ Could not fetch giveaway message ${giveaway.messageId}. Skipping update.`);
            return;
        }

        // ✅ Parse participant data and extra fields
        const participants = JSON.parse(giveaway.participants || "[]");
        const extraFields = giveaway.extraFields ? JSON.parse(giveaway.extraFields) : {};

        // ✅ Update the giveaway embed
        const embed = EmbedBuilder.from(giveawayMessage.embeds[0]);
        embed.setFields([
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
            { name: "⏳ Ends In", value: `<t:${giveaway.endsAt}:R>`, inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value: String(value), inline: true })),  // ✅ Convert `value` to `string`
        ]);

        // ✅ Apply embed updates
        await giveawayMessage.edit({ embeds: [embed] });
        console.log(`✅ Successfully updated giveaway embed for ID ${giveaway.id}`);

    } catch (error) {
        console.error("❌ Error updating giveaway embed:", error);
    }
}