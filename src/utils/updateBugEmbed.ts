import { EmbedBuilder, TextChannel } from "discord.js";
import { BugReport } from "../models/BugReport";
import { client } from "../index";

const BUG_TRACKER_CHANNEL_ID = "1343109399111274536"; // Replace with the actual channel ID

export async function updateBugTrackerEmbed(guildId?: string) {
    if (!guildId) return;

    const bugReports = await BugReport.findAll({ where: { type: "Bug" } });
    const featureRequests = await BugReport.findAll({ where: { type: "Feature" } });
    const completedFixes = await BugReport.findAll({ where: { status: "Completed" } });
    const inProgress = await BugReport.findAll({ where: { status: "In Progress" } });

    const embed = new EmbedBuilder()
        .setTitle("📜 Bug & Feature Tracker")
        .setColor("Blue")
        .addFields(
            { name: "🐞 Bugs Reported", value: bugReports.length > 0 ? bugReports.map(b => `• #${b.id} ${b.description}`).join("\n") : "✅ No bugs reported." },
            { name: "💡 Feature Requests", value: featureRequests.length > 0 ? featureRequests.map(f => `• #${f.id} ${f.description}`).join("\n") : "✅ No feature requests." },
            { name: "🔨 Fixes Completed", value: completedFixes.length > 0 ? completedFixes.map(c => `• #${c.id} ${c.description}`).join("\n") : "❌ No fixes completed." },
            { name: "⚙️ In Progress", value: inProgress.length > 0 ? inProgress.map(i => `• #${i.id} ${i.description}`).join("\n") : "🔧 Nothing in progress." }
        );

    const channel = client.channels.cache.get(BUG_TRACKER_CHANNEL_ID) as TextChannel;
    if (!channel) {
        console.error("❌ Bug Tracker channel not found!");
        return;
    }

    let trackerMessage = await channel.messages.fetch({ limit: 1 }).then(msgs => msgs.first()).catch(() => null);

    if (trackerMessage) {
        await trackerMessage.edit({ embeds: [embed] });
    } else {
        await channel.send({ embeds: [embed] });
    }
}