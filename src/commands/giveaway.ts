import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    PermissionsBitField
} from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';
import { convertToMilliseconds } from '../utils/convertTime';
import { startLiveCountdown } from '../utils/giveawayTimer';
import { client } from '../index';

export async function execute(message: Message, rawArgs: string[]) {
    try {
        if (!message.guild) {
            return message.reply("❌ This command must be used inside a server.");
        }

        // ✅ Fetch guild settings
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

        // ✅ **Fix: Proper Argument Parsing**
        const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];

        let selectedRole: string | null = null;
        let hostId: string = message.author.id; // ✅ Default host is the message sender
        let titleArgs: string[] = [];
        let durationArg: string | null = null;
        let winnerCount: number | null = null;
        let useExtraEntries = false; // ✅ Default to false unless specified

        // ✅ **Iterate through arguments safely**
        let i = 0;
        while (i < args.length) {
            if (args[i] === "--role" && args[i + 1]) {
                selectedRole = args[i + 1];
                i += 2;
            } else if (args[i] === "--host" && args[i + 1]) {
                const mentionMatch = args[i + 1].match(/^<@!?(\d+)>$/);
                hostId = mentionMatch ? mentionMatch[1] : args[i + 1]; // Extract user ID
                i += 2;
            } else if (args[i] === "--extraentries") {
                useExtraEntries = true; // ✅ Enable extra entries when flag is present
                i++;
            } else if (!durationArg && args[i].match(/^\d+[smhd]$/)) {
                durationArg = args[i];
                i++;
            } else if (!winnerCount && /^\d+$/.test(args[i])) {
                winnerCount = parseInt(args[i], 10);
                i++;
            } else {
                titleArgs.push(args[i]);
                i++;
            }
        }

        // ✅ **Validation Checks**
        if (!durationArg || !winnerCount || titleArgs.length === 0) {
            return message.reply("❌ Invalid format! Example: `!ga create \"Test Giveaway\" 30s 1 --role VIPGiveaway --host @User --extraentries`");
        }

        const title = titleArgs.join(" "); // ✅ Ensure title is correctly extracted
        const duration = convertToMilliseconds(durationArg);
        if (duration <= 0) {
            return message.reply("❌ Invalid duration format! Example: `30s`, `5m`, `1h`.");
        }

        if (isNaN(winnerCount) || !Number.isInteger(winnerCount) || winnerCount < 1) {
            return message.reply("❌ Winner count must be a **whole positive number** (e.g., `1`, `5`, `10`).");
        }

        const endsAt = Math.floor(Date.now() / 1000) + Math.floor(duration / 1000);
        const channel = message.channel as TextChannel;

        // ✅ Ensure No Duplicate Giveaway Titles
        let existingGiveaway = await Giveaway.findOne({ where: { title, guildId } });
        if (existingGiveaway) {
            return message.reply("⚠️ A giveaway with this title **already exists**. Please choose a **different title**.");
        }

        // ✅ **Fetch Role Mappings from DB**
        let roleMappings: Record<string, string> = {};
        try {
            roleMappings = JSON.parse(guildSettings.get("roleMappings") ?? "{}");
        } catch {
            roleMappings = {};
        }

        // ✅ **Resolve Role ID for Ping (From `--role` argument or mappings)**
        let rolePing = "";
        if (selectedRole) {
            const resolvedRole = roleMappings[selectedRole] || selectedRole;
            rolePing = `<@&${resolvedRole}>`;
        }

        // ✅ **Create the Giveaway Embed**
        const embed = new EmbedBuilder()
            .setTitle(`🎉 **${title}** 🎉`)
            .setDescription(`**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`)
            .setColor("Gold")
            .setFields([
                { name: "🎟️ Total Participants", value: "0 users", inline: true },
                { name: "⏳ Ends In", value: `<t:${endsAt}:R>`, inline: true },
                { name: "🏆 Winners", value: `${winnerCount}`, inline: true },
                { name: "🔹 Extra Entries Enabled", value: useExtraEntries ? "✅ Yes" : "❌ No", inline: true }
            ]);

        let giveawayMessage;
        try {
            giveawayMessage = await channel.send({
                content: rolePing ? `🎉 ${rolePing} ${message.guild?.name} Giveaway!` : undefined,
                embeds: [embed]
            });
        } catch (error) {
            console.error("❌ Failed to send giveaway message:", error);
            return message.reply("❌ Could not start giveaway. Bot might lack permissions.");
        }

        if (!giveawayMessage.id) {
            console.error("❌ Error: Message ID is undefined!");
            return message.reply("❌ Giveaway message failed to send.");
        }

        // ✅ **Create Join/Leave Buttons**
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join-${giveawayMessage.id}`).setLabel("Join 🎉").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`leave-${giveawayMessage.id}`).setLabel("Leave ❌").setStyle(ButtonStyle.Danger)
        );

        await giveawayMessage.edit({ components: [row] });

        // ✅ **Ensure transaction is properly handled**
        const transaction = await Giveaway.sequelize?.transaction();
        if (!transaction) {
            console.error("❌ Unable to initialize database transaction.");
            return message.reply("❌ Database error. Try again later.");
        }

        let giveawayData;
        try {
            giveawayData = await Giveaway.create({
                guildId,
                host: hostId, // ✅ **Host is now properly saved**
                channelId: channel.id,
                messageId: giveawayMessage.id,
                title,
                description: `**Host:** <@${hostId}>\n**Server:** ${message.guild?.name}`,
                type: "giveaway",
                duration,
                endsAt,
                participants: JSON.stringify([]),
                winnerCount,
                extraFields: JSON.stringify({ useExtraEntries }) // ✅ Store extra entries setting
            }, { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error("❌ Error saving giveaway:", error);
            return message.reply("❌ Failed to save the giveaway.");
        }

        startLiveCountdown(giveawayData.id, client);

        return message.reply(`✅ Giveaway **"${title}"** started! React with 🎉 in [this message](${giveawayMessage.url}).`);
    } catch (error) {
        console.error("❌ Error starting giveaway:", error);
        return message.reply("❌ Failed to start the giveaway. Please check logs.");
    }
}