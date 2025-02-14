import { Message, EmbedBuilder, TextChannel, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need `Administrator` permission to start a miniboss giveaway.");
    }

    if (rawArgs.length < 2) {
        return message.reply("❌ Usage: `!ga miniboss <title> <duration> --force --field \"name: value\"`.");
    }

    // ✅ Fix: Proper Argument Parsing
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let forceMode = false;

    // ✅ Separate `--field` and `--force`
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--force") {
            forceMode = true;
        } else if (args[i] === "--field" && args[i + 1]) {
            fieldArgs.push(args[i + 1]);
            i++; // Skip next argument
        } else {
            mainArgs.push(args[i]);
        }
    }

    // ✅ Ensure at least `title` and `duration` exist
    if (mainArgs.length < 2) {
        return message.reply("❌ Invalid format! Example: `!ga miniboss \"Mega Boss\" 30s --field \"Requirement: Level 10+\"`.");
    }

    // ✅ Extract Title & Duration
    const durationArg = mainArgs.pop()!;
    const title = mainArgs.join(" ");

    const duration = convertToMilliseconds(durationArg);
    if (duration <= 0) {
        return message.reply("❌ Invalid duration format! Example: `30s`, `5m`, `1h`.");
    }

    const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
    const channel = message.channel as TextChannel;
    const guildId = message.guild?.id;

    if (!guildId) {
        return message.reply("❌ Error: Unable to determine the server ID.");
    }

    // ✅ Check for existing miniboss giveaways
    let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
    if (existingGiveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    // ✅ Parse `--field` arguments correctly
    let extraFields: Record<string, string> = {};
    for (let field of fieldArgs) {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    }

    // ✅ Adjust Required Participants Based on `--force`
    const requiredParticipants = forceMode ? 1 : 9;

    // ✅ Create Miniboss Giveaway Embed
    const embed = new EmbedBuilder()
        .setTitle(`🐲 **Miniboss Giveaway: ${title}** 🐲`)
        .setDescription("React with 🐉 to enter!")
        .setColor("DarkRed")
        .setFields([
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Required Participants", value: forceMode ? "⚡ **Instant Start Enabled**" : "9 Required", inline: true },
            { name: "🎟️ Current Participants", value: "0 users", inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Failed to send miniboss giveaway message:", error);
        return message.reply("❌ Could not start miniboss giveaway. Bot might lack permissions.");
    }

    if (!giveawayMessage.id) {
        return message.reply("❌ Giveaway message failed to send.");
    }

    // ✅ Add Join/Leave Buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🐉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    let transaction = await Giveaway.sequelize?.transaction();
    if (!transaction) {
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
            winnerCount: requiredParticipants, // ✅ Ensures 9 or 1 based on `--force`
            extraFields: JSON.stringify(extraFields),
            forceStart: forceMode
        }, { transaction });

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        return message.reply("❌ Failed to save the miniboss giveaway.");
    }

    startLiveCountdown(giveawayData.id, message.client);

    return message.reply(`✅ Miniboss Giveaway **${title}** started! React with 🐉 in [this message](${giveawayMessage.url}).`);
}