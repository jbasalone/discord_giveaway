import { Client, TextChannel } from "discord.js";
import { ScheduledGiveaway } from "../models/ScheduledGiveaway";
import { startTemplateGiveaway } from "../commands/startTemplate";
import { startCustomGiveaway } from "../commands/customGiveaway";
import { SavedGiveaway } from "../models/SavedGiveaway";
import { GuildSettings } from "../models/GuildSettings";
import { Op } from "sequelize";
import moment from "moment-timezone";

/**
 * Parses different time formats from `--time`
 */
function parseScheduleTime(timeStr: string): Date | null {
    if (!timeStr) return null;

    if (timeStr.match(/^\d{2}:\d{2}$/)) {
        // Format: HH:mm (Today at specified time)
        const now = moment().startOf("day");
        return now.set("hour", parseInt(timeStr.split(":")[0])).set("minute", parseInt(timeStr.split(":")[1])).toDate();
    }

    if (timeStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
        // Format: YYYY-MM-DD HH:mm
        return moment(timeStr, "YYYY-MM-DD HH:mm").toDate();
    }

    if (timeStr.match(/^\d+$/)) {
        // Unix Timestamp
        return new Date(parseInt(timeStr) * 1000);
    }

    if (timeStr.match(/^(\d+)([smhd])$/)) {
        // Relative Time (e.g., 1h, 30m, 45s)
        const amount = parseInt(timeStr.match(/^(\d+)/)?.[1] ?? "0");
        const unit = timeStr.match(/[smhd]/)?.[0];

        switch (unit) {
            case "s":
                return moment().add(amount, "seconds").toDate();
            case "m":
                return moment().add(amount, "minutes").toDate();
            case "h":
                return moment().add(amount, "hours").toDate();
            case "d":
                return moment().add(amount, "days").toDate();
        }
    }

    return null;
}

/**
 * Checks and executes scheduled giveaways.
 */
export async function checkScheduledGiveaways(client: Client) {
    console.log("🔍 [DEBUG] Running checkScheduledGiveaways...");

    const now = new Date();
    const giveaways = await ScheduledGiveaway.findAll({
        where: { scheduleTime: { [Op.lte]: now } },
        raw: true,
    });

    if (giveaways.length === 0) {
        console.log("[checkScheduledGiveaway] ✅ No scheduled giveaways ready to start.");
        return;
    }

    console.log(`🔍 [DEBUG] Found ${giveaways.length} scheduled giveaways.`);

    for (const giveaway of giveaways) {
        console.log(`📌 [DEBUG] Processing giveaway ID ${giveaway.id}: ${giveaway.title}`);

        const { id, guildId, channelId, title, type, templateId, args, repeatInterval, scheduleTime, repeatTime } = giveaway;

        if (!id || !guildId || !channelId || !title || !scheduleTime) {
            console.error(`[ERROR] Skipping invalid giveaway due to missing required fields:`, giveaway);
            continue;
        }

        let guild = client.guilds.cache.get(guildId);
        if (!guild) {
            try {
                guild = await client.guilds.fetch(guildId);
                if (!guild) throw new Error(`Unknown Guild`);
            } catch (error) {
                console.error(`[ERROR] Could not fetch guild ID ${guildId}. Skipping giveaway ID ${id}.`, error);
                continue;
            }
        }

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
            console.error(`[ERROR] Invalid or missing TextChannel for scheduled giveaway in ${guild.name} (ID: ${channelId}).`);
            continue;
        }

        console.log(`✅ [DEBUG] Starting giveaway in channel: ${channel.name}`);

        const guildSettings = await GuildSettings.findOne({ where: { guildId } });

        if (!guildSettings) {
            console.error(`[ERROR] No guild settings found for guild ID ${guildId}. Skipping.`);
            continue;
        }

        let allowedRoles: string[] = [];
        try {
            const rawAllowedRoles = guildSettings.get("allowedRoles");
            allowedRoles = rawAllowedRoles ? JSON.parse(rawAllowedRoles) : [];
            if (!Array.isArray(allowedRoles)) {
                throw new Error("allowedRoles is not an array.");
            }
        } catch (error) {
            console.error(`[ERROR] Error parsing allowedRoles for guild ID ${guildId}:`, error);
            continue;
        }

        let savedTemplate: SavedGiveaway | null = null;
        let host = giveaway.host;

        if (type === "template" && templateId) {
            savedTemplate = await SavedGiveaway.findByPk(Number(templateId));
            if (!savedTemplate) {
                console.error(`[ERROR] No saved giveaway template found with ID **${templateId}**.`);
                continue;
            }
            host = savedTemplate.host || giveaway.host;
        }

        console.log(`🔍 [DEBUG] Using host ID: ${host}`);

        const hostMember = await guild.members.fetch(host).catch(() => null);
        if (!hostMember) {
            console.error(`[ERROR] Could not fetch host user ID ${host}. Skipping giveaway ID ${id}.`);
            continue;
        }

        let parsedArgs: string[] = [];
        try {
            parsedArgs = args ? JSON.parse(args) : [];
            if (!Array.isArray(parsedArgs)) throw new Error("Parsed args is not an array.");
        } catch (error) {
            console.error(`[ERROR] Error parsing args for giveaway ID ${id}:`, error);
            continue;
        }

        const fakeMessage = {
            guild,
            channel,
            author: hostMember.user,
            client,
            reply: (content: string) => channel.send(content),
        } as any;

        let giveawayExecuted = false;

        if (type === "template") {
            await startTemplateGiveaway(fakeMessage, [String(templateId)]);
            giveawayExecuted = true;
        } else {
            await startCustomGiveaway(fakeMessage, parsedArgs);
            giveawayExecuted = true;
        }

        if (giveawayExecuted) {
            console.log(`[setScheduledGiveaway] ✅ Giveaway Executed Successfully: ${title}`);
        }

        const scheduledGiveaway = await ScheduledGiveaway.findByPk(id);
        if (!scheduledGiveaway) {
            console.error(`[ERROR] Could not fetch scheduled giveaway ID ${id} from database.`);
            continue;
        }

        let nextScheduleTime = parseScheduleTime(repeatTime ?? "none") ?? new Date(scheduleTime);

        switch (repeatInterval) {
            case "hourly":
                nextScheduleTime.setHours(nextScheduleTime.getHours() + 1);
                break;
            case "daily":
                nextScheduleTime.setDate(nextScheduleTime.getDate() + 1);
                break;
            case "weekly":
                nextScheduleTime.setDate(nextScheduleTime.getDate() + 7);
                break;
            case "monthly":
                nextScheduleTime.setMonth(nextScheduleTime.getMonth() + 1);
                break;
            case "none":
            case null:
            case undefined:
                console.log(`🗑️ Deleting scheduled giveaway ID ${id}`);
                await scheduledGiveaway.destroy();
                continue;
        }

        console.log(`[DEBUG] Rescheduling giveaway ID ${id}. New scheduleTime: ${nextScheduleTime.toISOString()}`);
        await ScheduledGiveaway.update({ scheduleTime: nextScheduleTime }, { where: { id } });

        console.log(`[setScheduledGiveaway.ts] ✅ Rescheduled giveaway ${id} for ${nextScheduleTime.toISOString()}`);
    }
}