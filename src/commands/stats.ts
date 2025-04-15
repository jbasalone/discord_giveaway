import { Message, EmbedBuilder } from 'discord.js';
import { getUserStats } from '../utils/userStats';

export async function execute(message: Message, _args: string[]) {
    const mentioned = message.mentions.users.first();
    const target = mentioned ?? message.author;
    const guild = message.guild;
    if (!guild) return;

    const stats = await getUserStats(target.id, guild.id);

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${target.username}'s Giveaway Stats`,
            iconURL: target.displayAvatarURL(),
        })
        .setColor('Blurple')
        .addFields(
            { name: '🎟️ Joined Giveaways', value: `**${stats.joined}**`, inline: true },
            { name: '🏆 Won Giveaways', value: `**${stats.won}**`, inline: true },
            { name: '🔄 Rerolled From', value: `**${stats.rerolled}**`, inline: true }
        )
        .setFooter({ text: `Server: ${guild.name}`, iconURL: guild.iconURL() ?? undefined })
        .setTimestamp();

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
}