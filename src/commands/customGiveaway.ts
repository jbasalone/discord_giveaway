import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, PermissionsBitField, User } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    const guildId = message.guild.id;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    let allowedRoles: string[] = [];
    try {
        allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
        allowedRoles = [];
    }

    if (allowedRoles.length > 0 && !message.member?.roles.cache.some(role => allowedRoles.includes(role.id))) {
        return message.reply("❌ You do not have permission to start giveaways.");
    }

    // ✅ **Fix: Proper Argument Parsing (Handles `--role`, `--host`, and `--field` in any position)**
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let selectedRole: string | null = null;
    let hostId: string = message.author.id; // ✅ Default host is the giveaway starter

    // ✅ **Separate `--role`, `--host`, and `--field` Arguments**
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--role" && args[i + 1]) {
            selectedRole = args[i + 1];
            i++;
        } else if (args[i] === "--host" && args[i + 1]) {
            const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
            hostId = mentionMatch ? mentionMatch[1] : args[i + 1]; // Extract user ID from mention or use raw ID
            i++;
        } else if (args[i] === "--field" && args[i + 1]) {
            fieldArgs.push(args[i + 1]);
            i++;
        } else {
            mainArgs.push(args[i]);
        }
    }

    if (mainArgs.length < 3) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIPGiveaway --host @User`.");
    }

    const winnerCountArg = mainArgs.pop()!;
    const durationArg = mainArgs.pop()!;
    const title = mainArgs.join(" ");

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

    let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
    if (existingGiveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    let roleMappings: Record<string, string> = {};
    try {
        roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
        roleMappings = {};
    }

    let rolePing = "";
    if (selectedRole) {
        const resolvedRole = roleMappings[selectedRole] || selectedRole;
        rolePing = `<@&${resolvedRole}>`;
    }

    let extraFields: Record<string, string> = {};
    for (let field of fieldArgs) {
        const splitIndex = field.indexOf(":");
        if (splitIndex !== -1) {
            const key = field.slice(0, splitIndex).trim();
            const value = field.slice(splitIndex + 1).trim();
            if (key && value) extraFields[key] = value;
        }
    }

    // ✅ Fetch Host User (Defaults to Giveaway Starter)
    let hostUser: User | null = null;
    try {
        hostUser = await client.users.fetch(hostId);
    } catch (error) {
        console.error("❌ Failed to fetch host user:", error);
    }

    const hostMention = hostUser ? `<@${hostUser.id}>` : `<@${message.author.id}>`;

    const embed = new EmbedBuilder()
        .setTitle(`🎁 **${title}** 🎁`)
        .setDescription(`**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`)
        .setColor("Blue")
        .setFields([
            { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
            { name: "🎟️ Participants", value: "0 users", inline: true },
            ...Object.entries(extraFields).map(([key, value]) => ({ name: key, value, inline: true }))
        ]);

    let giveawayMessage;
    try {
        giveawayMessage = await channel.send({
            content: rolePing ? `🎉 ${rolePing} ${message.guild?.name} Giveaway!` : undefined,
            embeds: [embed]
        });
    } catch (error) {
        console.error("❌ Failed to send custom giveaway message:", error);
        return message.reply("❌ Could not start custom giveaway. Bot might lack permissions.");
    }

    if (!giveawayMessage.id) {
        return message.reply("❌ Giveaway message failed to send.");
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
    );

    await giveawayMessage.edit({ components: [row] });

    let giveawayData: Giveaway | null = null;

    try {
        giveawayData = await Giveaway.create({
            guildId,
            host: hostUser?.id ?? message.author.id, // ✅ Ensures host defaults to giveaway starter
            channelId: channel.id,
            messageId: giveawayMessage.id,
            title,
            description: `**Host:** ${hostMention}\n**Server:** ${message.guild?.name}`,
            type: "custom",
            duration,
            endsAt,
            participants: JSON.stringify([]),
            winnerCount,
            extraFields: JSON.stringify(extraFields)
        });
    } catch (error) {
        console.error("❌ Failed to save the custom giveaway:", error);
        return message.reply("❌ Could not save the custom giveaway.");
    }

    startLiveCountdown(giveawayData.id, message.client);
    return message.reply(`**${title}** started! Hosted by ${hostMention}.`);
}