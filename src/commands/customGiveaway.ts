import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, args: string[]) {
    try {
        if (args.length < 3) {
            return message.reply("❌ Invalid usage! Example: `!ga custom \"Mega Prize\" 10m 3 --field \"Requirement: Level 50+\"`");
        }

        const titleMatch = message.content.match(/"(.+?)"/);
        const title = titleMatch ? titleMatch[1] : '🎉 Custom Giveaway 🎉';

        const durationArg = args.find(arg => arg.match(/\d+[smhd]/)) || '1m';
        const winnerCountArg = args.find(arg => !isNaN(Number(arg))) || '1';

        const duration = convertToMilliseconds(durationArg);
        if (duration <= 0) return message.reply("❌ Invalid duration!");

        const winnerCount = parseInt(winnerCountArg, 10);
        if (isNaN(winnerCount) || winnerCount < 1) return message.reply("❌ Invalid winner count!");

        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
        const channel = message.channel as TextChannel;
        const guildId = message.guild?.id;

        if (!guildId) {
            return message.reply("❌ This command must be used in a server.");
        }

        // ✅ Extract & store named `--field` values correctly
        const extraFields: { name: string; value: string }[] = [];
        const fieldRegex = /--field\s"(.+?):\s(.+?)"/g;
        let match: RegExpExecArray | null;

        while ((match = fieldRegex.exec(message.content)) !== null) {
            const fieldName = match[1]?.trim() || `📌 Info`;
            const fieldValue = match[2]?.trim() || "No description provided";

            if (fieldName && fieldValue && !extraFields.some(field => field.name === `📌 ${fieldName}`)) {
                extraFields.push({ name: `📌 ${fieldName}`, value: fieldValue });
            }
        }

        // ✅ Ensure giveaway is correctly stored
        const giveawayData = await Giveaway.create({
            guildId, // ✅ Fix: Store guild ID
            host: message.author.id,
            channelId: channel.id,
            messageId: null, // ✅ Correctly initialize messageId
            title,
            description: 'React with 🎉 to enter!',
            role: null,
            duration,
            endsAt,
            participants: JSON.stringify([]), // ✅ Ensure correct JSON array storage
            winnerCount,
            extraFields: JSON.stringify(extraFields)
        });

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription("React with 🎉 to enter!")
            .setColor("Gold")
            .setFields([
                ...extraFields,
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
                { name: "🎟️ Total Participants", value: `0 users`, inline: true }
            ]);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join-${giveawayData.id}`).setLabel('Join 🎉').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`leave-${giveawayData.id}`).setLabel('Leave ❌').setStyle(ButtonStyle.Danger)
        );

        const giveawayMessage = await channel.send({ embeds: [embed] });

        giveawayData.messageId = giveawayMessage.id;
        await giveawayData.save();

        // ✅ Start the live countdown after saving
        startLiveCountdown(giveawayData.id, client);

        return message.reply(`✅ Giveaway started! React with 🎉 in [this message](${giveawayMessage.url}).`);
    } catch (error) {
        console.error("❌ Error starting custom giveaway:", error);
        return message.reply("❌ Failed to start the giveaway. Please check logs.");
    }
}