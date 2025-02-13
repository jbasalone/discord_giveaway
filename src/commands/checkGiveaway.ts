import { Message, EmbedBuilder } from 'discord.js';
import { getGiveaway } from '../utils/getGiveaway';

export async function execute(message: Message, args: string[]) {
    if (args.length < 1) {
        return message.reply("❌ Usage: `!ga check <giveawayID>` - Check giveaway status.");
    }

    const giveawayId = args[0];

    let giveaway = await getGiveaway(giveawayId);
    if (!giveaway) {
        return message.reply("❌ Giveaway not found or has ended.");
    }

    const participants = JSON.parse(giveaway.participants || "[]");

    const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaway Status")
        .setDescription(`**Title:** ${giveaway.title}`)
        .setColor("Blue")
        .addFields([
            { name: "⏳ Ends In", value: `<t:${giveaway.endsAt}:R>`, inline: true },
            { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
            { name: "🎟️ Participants", value: `${participants.length} users`, inline: true }
        ]);

    return message.reply({ embeds: [embed] });
}