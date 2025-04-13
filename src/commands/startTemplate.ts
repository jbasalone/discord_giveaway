import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { Giveaway } from '../models/Giveaway';
import { execute as startCustomGiveaway } from '../commands/customGiveaway';
import { execute as startMinibossGiveaway } from '../commands/minibossGiveaway';

export async function execute(message: Message, rawArgs: string[], isScheduled = false) {


    if (rawArgs.length < 1) {
        return message.reply("❌ You must specify a template **ID number**.");
    }

    const templateId = parseInt(rawArgs[0], 10);
    console.log("🔍 [DEBUG] [startTemplate] Template ID:", templateId);

    if (isNaN(templateId)) {
        return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
    }

    try {
        const savedGiveaway = await SavedGiveaway.findByPk(templateId);
        if (!savedGiveaway) {
            return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
        }

        // ✅ Extract values safely
        const { type, title, duration, winnerCount, role, extraFields } = savedGiveaway.get();

        let durationMs = Number(duration);
        if (isNaN(durationMs) || durationMs <= 0) {
            console.warn(`⚠️ [DEBUG] Invalid duration detected! Defaulting to **1 minute**.`);
            durationMs = 60 * 1000;
        } else if (durationMs < 1000) {
            console.log(`✅ [DEBUG] Converting duration from seconds to milliseconds.`);
            durationMs *= 1000;
        }

        let parsedWinnerCount = Number(winnerCount);
        if (isNaN(parsedWinnerCount) || parsedWinnerCount <= 0) {
            console.warn(`⚠️ [DEBUG] Invalid winner count detected! Defaulting to 1.`);
            parsedWinnerCount = 1;
        }

        console.log(`🚀 [DEBUG] Starting ${type} Giveaway from Template ID: ${templateId}`);

        let argsToPass: string[] = [
            String(templateId),
            String(title),
            String(durationMs),
            String(parsedWinnerCount)
        ];

        // ✅ Parse Extra Fields
        const parsedExtraFields = extraFields ? JSON.parse(extraFields) : {};
        for (const [key, value] of Object.entries(parsedExtraFields)) {
            argsToPass.push("--field", `"${key}: ${value}"`);
        }

        if (role && typeof role === "string") {
            argsToPass.push("--role", role);
        }

        let giveawayEntry = null;

        // ✅ If this is a scheduled giveaway, insert it into `giveaways` table first
        if (isScheduled) {
            console.log("✅ [DEBUG] Scheduled Giveaway Detected - Inserting into `giveaways` Table.");

            giveawayEntry = await Giveaway.create({
                guildId: message.guild?.id,
                channelId: message.channel.id,
                host: message.author?.id || "SYSTEM",
                title: title,
                description: "Scheduled Giveaway",
                type: type,
                duration: durationMs,
                endsAt: Math.floor(Date.now() / 1000) + durationMs / 1000,
                participants: "[]",
                guaranteedWinners: "[]",
                winnerCount: parsedWinnerCount,
                extraFields: Object.keys(parsedExtraFields).length > 0 ? JSON.stringify(parsedExtraFields) : null,
                forceStart: Number(savedGiveaway.get("forceStart")) === 1 ? 1 : 0,
                useExtraEntries: false,
            });

            console.log(`✅ [DEBUG] Giveaway Added to Database (ID: ${giveawayEntry.id})`);
            console.log(`🚀 [DEBUG] Creating Giveaway with forceStart:`, savedGiveaway.get("forceStart"));
        }

        let giveawayMessage;
        if (type === "miniboss") {
            giveawayMessage = await startMinibossGiveaway(message, argsToPass);
        } else {
            giveawayMessage = await startCustomGiveaway(message, argsToPass);
        }

// ✅ If this is a scheduled giveaway, update messageId in the DB
        if (isScheduled && giveawayEntry && giveawayMessage?.id) {
            await Giveaway.update(
                {messageId: giveawayMessage.id},
                {where: {id: giveawayEntry.id}}
            );
            console.log(`✅ [DEBUG] Stored message ID for scheduled giveaway: ${giveawayMessage.id}`);
        }

    } catch (error) {
        console.error("❌ Error starting giveaway from template:", error);
        return message.reply("❌ Failed to start the saved giveaway. Please check logs.");
    }
}

export { execute as startTemplateGiveaway };