import { Message, EmbedBuilder } from 'discord.js';
import { UserProfile } from '../models/UserProfile';

export async function execute(message: Message) {
    try {
        const userProfile = await UserProfile.findOne({ where: { userId: message.author.id } });

        if (!userProfile) {
            return message.reply("❌ You have not set your level yet. Use `!setlevel <level> [tt_level]` to set it.");
        }

        const userLevel = userProfile.get("userLevel") ?? "Unknown";
        const ttLevel = userProfile.get("ttLevel") ?? 100; // Default TT level to 100 if not found

        // ✅ Create an embed for better formatting
        const embed = new EmbedBuilder()
            .setTitle(`📊 Your Level Information`)
            .setDescription(`Here are your current level stats:`)
            .setColor("Blue")
            .addFields(
                { name: "🔹 User Level", value: `**${userLevel}**`, inline: true },
                { name: "🌌 TT Level", value: `**${ttLevel}**`, inline: true }
            )
            .setFooter({ text: "Use `<prefix ga setlevel <level> [tt_level]` to update your stats." });

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error("❌ Error fetching user level:", error);
        return message.reply("❌ An error occurred while retrieving your level. Please try again.");
    }
}