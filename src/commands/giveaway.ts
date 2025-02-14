import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, rawArgs: string[]) {
    try {
        if (rawArgs.length < 3) {
            return message.reply("❌ Invalid usage! Example: `!ga create \"Test Giveaway\" 30s 1`");
        }

        // ✅ **Fix: Proper Argument Parsing**
        const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

        if (args.length < 3) {
            return message.reply("❌ Invalid format! Example: `!ga create \"Test Giveaway\" 30s 1`");
        }

        // ✅ Extract **Title**, **Duration**, and **Winner Count**
        const title = args.slice(0, args.length - 2).join(" ");
        const durationArg = args[args.length - 2];
        const winnerCountArg = args[args.length - 1];

        const duration = convertToMilliseconds(durationArg);
        if (duration <= 0) {
            return message.reply("❌ Invalid duration format! Example: `30s`, `5m`, `1h`.");
        }

        const winnerCount = parseInt(winnerCountArg, 10);
        if (isNaN(winnerCount) || !Number.isInteger(winnerCount) || winnerCount < 1) {
            return message.reply("❌ Winner count must be a **whole positive number** (e.g., `1`, `5`, `10`).");
        }

        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
        const channel = message.channel as TextChannel;
        const guildId = message.guild?.id;

        if (!guildId) {
            console.error("❌ Guild ID is missing.");
            return message.reply("❌ Error: Unable to determine the server ID.");
        }

        // ✅ Ensure No Duplicate Giveaway Titles
        let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
        if (existingGiveaway) {
            return message.reply("⚠️ A giveaway with this title **already exists**. Please choose a **different title**.");
        }

        // ✅ Create the Giveaway Embed
        const embed = new EmbedBuilder()
            .setTitle(`🎉 **${title}** 🎉`)
            .setDescription("React with 🎉 to enter!")
            .setColor("Gold")
            .setFields([
                { name: "🎟️ Total Participants", value: "0 users", inline: true },
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🏆 Winners", value: `${winnerCount}`, inline: true }
            ]);

        let giveawayMessage;
        try {
            giveawayMessage = await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error("❌ Failed to send giveaway message:", error);
            return message.reply("❌ Could not start giveaway. Bot might lack permissions.");
        }

        if (!giveawayMessage.id) {
            console.error("❌ Error: Message ID is undefined!");
            return message.reply("❌ Giveaway message failed to send.");
        }

        // ✅ Create Join/Leave Buttons
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
        );

        await giveawayMessage.edit({ components: [row] });

        // ✅ Ensure transaction is properly handled
        const transaction = await Giveaway.sequelize?.transaction();
        if (!transaction) {
            console.error("❌ Unable to initialize database transaction.");
            return message.reply("❌ Database error. Try again later.");
        }

        let giveawayData;
        try {
            giveawayData = await Giveaway.create({
                guildId,
                host: message.author.id,
                channelId: channel.id,
                messageId: giveawayMessage.id,
                title,
                description: "React with 🎉 to enter!",
                duration,
                endsAt,
                participants: JSON.stringify([]),
                winnerCount
            }, { transaction });

            await transaction.commit(); // ✅ Ensure transaction completes
            console.log(`✅ Giveaway successfully saved with messageId: ${giveawayData.get("messageId")}`);
        } catch (error) {
            await transaction.rollback();
            console.error("❌ Error saving giveaway:", error);
            return message.reply("❌ Failed to save the giveaway.");
        }

        // ✅ Fix: Ensure giveawayData.id exists before calling countdown
        if (!giveawayData?.id) {
            console.error("❌ Giveaway ID is undefined. Skipping countdown.");
            return message.reply("❌ Giveaway ID is missing, please check logs.");
        }

        startLiveCountdown(giveawayData.id, client);

        // ✅ Fix: Ensure giveawayMessage.url exists before replying
        if (!giveawayMessage.url) {
            console.warn("⚠️ Giveaway message URL is missing.");
            return message.reply("✅ Giveaway started! Check the channel for the giveaway message.");
        }

        return message.reply(`✅ Giveaway **"${title}"** started! React with 🎉 in [this message](${giveawayMessage.url}).`);
    } catch (error) {
        console.error("❌ Error starting giveaway:", error);
        return message.reply("❌ Failed to start the giveaway. Please check logs.");
    }
}