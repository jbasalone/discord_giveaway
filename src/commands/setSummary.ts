import { Message, PermissionsBitField, TextChannel, EmbedBuilder, Colors } from "discord.js";
import { SecretGiveawaySettings } from "../models/SecretGiveaway";
import { Giveaway } from "../models/Giveaway";
import { GuildSettings } from '../models/GuildSettings';


export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to configure the summary embed.");
    }

    const guildId = message.guild?.id;
    if (!guildId) return;

    const settings = await GuildSettings.findOne({ where: { guildId } });
    const prefix = settings?.get("prefix") || "!";

    if (rawArgs.length === 0) {
        return message.reply(`❌ Usage:\n\`\`\`\n ${prefix} ga  setsummary #channel\n\`\`\``);
    }

    const channelMention = rawArgs[0];
    const channelId = channelMention.replace(/[^0-9]/g, ""); // Extract Channel ID

    const channel = message.guild.channels.cache.get(channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) {
        return message.reply("❌ Please specify a **valid text channel** for the summary.");
    }

    // ✅ Store Summary Channel ID in the Database
    await SecretGiveawaySettings.upsert({
        guildId,
        summaryChannelId: channelId,
    });

    // ✅ **Check for an Active Secret Giveaway**
    const activeGiveaways = await Giveaway.findAll({ where: { guildId, type: "secret" } });

    // ✅ **Set Default Values If No Active Giveaway Exists**
    const totalParticipants = activeGiveaways.reduce((acc, ga) => acc + JSON.parse(ga.participants ?? "[]").length, 0);
    const maxWinners = activeGiveaways.reduce((acc, ga) => acc + (ga.winnerCount ?? 0), 0);
    const timeLeft = activeGiveaways.length > 0
        ? `<t:${Math.max(...activeGiveaways.map(ga => ga.endsAt))}:R>`
        : "N/A";

    // ✅ **Build the Summary Embed**
    const embed = new EmbedBuilder()
        .setTitle("🎭 **Secret Giveaway Summary** 🎭")
        .setDescription(activeGiveaways.length > 0 ? "🔥 A **Secret Giveaway** is currently running!" : "❌ No secret giveaways are currently running.")
        .setColor(activeGiveaways.length > 0 ? Colors.Purple : Colors.DarkButNotBlack)
        .addFields(
            { name: "🎟️ Total Participants", value: `${totalParticipants}`, inline: true },
            { name: "🏆 Winners Selected", value: `${maxWinners}`, inline: true },
            { name: "⏳ Time Remaining", value: timeLeft, inline: true }
        );

    // ✅ **Send or Update Summary Embed**
    const summaryMessage = await channel.send({ embeds: [embed] });

    // ✅ **Store the Message ID for Future Updates**
    await SecretGiveawaySettings.update({ summaryMessageId: summaryMessage.id }, { where: { guildId } });

    return message.reply(`✅ **Secret Giveaway Summary will now be posted in:** <#${channelId}>.`);
}