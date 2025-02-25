import { Message, PermissionsBitField } from "discord.js";
import { BugReport } from "../models/BugReport";
import { updateBugTrackerEmbed } from "../utils/updateBugEmbed"; // Ensure this is the function that updates the embed.

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ You need **Administrator** permissions to update bug statuses.");
    }

    if (rawArgs.length < 2) {
        return message.reply("❌ Usage: `!ga updatebug <bugId> <status>`\nValid statuses: `In Progress`, `Completed`");
    }

    const bugId = parseInt(rawArgs[0], 10);
    const status = rawArgs.slice(1).join(" ");

    if (isNaN(bugId)) {
        return message.reply("❌ Invalid Bug ID. It must be a number.");
    }

    if (!["In Progress", "Completed"].includes(status)) {
        return message.reply("❌ Invalid status. Valid options: `In Progress`, `Completed`.");
    }

    const bugReport = await BugReport.findOne({ where: { id: bugId } });
    if (!bugReport) {
        return message.reply("❌ Bug report not found.");
    }

    bugReport.set("status", status);
    await bugReport.save();

    await updateBugTrackerEmbed(message.guildId ?? undefined);

    return message.reply(`✅ Bug Report **#${bugId}** has been updated to **${status}**.`);
}