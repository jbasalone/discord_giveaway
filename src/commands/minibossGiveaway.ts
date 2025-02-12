import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, args: string[]) {
    try {
        if (args.length < 2) return message.reply("❌ Invalid usage! Example: `!ga miniboss \"Boss Battle\" 10m --force --field \"Requirement: Level 50+\"`");

        const titleMatch = message.content.match(/"(.+?)"/);
        const title = titleMatch ? titleMatch[1] : '🎉 Miniboss Giveaway 🎉';

        const durationArg = args.find(arg => arg.match(/\d+[smhd]/)) || '10m';
        const forceStart = args.includes("--force");

        const duration = convertToMilliseconds(durationArg);
        if (duration <= 0) return message.reply("❌ Invalid duration!");

        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
        const channel = message.channel as TextChannel;
        const guildId = message.guild?.id;

        if (!guildId) {
            console.error("❌ Guild ID is missing.");
            return message.reply("❌ Error: Unable to determine the server ID.");
        }

        // ✅ Extract `--field` arguments properly
        const fieldRegex = /--field\s"(.+?):\s(.+?)"/g;
        let extraFields: { name: string; value: string }[] = [];
        let match;

        while ((match = fieldRegex.exec(message.content)) !== null) {
            const fieldName = match?.[1]?.trim() || `📌 Info`;
            const fieldValue = match?.[2]?.trim() || "No description provided";

            if (fieldName && fieldValue && !extraFields.some((field) => field.name === `📌 ${fieldName}`)) {
                extraFields.push({ name: `📌 ${fieldName}`, value: fieldValue });
            }
        }

        // ✅ Create and save giveaway in the database
        const giveawayData = await Giveaway.create({
            guildId, // ✅ Ensures guildId is always stored
            host: message.author.id,
            channelId: channel.id,
            messageId: null,
            title,
            description: 'React with 🎉 to enter!',
            role: null,
            duration,
            endsAt,
            participants: JSON.stringify([]), // ✅ Initialize properly
            winnerCount: 9,
            extraFields: JSON.stringify(extraFields),
            forceStart,
        });

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription("React with 🎉 to enter!")
            .setColor("Gold")
            .setFields([
                ...extraFields,
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🏆 Winners", value: "9", inline: true },
                { name: "🎟️ Total Participants", value: "0 users", inline: true }
            ]);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join-${giveawayData.id}`).setLabel('Join 🎉').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`leave-${giveawayData.id}`).setLabel('Leave ❌').setStyle(ButtonStyle.Danger)
        );

        const giveawayMessage = await channel.send({ embeds: [embed] });

        giveawayData.messageId = giveawayMessage.id;
        await giveawayData.save();

        console.log(`✅ Miniboss Giveaway ${giveawayData.id} started!`);

        startLiveCountdown(giveawayData.id, client);
    } catch (error) {
        console.error("❌ Error starting miniboss giveaway:", error);
    }
}