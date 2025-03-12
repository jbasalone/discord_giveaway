import { Message } from "discord.js";
import { ScheduledGiveaway } from "../models/ScheduledGiveaway";
import { GuildSettings } from "../models/GuildSettings";
import { SavedGiveaway } from "../models/SavedGiveaway";
import { convertToMilliseconds } from "../utils/convertTime";
import moment from "moment";

export async function execute(message: Message, rawArgs: string[]) {
    if (!message.guild) return message.reply("❌ This command must be used inside a server.");

    const guildId = String(message.guild.id);
    const guildSettings = await GuildSettings.findOne({ where: { guildId } });

    if (!guildSettings) return message.reply("❌ Guild settings not found. Admins need to configure roles first.");

    const allowedRoles: string[] = JSON.parse(guildSettings.get("allowedRoles") || "[]");
    if (!message.member?.roles.cache.some(role => allowedRoles.includes(role.id))) {
        return message.reply("❌ You do not have permission to schedule giveaways.");
    }

    if (rawArgs.length < 2) {
        return message.reply("❌ Invalid usage! Example: `ep ga schedule template 15 --time 18:00 --repeat hourly` OR `ep ga schedule custom \"My Giveaway\" 1h 3 --time 18:00 --repeat weekly`");
    }

    const args = rawArgs.join(" ").match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/(^"|"$)/g, "")) || [];
    const type = args[0].toLowerCase();
    const templateOrTitle = args[1];

    let title: string;
    let templateId: number | null = null;
    let duration: number;
    let winnerCount: number;
    let extraFields: Record<string, string> = {};

    if (type === "template") {
        const savedTemplate = await SavedGiveaway.findOne({ where: { id: templateOrTitle } });

        if (!savedTemplate) {
            return message.reply(`❌ No template found with ID **${templateOrTitle}**.`);
        }

        title = savedTemplate.get("name") as string;
        templateId = Number(savedTemplate.get("id"));
        duration = savedTemplate.get("duration") as number;
        winnerCount = savedTemplate.get("winnerCount") as number;
        extraFields = savedTemplate.get("extraFields") ? JSON.parse(savedTemplate.get("extraFields") as string) : {};
    } else {
        return message.reply("❌ Invalid type. Use `template` or `custom`.");
    }

    let scheduleTime = new Date();
    let repeatInterval: "none" | "hourly" | "daily" | "weekly" | "monthly" = "none";
    let repeatTime: string | null = null;
    let selectedRole: string | null = null;

    for (let i = 2; i < args.length; i++) {
        if (args[i] === "--time" && args[i + 1]) {
            const timeString = args[i + 1];

            if (/^\d{1,2}:\d{2}$/.test(timeString)) {
                // ✅ HH:MM format
                scheduleTime = moment(timeString, "HH:mm").toDate();
            } else if (/^\d+[smhd]$/.test(timeString)) {
                // ✅ Relative time format (30s, 10m, 2h, 1d)
                const durationMs = convertToMilliseconds(timeString);
                if (durationMs > 0) {
                    scheduleTime = new Date(Date.now() + durationMs);
                } else {
                    return message.reply("❌ Invalid relative time format! Use `30s`, `10m`, `1h`, `1d`.");
                }
            } else {
                return message.reply("❌ Invalid time format! Use `HH:MM` or relative times like `30s`, `10m`, `1h`, `1d`.");
            }
            i++;
        } else if (args[i] === "--repeat" && args[i + 1]) {
            repeatInterval = args[i + 1] as "hourly" | "daily" | "weekly" | "monthly";
            i++;
        }
    }

    const channelId = message.channel.id;
    await ScheduledGiveaway.create({
        guildId,
        channelId,
        title,
        type: "template",
        templateId,
        duration,
        winnerCount,
        extraFields: JSON.stringify(extraFields),
        scheduleTime,
        repeatInterval,
        repeatTime,
        host: message.author.id,
    });

    return message.reply(`✅ Giveaway **"${title}"** scheduled to start at **${scheduleTime.toLocaleString()}**.`);
}