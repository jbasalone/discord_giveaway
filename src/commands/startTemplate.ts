import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { Giveaway } from '../models/Giveaway';
import { execute as startCustomGiveaway } from '../commands/customGiveaway';
import { execute as startMinibossGiveaway } from '../commands/minibossGiveaway';
import { startLiveCountdown } from '../utils/giveawayTimer';

export async function execute(message: Message, rawArgs: string[], isScheduled = false) {
    if (rawArgs.length < 1) {
        return message.reply("❌ You must specify a template **ID number**.");
    }

    const templateId = parseInt(rawArgs[0], 10);
    if (isNaN(templateId)) {
        return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
    }

    try {
        const savedGiveaway = await SavedGiveaway.findByPk(templateId);
        if (!savedGiveaway) {
            return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
        }

        const {
            type,
            title,
            duration,
            winnerCount,
            role,
            extraFields,
            host,
            forceStart,
            imageUrl,
            thumbnailUrl,
            useExtraEntries
        } = savedGiveaway.get();

        let durationMs = Number(duration);
        if (isNaN(durationMs) || durationMs <= 0) durationMs = 60 * 1000;

        let parsedWinnerCount = Number(winnerCount);
        if (isNaN(parsedWinnerCount) || parsedWinnerCount <= 0) parsedWinnerCount = 1;

        console.log(`🚀 [DEBUG] Starting ${type} Giveaway from Template ID: ${templateId}`);

        const argsToPass: string[] = [
            `"${title}"`,
            `${Math.floor(durationMs / 1000)}s`,
            `${parsedWinnerCount}`
        ];

        const parsedExtraFields = extraFields ? JSON.parse(extraFields) : {};
        for (const [key, value] of Object.entries(parsedExtraFields)) {
            argsToPass.push("--field", `"${key}: ${value}"`);
        }

        if (host) argsToPass.push("--host", `<@${host}>`);
        if (role && role !== "None") {
            const roleList: string[] = role.split(/[ ,]+/).map((r: string) => r.trim()).filter(Boolean);
            argsToPass.push("--role", ...roleList);
        }
        if (imageUrl) argsToPass.push("--image", imageUrl);
        if (thumbnailUrl) argsToPass.push("--thumbnail", thumbnailUrl);
        if (useExtraEntries) argsToPass.push("--extraentries");

        // ✅ Check for channel override at end of rawArgs
        const lastArg = rawArgs[rawArgs.length - 1];
        const channelMatch = lastArg?.match(/^<#(\d+)>$/);
        if (channelMatch) {
            argsToPass.push(lastArg); // preserve full mention format for parser
        }

        let giveawayEntry = null;
        if (isScheduled) {
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
                forceStart: Number(forceStart) === 1 ? 1 : 0,
                useExtraEntries: !!useExtraEntries,
                imageUrl: imageUrl ?? null,
                thumbnailUrl: thumbnailUrl ?? null
            });
        }

        let giveawayMessage;
        if (type === "miniboss") {
            giveawayMessage = await startMinibossGiveaway(message, argsToPass);
        } else {
            giveawayMessage = await startCustomGiveaway(message, argsToPass);
        }

        if (isScheduled && giveawayEntry && giveawayMessage?.id) {
            await Giveaway.update(
                { messageId: giveawayMessage.id },
                { where: { id: giveawayEntry.id } }
            );
        }

        if (isScheduled && giveawayEntry) {
            await startLiveCountdown(giveawayEntry.id, message.client);
        }

    } catch (error) {
        console.error("❌ Error starting giveaway from template:", error);
        return message.reply("❌ Failed to start the saved giveaway. Please check logs.");
    }
}

export { execute as startTemplateGiveaway };