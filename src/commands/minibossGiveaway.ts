import { Message, EmbedBuilder, TextChannel, PermissionsBitField } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { convertToMilliseconds } from '../utils/convertTime';

export async function execute(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need `Administrator` permission to start a miniboss giveaway.");
    }

    if (args.length < 2) {
        return message.reply("❌ Usage: `!ga miniboss <title> <duration>` - Starts a Miniboss Giveaway.");
    }

    const title = args.slice(0, args.length - 1).join(" ");
    const durationArg = args[args.length - 1];

    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0) {
        return message.reply("❌ Invalid duration format. Example: `30s`, `5m`, `1h`.");
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
    const channel = message.channel as TextChannel;
    const guildId = message.guild?.id;

    if (!guildId) {
        return message.reply("❌ Error: Unable to determine the server ID.");
    }

    // ✅ **Check for Duplicate Giveaway Titles**
    let giveaway = await Giveaway.findOne({ where: { title } });
    if (giveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    // ✅ **Create Giveaway Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🐲 **Miniboss Giveaway: ${title}** 🐲`)
        .setDescription("React with 🐉 to enter!")
        .setColor("DarkRed")
        .addFields([
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: "Auto-Claim (Miniboss Mode)", inline: true },
            { name: "🎟️ Participants", value: "0 users", inline: true }
        ]);

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Failed to send miniboss giveaway message:", error);
        return message.reply("❌ Could not start miniboss giveaway. Bot might lack permissions.");
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
            description: "React with 🐉 to enter!",
            duration,
            endsAt,
            participants: JSON.stringify([]),
            winnerCount: 1 // ✅ Ensure winner count is explicitly set
        }, { transaction });

        await transaction.commit();
        console.log(`✅ Miniboss Giveaway successfully saved with messageId: ${giveawayData.get("messageId")}`);
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error saving miniboss giveaway:", error);
        return message.reply("❌ Failed to save the miniboss giveaway.");
    }

    if (!giveawayData?.id) {
        console.error("❌ Giveaway ID is undefined. Skipping countdown.");
        return message.reply("❌ Giveaway ID is missing, please check logs.");
    }

    startLiveCountdown(giveawayData.id, message.client);

    if (!giveawayMessage.url) {
        return message.reply(`✅ Miniboss Giveaway **${title}** started! Check the channel for the giveaway message.`);
    }

    return message.reply(`✅ Miniboss Giveaway **${title}** started! React with 🐉 in [this message](${giveawayMessage.url}).`);
}