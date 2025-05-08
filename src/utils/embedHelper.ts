import { EmbedBuilder, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';


export function generateGiveawayEmbed(giveaway: Giveaway, message?: Message): EmbedBuilder {
    const participants: string[] = typeof giveaway.participants === "string"
        ? JSON.parse(giveaway.participants)
        : giveaway.participants;
    const timeRemaining = Math.max(0, giveaway.endsAt - Math.floor(Date.now() / 1000));

    // ✅ Clone the existing embed if `message` exists, otherwise create a new one
    const embed = message?.embeds[0]
        ? EmbedBuilder.from(message.embeds[0])
        : new EmbedBuilder().setTitle(giveaway.title).setColor('Gold');

    // ✅ Preserve all additional fields (`--field` entries)
    const existingFields = embed.data.fields?.filter(field => !["⏳ Ends In", "👥 Total Participants", "🏆 Winners"].includes(field.name)) || [];

    embed.setFields([
        { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
        { name: "👥 Total Participants", value: `${participants.length} users`, inline: true },
        { name: "⏳ Ends In", value: `${timeRemaining}s`, inline: true },
        ...existingFields // ✅ Keep user-defined fields in order
    ]);

    // ✅ Ensure description remains intact
    if (giveaway.description) {
        embed.setDescription(giveaway.description);
    }

    // ✅ Ensure the embed title is fully retained without truncation
    if (giveaway.title) {
        embed.setTitle(giveaway.title);
    }

    return embed;
}