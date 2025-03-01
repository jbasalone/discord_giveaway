import { Client, TextChannel } from "discord.js";
import { ScheduledGiveaway } from "../models/ScheduledGiveaway";
import { startTemplateGiveaway } from "../commands/startTemplate";
import { startCustomGiveaway } from "../commands/customGiveaway";
import { SavedGiveaway } from "../models/SavedGiveaway";
import { Giveaway } from "../models/Giveaway";
import { GuildSettings } from "../models/GuildSettings";
import { Op } from "sequelize";

export async function checkScheduledGiveaways(client: Client) {
    console.log("🔍 [DEBUG] setScheduledGiveaway] Running checkScheduledGiveaways...");

    const now = new Date();
    const giveaways = await ScheduledGiveaway.findAll({
        where: { scheduleTime: { [Op.lte]: now } },
        raw: true,
    });

    if (giveaways.length === 0) {
        console.log("[setScheduledGiveaway] ✅ [DEBUG] No scheduled giveaways ready to start.");
        return;
    }

    console.log(`🔍 [DEBUG] Found ${giveaways.length} scheduled giveaways.`);

    for (const giveaway of giveaways) {
        console.log(`📌 [DEBUG][setScheduledGiveaway] Giveaway Before Processing: ${JSON.stringify(giveaway, null, 2)}`);

        const { id, guildId, channelId, title, type, templateId, args, repeatInterval, scheduleTime } = giveaway;

        if (!id || !guildId || !channelId || !title || !scheduleTime) {
            console.error(`[ERROR] [setScheduledGiveaway]❌ Skipping invalid giveaway due to missing required fields:`, giveaway);
            continue;
        }

        console.log(`🔍 [DEBUG][setScheduledGiveaway] Processing giveaway ID ${id}: ${title}`);

        let guild = client.guilds.cache.get(guildId);
        if (!guild) {
            try {
                guild = await client.guilds.fetch(guildId);
                if (!guild) throw new Error(`Unknown Guild`);
            } catch (error) {
                console.error(`[ERROR][setScheduledGiveaway] ❌ Could not fetch guild ID ${guildId}. Skipping giveaway ID ${id}.`, error);
                continue;
            }
        }

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
            console.error(`[ERROR][setScheduledGiveaway] ❌ Invalid or missing TextChannel for scheduled giveaway in ${guild.name} (ID: ${channelId}).`);
            continue;
        }

        console.log(`✅ [DEBUG] Starting giveaway in channel: ${channel.name}`);

        // ✅ Fetch Guild Settings
        const guildSettings = await GuildSettings.findOne({ where: { guildId } });

        if (!guildSettings) {
            console.error(`[setScheduledGiveaway] ❌ No guild settings found for guild ID ${guildId}. Skipping.`);
            continue;
        }

        let allowedRoles: string[] = [];
        try {
            console.log(`🔍 [DEBUG] [setScheduledGiveaway]  Raw allowedRoles from DB:`, guildSettings.get("allowedRoles"));
            const rawAllowedRoles = guildSettings.get("allowedRoles");
            allowedRoles = rawAllowedRoles ? JSON.parse(rawAllowedRoles) : [];

            if (!Array.isArray(allowedRoles)) {
                throw new Error("allowedRoles is not an array.");
            }
        } catch (error) {
            console.error(`[ERROR] [setScheduledGiveaway] ❌ Error parsing allowedRoles for guild ID ${guildId}:`, error);
            continue;
        }

        console.log(`🔍 [DEBUG] [setScheduledGiveaway] Allowed Roles in Guild (Parsed):`, allowedRoles);

        // ✅ Fetch the correct host from the template
        let savedTemplate: SavedGiveaway | null = null;
        let host = giveaway.host;

        if (type === "template" && templateId) {
            savedTemplate = await SavedGiveaway.findByPk(Number(templateId));
            if (!savedTemplate) {
                console.error(`[setScheduledGiveaway] ❌ No saved giveaway template found with ID **${templateId}**.`);
                continue;
            }
            host = savedTemplate.host || giveaway.host;
        }

        console.log(`🔍 [DEBUG] Using host ID: ${host}`);

        // ✅ Fetch the correct host user
        const hostMember = await guild.members.fetch(host).catch(() => null);
        if (!hostMember) {
            console.error(`[ERROR] [setScheduledGiveaway] ❌ Could not fetch host user ID ${host}. Skipping giveaway ID ${id}.`);
            continue;
        }

        // ✅ **Check if the host has at least one of the required roles**
        const hostRoles: string[] = hostMember.roles.cache.map((role) => role.id);
        console.log(`🔍 [DEBUG] [setScheduledGiveaway] Host ${host} Roles:`, hostRoles);

        const hasRequiredRole = hostRoles.some((roleId: string) => allowedRoles.includes(roleId));

        if (!hasRequiredRole) {
            console.error(`[ERROR] [setScheduledGiveaway] ❌ Host user ID ${host} does not have a required role to start giveaways. Skipping.`);
            continue;
        }

        console.log(`✅ Host user ID ${host} PASSES role check.`);

        let parsedArgs: string[] = [];
        try {
            parsedArgs = args ? JSON.parse(args) : [];
            if (!Array.isArray(parsedArgs)) throw new Error("Parsed args is not an array.");
        } catch (error) {
            console.error(`[ERROR] [setScheduledGiveaway]❌ Error parsing args for giveaway ID ${id}:`, error);
            continue;
        }

        console.log(`📌 [DEBUG] [setScheduledGiveaway] Parsed Args:`, parsedArgs);

        // ✅ **Fix for Permissions Issue**
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

            const giveawayDuration = savedTemplate?.duration || giveaway.duration || 60000;
            const endsAtUnix = Math.floor((Date.now() + giveawayDuration) / 1000);

            await Giveaway.create({
                guildId,
                channelId,
                title,
                type: savedTemplate?.type || "custom",
                templateId,
                duration: giveawayDuration,
                winnerCount: savedTemplate?.winnerCount || giveaway.winnerCount || 1,
                extraFields: savedTemplate?.extraFields || giveaway.extraFields || "{}",
                host,
                messageId: "UNKNOWN",
                description: savedTemplate?.description || `Giveaway for ${title}`,
                endsAt: endsAtUnix,
                startedAt: Math.floor(Date.now() / 1000),
            });

            console.log(`[setScheduledGiveaway] ✅ Giveaway Added to Database`);
        }

        // ✅ **Fix Rescheduling Issue**
        const scheduledGiveaway = await ScheduledGiveaway.findByPk(id);
        if (!scheduledGiveaway) {
            console.error(`[ERROR] [setScheduledGiveaway]  ❌ Could not fetch scheduled giveaway ID ${id} from database.`);
            continue;
        }

        let nextScheduleTime: Date;
        if (typeof scheduleTime === "string") {
            nextScheduleTime = new Date(scheduleTime);
        } else {
            nextScheduleTime = scheduleTime;
        }

        const currentTime = new Date();

        let intervalMs = 0;
        switch (repeatInterval) {
            case "hourly":
                intervalMs = 3600000; // 1 hour
                break;
            case "daily":
                intervalMs = 86400000; // 1 day
                break;
            case "weekly":
                intervalMs = 604800000; // 1 week
                break;
            case "monthly":
                intervalMs = 2592000000; // Approx 30 days
                break;
            case "none":
            case null:
            case undefined:
                console.log(`🗑️ Deleting scheduled giveaway ID ${id}`);
                await scheduledGiveaway.destroy();
                continue;
            default:
                console.error(`[ERROR] ❌ Unknown repeat interval: ${repeatInterval}. Skipping reschedule.`);
                continue;
        }

// ✅ Move the scheduled time FORWARD **only once** to avoid infinite loop
        while (nextScheduleTime <= currentTime) {
            nextScheduleTime.setTime(nextScheduleTime.getTime() + intervalMs);
        }

// ✅ Ensure it gets **properly saved in MySQL**
        console.log(`[DEBUG] [checkScheduledGiveaway.ts] Rescheduling giveaway ID ${id}. New scheduleTime: ${nextScheduleTime.toISOString()}`);
        await ScheduledGiveaway.update(
            { scheduleTime: nextScheduleTime },
            { where: { id } }
        );

        console.log(`[setScheduledGiveaway.ts] ✅ Rescheduled giveaway ${id} for ${nextScheduleTime.toISOString()}`);console.log(`[setScheduledGiveaway.ts] ✅ Rescheduled giveaway ${id} for ${nextScheduleTime.toISOString()}`);

    }
}