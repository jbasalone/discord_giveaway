import {
    EmbedBuilder,
    TextChannel,
    Client,
    Message,
    EmbedField
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { handleGiveawayEnd } from '../events/giveawayEnd';

// ✅ Patch fields by name, preserving order and all other fields
function patchFields(
    existing: EmbedField[] = [],
    updates: EmbedField[]
): EmbedField[] {
    const updateMap = new Map(updates.map(f => [f.name, f]));
    const seen = new Set<string>();
    const result: EmbedField[] = [];

    for (const field of existing) {
        if (updateMap.has(field.name)) {
            result.push(updateMap.get(field.name)!);
            seen.add(field.name);
        } else {
            result.push({
                name: field.name,
                value: field.value,
                inline: field.inline ?? false
            });
        }
    }

    // Append any update fields not already present
    for (const field of updates) {
        if (!seen.has(field.name)) {
            result.push(field);
        }
    }

    return result;
}

export async function startLiveCountdown(giveawayId: number, client: Client) {
    try {
        const giveaway = await Giveaway.findByPk(giveawayId);
        if (!giveaway) return console.warn(`[Timer] ❌ Giveaway ${giveawayId} not found.`);

        const channel = client.channels.cache.get(giveaway.get("channelId")) as TextChannel;
        if (!channel) return console.warn(`[Timer] ❌ Channel not found for ${giveawayId}.`);

        const messageId = giveaway.get("messageId");
        if (!messageId || messageId === "PENDING") return;

        const giveawayMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (!giveawayMessage) return;

        const participants: string[] = JSON.parse(giveaway.get("participants") || "[]");
        const endsAt = giveaway.get("endsAt");
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = endsAt - now;

        const embed = EmbedBuilder.from(giveawayMessage.embeds[0] || new EmbedBuilder().setColor("Blue"));
        const countdownFields: EmbedField[] = [
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true }
        ];

        embed.setFields(...patchFields(embed.data.fields as EmbedField[] ?? [], countdownFields));
        await giveawayMessage.edit({ embeds: [embed] });

        // ✅ Giveaway has ended
        if (timeLeft <= 0) {
            console.log(`⏰ [Timer] Ending Giveaway ${giveawayId}...`);

            const finalEmbed = EmbedBuilder.from(embed).setColor("Red");
            const freezeFields: EmbedField[] = [
                { name: "⏳ Ends In", value: ":warning: Ended!", inline: true },
                { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true }
            ];

            finalEmbed.setFields(...patchFields(finalEmbed.data.fields as EmbedField[] ?? [], freezeFields));
            await giveawayMessage.edit({ embeds: [finalEmbed] });

            await handleGiveawayEnd(client, giveawayId);
            return;
        }

        if (await Giveaway.findByPk(giveawayId)) {
            setTimeout(() => startLiveCountdown(giveawayId, client), Math.min(5000, timeLeft * 1000));
        }

    } catch (err) {
        console.error("❌ [Timer] startLiveCountdown() error:", err);
    }
}