import { Message, EmbedBuilder, TextChannel, PermissionsBitField } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { convertToMilliseconds } from '../utils/convertTime';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need `Administrator` permission to start a custom giveaway.");
    }

    if (args.length < 3) {
        return message.reply("❌ Usage: `!ga custom <title> <duration> <winners>` - Starts a Custom Giveaway.");
    }

    const title = args.slice(0, args.length - 2).join(" ");
    const durationArg = args[args.length - 2];
    const winnerCountArg = args[args.length - 1];

    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0) {
        return message.reply("❌ Invalid duration format. Example: `30s`, `5m`, `1h`.");
    }

    const winnerCount = parseInt(winnerCountArg, 10);
    if (isNaN(winnerCount) || winnerCount < 1) {
        return message.reply("❌ Winner count must be a positive number.");
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
    const channel = message.channel as TextChannel;
    const guildId = message.guild?.id;

    if (!guildId) {
        return message.reply("❌ Error: Unable to determine the server ID.");
    }

    let giveaway = await Giveaway.findOne({ where: { title } });
    if (giveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    const embed = new EmbedBuilder()
        .setTitle(`🎁 **Custom Giveaway: ${title}** 🎁`)
        .setDescription("React with 🎉 to enter!")
        .setColor("Blue")
        .addFields([
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
            { name: "🎟️ Participants", value: "0 users", inline: true }
        ]);

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Failed to send custom giveaway message:", error);
        return message.reply("❌ Could not start custom giveaway. Bot might lack permissions.");
    }

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

        await transaction.commit();
        console.log(`✅ Custom Giveaway successfully saved with messageId: ${giveawayData.get("messageId")}`);
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error saving custom giveaway:", error);
        return message.reply("❌ Failed to save the custom giveaway.");
    }

    if (!giveawayData?.id) {
        console.error("❌ Giveaway ID is undefined. Skipping countdown.");
        return message.reply("❌ Giveaway ID is missing, please check logs.");
    }

    startLiveCountdown(giveawayData.id, message.client);

    if (!giveawayMessage.url) {
        return message.reply(`✅ Custom Giveaway **${title}** started! Check the channel for the giveaway message.`);
    }

    return message.reply(`✅ Custom Giveaway **${title}** started! React with 🎉 in [this message](${giveawayMessage.url}).`);
}