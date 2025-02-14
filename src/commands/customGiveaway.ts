import { Message, EmbedBuilder, TextChannel, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { convertToMilliseconds } from '../utils/convertTime';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need `Administrator` permission to start a custom giveaway.");
    }

    if (rawArgs.length < 3) {
        return message.reply("❌ Usage: `!ga custom <title> <duration> <winners> --field \"name: value\"` - Starts a Custom Giveaway.");
    }

    // ✅ **Fix Argument Parsing**
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];

    // ✅ **Separate `--field` Arguments from Main Arguments**
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--field" && args[i + 1]) {
            fieldArgs.push(args[i + 1]);
            i++; // Skip next argument as it's part of the field
        } else {
            mainArgs.push(args[i]);
        }
    }

    // ✅ **Ensure at least 3 required arguments exist (Title, Duration, Winner Count)**
    if (mainArgs.length < 3) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\"`.");
    }

    // ✅ **Extract & Validate `winnerCount` and `duration`**
    const winnerCountArg = mainArgs.pop()!;
    const durationArg = mainArgs.pop()!;
    const title = mainArgs.join(" "); // Remaining arguments form the title

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

    let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
    if (existingGiveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    // ✅ **Fix Parsing of Extra Fields (Handles `:` in Field Values Properly)**
    let extraFields: Record<string, string> = {};
    for (let field of fieldArgs) {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    }

    // ✅ **Create Giveaway Embed**
    const embed = new EmbedBuilder()
        .setTitle(`🎁 **Custom Giveaway: ${title}** 🎁`)
        .setDescription("React with 🎉 to enter!")
        .setColor("Blue")
        .addFields([
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
            { name: "🎟️ Participants", value: "0 users", inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Failed to send custom giveaway message:", error);
        return message.reply("❌ Could not start custom giveaway. Bot might lack permissions.");
    }

    // ✅ **Ensure message ID is valid before creating buttons**
    if (!giveawayMessage.id) {
        console.error("❌ Giveaway message ID is missing.");
        return message.reply("❌ Could not start giveaway due to an internal error.");
    }

    // ✅ **Create Join/Leave Buttons**
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    let giveawayData: Giveaway | null = null;

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
            winnerCount,
            extraFields: JSON.stringify(extraFields) // ✅ Ensure fields are always stored as a string
        });
    } catch (error) {
        console.error("❌ Failed to save the custom giveaway:", error);
        return message.reply("❌ Could not save the custom giveaway.");
    }

    startLiveCountdown(giveawayData.id, message.client);
    return message.reply(`✅ Custom Giveaway **${title}** started!`);
}