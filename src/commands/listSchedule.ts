import { Message, EmbedBuilder } from "discord.js";
import { ScheduledGiveaway } from "../models/ScheduledGiveaway";

export async function execute(message: Message, args: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    const guildId = String(message.guild.id);
    const scheduledGiveaways = await ScheduledGiveaway.findAll({ where: { guildId } });

    if (scheduledGiveaways.length === 0) {
        return message.reply("❌ No scheduled giveaways found.");
    }

    const embed = new EmbedBuilder()
        .setTitle("📆 Scheduled Giveaways")
        .setColor("Blue");

    scheduledGiveaways.forEach((giveaway) => {
        const title = giveaway.get("title") ?? "Untitled Giveaway";
        const id = giveaway.get("id") ?? "Unknown ID";
        const repeatInterval = giveaway.get("repeatInterval") ?? "none";
        const duration = Number(giveaway.get("duration")) / 1000 || "Unknown";

        let startTime: string;
        const scheduleTime = giveaway.get("scheduleTime");

        if (scheduleTime) {
            startTime = `<t:${Math.floor(new Date(scheduleTime).getTime() / 1000)}:F>`;
        } else {
            startTime = "❌ No start time set";
        }

        const repeatInfo = repeatInterval !== "none" ? `🔄 Repeats: **${repeatInterval}**` : "⏳ One-time event";

        embed.addFields({
            name: `🎁 ${title} (ID: ${id})`,
            value: `📆 Starts: ${startTime}\n${repeatInfo}\n⏳ Duration: **${duration}s**`,
        });
    });

    await message.reply({ embeds: [embed] });
}