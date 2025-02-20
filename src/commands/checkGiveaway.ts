import { Message, EmbedBuilder } from 'discord.js';
import { getGiveaway, getAllGiveaways } from '../utils/getGiveaway';

export async function execute(message: Message, args: string[]) {
    if (args.length === 0) {
        return message.reply("❌ Usage: `!ga check <giveawayID | all>` - Check a specific giveaway or list all active giveaways.");
    }

    const query = args[0].toLowerCase();

    // ✅ Handle "all" option to list all active giveaways
    if (query === "all") {
        const allGiveaways = await getAllGiveaways();
        if (!allGiveaways.length) {
            return message.reply("❌ No active giveaways found.");
        }

        const embed = new EmbedBuilder()
            .setTitle("🎉 Active Giveaways")
            .setColor("Purple");

        allGiveaways.forEach(giveaway => {
            embed.addFields({
                name: giveaway.title,
                value: `[View Giveaway](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`,
                inline: false
            });
        });

        return message.reply({ embeds: [embed] });
    }

    // ✅ Otherwise, check a specific giveaway by ID or message ID
    let giveaway = await getGiveaway(query);
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
            { name: "🎟️ Participants", value: `${participants.length} users`, inline: true },
            { name: "🔗 Giveaway Link", value: `[View Giveaway](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`, inline: false }
        ]);

    return message.reply({ embeds: [embed] });
}