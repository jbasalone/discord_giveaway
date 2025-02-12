import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, args: string[]) {
    try {
        if (args.length < 2) return message.reply("❌ Invalid usage! Example: `!ga create 30s 1`");

        const durationArg = args[0];
        const winnerCountArg = args[1];

        const duration = convertToMilliseconds(durationArg);
        if (duration <= 0) return message.reply("❌ Invalid duration!");

        const winnerCount = parseInt(winnerCountArg, 10);
        if (isNaN(winnerCount) || winnerCount < 1) return message.reply("❌ Invalid winner count!");

        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
        const channel = message.channel as TextChannel;
        const guildId = message.guild?.id;

        if (!guildId) {
            console.error("❌ Guild ID is missing.");
            return message.reply("❌ Error: Unable to determine the server ID.");
        }

        const embed = new EmbedBuilder()
            .setTitle("🎉 Giveaway 🎉")
            .setDescription("React with 🎉 to enter!")
            .setColor("Gold")
            .setFields([
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
                { name: "🎟️ Total Participants", value: "0 users", inline: true }
            ]);

        const giveawayMessage = await channel.send({ embeds: [embed] });

        const giveawayData = await Giveaway.create({
            guildId,
            host: message.author.id,
            channelId: channel.id,
            messageId: giveawayMessage.id,
            title: "🎉 Giveaway 🎉",
            description: "React with 🎉 to enter!",
            role: null,
            duration,
            endsAt,
            participants: JSON.stringify([]),
            winnerCount
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join-${giveawayData.id}`).setLabel('Join 🎉').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`leave-${giveawayData.id}`).setLabel('Leave ❌').setStyle(ButtonStyle.Danger)
        );

        await giveawayMessage.edit({ components: [row] });

        startLiveCountdown(giveawayData.id, client);

        return message.reply(`✅ Giveaway started! React with 🎉 in [this message](${giveawayMessage.url}).`);
    } catch (error) {
        console.error("❌ Error starting giveaway:", error);
        return message.reply("❌ Failed to start the giveaway. Please check logs.");
    }
}