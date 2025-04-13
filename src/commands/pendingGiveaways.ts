import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import { Giveaway } from "../models/Giveaway";

export async function execute(message: Message) {
    if (!message.member?.roles.cache.some(role => role.name === "Giveaway Manager")) {
        return message.reply("❌ You do not have permission to approve giveaways.");
    }

    const pendingGiveaways = await Giveaway.findAll({ where: { status: "pending" } });

    if (pendingGiveaways.length === 0) {
        return message.reply("✅ No pending giveaways.");
    }

    for (const giveaway of pendingGiveaways) {
        const embed = new EmbedBuilder()
            .setTitle(`🎁 ${giveaway.title}`)
            .setDescription(giveaway.extraFields || "No extra details provided.")
            .addFields(
                { name: "⏳ Duration", value: String(giveaway.duration), inline: true },  // ✅ Convert to string
                { name: "🏆 Winners", value: String(giveaway.winnerCount), inline: true }, // ✅ Convert to string
                { name: "🔒 Restricted Role", value: giveaway.roleRestriction || "None", inline: true }
            )
            .setColor("Yellow");

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`approve-giveaway-${giveaway.id}`)
                .setLabel("✅ Approve")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`reject-giveaway-${giveaway.id}`)
                .setLabel("❌ Reject")
                .setStyle(ButtonStyle.Danger)
        );

        // ✅ Ensure `message.channel` supports `.send()`
        if (message.channel.isTextBased() && "send" in message.channel) {
            await (message.channel as TextChannel).send({ embeds: [embed], components: [row] });
        } else {
            console.error("❌ Error: message.channel is not a valid TextChannel.");
        }
    }
}