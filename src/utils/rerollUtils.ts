import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { getJoinersFromDb, getJoinerMetaFromDb } from './rerollCache';

function extractMentionedUserIds(embed: EmbedBuilder | any): string[] {
    if (!embed || !embed.fields) return [];
    const winnerField = embed.fields.find((f: any) => f.name.includes("🏆"));
    if (!winnerField) return [];
    return [...winnerField.value.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
}

export async function rerollWinnersByMessageId(client: Client, messageId: string): Promise<string[]> {
    const participants = await getJoinersFromDb(messageId);
    if (!participants.length) {
        console.warn(`⚠️ No participants found for messageId ${messageId}`);
        return [];
    }

    const meta = await getJoinerMetaFromDb(messageId);
    if (!meta?.guildId || !meta.channelId) {
        console.warn(`⚠️ Meta info missing for messageId ${messageId}`);
        return [];
    }

    const guild = await client.guilds.fetch(meta.guildId).catch(() => null);
    if (!guild) {
        console.warn(`❌ Guild ${meta.guildId} not found.`);
        return [];
    }

    const channel = await guild.channels.fetch(meta.channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) {
        console.warn(`❌ Channel ${meta.channelId} not found or is not a TextChannel`);
        return [];
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
        console.warn(`❌ Message ${messageId} not found in channel ${channel.id}`);
        return [];
    }

    const originalEmbed = message.embeds[0];
    if (!originalEmbed) {
        console.warn(`❌ No embed found in message ${messageId}`);
        return [];
    }

    const prevWinnerIds = extractMentionedUserIds(originalEmbed);
    const eligible = participants.filter(p => !prevWinnerIds.includes(p));

    if (!eligible.length) {
        console.warn(`⚠️ No eligible participants to reroll`);
        return [];
    }

    const winnerCount = Number(meta.winnerCount ?? 1);
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const newWinners = shuffled.slice(0, winnerCount);
    const mentions = newWinners.map(id => `<@${id}>`).join(", ");

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setFields(
            ...(originalEmbed.fields?.filter(f => !f.name.includes("🏆 Rerolled Winners")) ?? []),
            {
                name: "🏆 Rerolled Winners",
                value: mentions,
                inline: true,
            },
            {
                name: "🕑 Rerolled At",
                value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
                inline: true,
            },
            {
                name: "🎯 Reroll Summary",
                value: `🎟️ ${participants.length} participants\n🏆 ${winnerCount} winners`,
                inline: false,
            }
        );

    await message.edit({ embeds: [updatedEmbed] });

    return newWinners;
}