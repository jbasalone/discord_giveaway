import { Message, EmbedBuilder } from 'discord.js';
import { getAllGiveaways, getGiveaway } from '../utils/getGiveaway';
import { connectDB } from '../database'; // ✅ Use database.ts for DB operations

export async function execute(message: Message, args: string[]) {
    // ✅ Ensure the database connection is active
    await connectDB();

    const guildName = message.guild?.name || "this server";
    const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds

    // ✅ If an argument is provided, attempt to fetch that specific giveaway
    if (args.length > 0) {
        const identifier = args[0].trim(); // ✅ Ensure we properly pass the ID as a string

        // ✅ Fetch Giveaway by ID or messageId
        let giveaway = await getGiveaway(identifier);

        if (!giveaway) {
            return message.reply(`❌ Giveaway with ID or Message ID **${identifier}** not found.`);
        }

        const participantCount = giveaway.participants ? JSON.parse(giveaway.participants).length : 0;
        const endsAtTag = `<t:${giveaway.endsAt}:R>`; // Discord timestamp

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(`🎁 ${giveaway.title}`)
            .setDescription(`${giveaway.description}`)
            .setColor(0xf1c40f) // Gold
            .addFields(
                { name: "👥 Participants", value: `${participantCount} users`, inline: true },
                { name: "🏆 Winners", value: `${giveaway.winnerCount}`, inline: true },
                { name: "⏳ Ends", value: `${endsAtTag}`, inline: true },
                { name: "🔗 Giveaway Link", value: `[Click to View](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`, inline: false }
            )
            .setFooter({ text: "Use ga check <ID> for details", iconURL: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png" });

        return message.reply({ embeds: [giveawayEmbed.toJSON()] });
    }

    // ✅ If no argument, list all giveaways
    const allGiveaways = await getAllGiveaways();
    if (!allGiveaways.length) {
        const noGiveawaysEmbed = new EmbedBuilder()
            .setTitle(`🚫 No Active Giveaways in ${guildName}`)
            .setDescription("There are currently **no active giveaways**.\nCheck back later or start a new giveaway!")
            .setColor(0xff0000) // Red
            .setFooter({ text: "Use ga check <ID> for details", iconURL: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png" });

        return message.reply({ embeds: [noGiveawaysEmbed.toJSON()] });
    }

    // ✅ Explicitly Define Types for Each Giveaway List
    let minibossGiveaways: { endsAt: number; text: string }[] = [];
    let standardGiveaways: { endsAt: number; text: string }[] = [];
    let scheduledGiveaways: { endsAt: number; text: string }[] = [];

    allGiveaways.forEach(giveaway => {
        const giveawayLink = `[🔗 View Giveaway](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`;
        const participantCount = giveaway.participants ? JSON.parse(giveaway.participants).length : 0;

        // ⏳ Calculate remaining time
        const timeRemaining = giveaway.endsAt - currentTime;
        const endsAtTag = `<t:${giveaway.endsAt}:R>`; // Displays "Ends in X minutes"

        // ⚠️ Check if giveaway ends in less than 10 minutes
        const lastChance = timeRemaining <= 600 ? "⚠️ **Last Chance!** " : "";

        const formattedGiveaway = `**${lastChance}${giveaway.title}**\n👥 **${participantCount} Participants** | ⏳ Ends ${endsAtTag}\n${giveawayLink}\n\n`;

        if (giveaway.type === "miniboss") {
            minibossGiveaways.push({ endsAt: giveaway.endsAt, text: `🎊 ${formattedGiveaway}` });
        } else if (giveaway.type === "scheduled") {
            scheduledGiveaways.push({ endsAt: giveaway.endsAt, text: `⏳ ${formattedGiveaway}` });
        } else {
            standardGiveaways.push({ endsAt: giveaway.endsAt, text: `🚀 ${formattedGiveaway}` });
        }
    });

    // ✅ Sort each category by ending time (earliest first)
    minibossGiveaways.sort((a, b) => a.endsAt - b.endsAt);
    standardGiveaways.sort((a, b) => a.endsAt - b.endsAt);
    scheduledGiveaways.sort((a, b) => a.endsAt - b.endsAt);

    // ✅ Build Embed with Sections
    const embed = new EmbedBuilder()
        .setTitle(`🎉 Active Giveaways in ${guildName}`)
        .setColor(0xf1c40f) // Gold
        .setFooter({ text: "Use ga check <ID> for details", iconURL: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png" });

    if (minibossGiveaways.length) embed.addFields({ name: "🎊 Miniboss Giveaways", value: minibossGiveaways.map(g => g.text).join("") });
    if (standardGiveaways.length) embed.addFields({ name: "🪄 Standard Giveaways", value: standardGiveaways.map(g => g.text).join("") });
    if (scheduledGiveaways.length) embed.addFields({ name: "⏳ Scheduled Giveaways", value: scheduledGiveaways.map(g => g.text).join("") });

    return message.reply({ embeds: [embed.toJSON()] });
}