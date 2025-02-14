import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, PermissionsBitField } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) {
        return message.reply("❌ This command must be used inside a server.");
    }

    // ✅ Fetch guild settings to check role permissions & mappings
    const guildId = message.guild.id;
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) {
        return message.reply("❌ Guild settings not found. Admins need to configure roles first.");
    }

    // ✅ Retrieve Allowed Roles (Who Can Start Giveaways)
    let allowedRoles: string[] = [];
    try {
        allowedRoles = JSON.parse(guildSettings.get("allowedRoles") ?? "[]");
    } catch {
        allowedRoles = [];
    }

    // ✅ Ensure User Has Permission
    if (allowedRoles.length > 0 && !message.member?.roles.cache.some(role => allowedRoles.includes(role.id))) {
        return message.reply("❌ You do not have permission to start giveaways.");
    }

    // ✅ **Fix: Proper Argument Parsing (Handles `--role` correctly in any position)**
    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

    let fieldArgs: string[] = [];
    let mainArgs: string[] = [];
    let selectedRole: string | null = null;

    // ✅ **Separate `--role` and `--field` Arguments**
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--role" && args[i + 1]) {
            selectedRole = args[i + 1];
            i++; // Skip next argument (role name)
        } else if (args[i] === "--field" && args[i + 1]) {
            fieldArgs.push(args[i + 1]);
            i++; // Skip next argument (field value)
        } else {
            mainArgs.push(args[i]);
        }
    }

    // ✅ **Ensure at least 3 required arguments exist (Title, Duration, Winner Count)**
    if (mainArgs.length < 3) {
        return message.reply("❌ Invalid usage! Example: `!ga custom \"Super Giveaway\" 30s 1 --field \"Requirement: Level 50+\" --role VIPGiveaway`.");
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

    // ✅ Ensure No Duplicate Giveaway Titles
    let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
    if (existingGiveaway) {
        return message.reply("⚠️ A giveaway with this title already exists. Please use a different title.");
    }

    // ✅ Fetch Role Mappings from DB
    let roleMappings: Record<string, string> = {};
    try {
        roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
    } catch {
        roleMappings = {};
    }

    // ✅ Resolve Role ID for Ping (From `--role` argument or mappings)
    let rolePing = "";
    if (selectedRole) {
        const resolvedRole = roleMappings[selectedRole] || selectedRole;
        rolePing = `<@&${resolvedRole}>`;
    }

    // ✅ **Fix Parsing of Extra Fields**
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
        .setTitle(`🎁 **${title}** `)
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
        giveawayMessage = await channel.send({
            content: rolePing ? `🎉 ${rolePing} A new giveaway has started!` : undefined,
            embeds: [embed]
        });
    } catch (error) {
        console.error("❌ Failed to send custom giveaway message:", error);
        return message.reply("❌ Could not start custom giveaway. Bot might lack permissions.");
    }

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
            type: "custom", // ✅ FIX: Ensure giveaway type is explicitly set
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