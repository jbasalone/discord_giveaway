import { Message, PermissionsBitField } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';
import { execute as startCustomGiveaway } from '../commands/customGiveaway';
import { execute as startMinibossGiveaway } from '../commands/minibossGiveaway';

export async function execute(message: Message, rawArgs: string[]) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return message.reply("❌ You need `Manage Messages` permission to start a saved giveaway.");
  }

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
      console.warn(`⚠️ [DEBUG] [startTemplate] Invalid duration detected! Defaulting to **1 minute**.`);
      durationMs = 60 * 1000; // Default 1 minute
    } else if (durationMs >= 1000) {
      console.log(`✅ [DEBUG] [startTemplate] Duration is already in milliseconds: ${durationMs}`);
    } else {
      console.log(`✅ [DEBUG] [startTemplate] Converting duration from seconds to milliseconds: ${durationMs} → ${durationMs * 1000}`);
      durationMs *= 1000;
    }

    let parsedWinnerCount = Number(winnerCount);
    if (isNaN(parsedWinnerCount) || parsedWinnerCount <= 0) {
      console.warn(`⚠️ [DEBUG][startTemplate] Invalid winner count detected! Defaulting to 1.`);
      parsedWinnerCount = 1;
    }

    console.log(`🚀 Starting [startTemplate] ${type === "miniboss" ? "Miniboss" : "Custom"} Giveaway with Template ID: ${templateId}`);
    console.log(`🎯 [DEBUG] [startTemplate] Extracted Values -> Title: ${title}, Duration: ${durationMs}, Winners: ${parsedWinnerCount}`);

    let argsToPass: string[] = [
      String(templateId),
      `"${title}"`,
      String(durationMs),
      String(parsedWinnerCount)
    ];

    // ✅ Parse Extra Fields
    const parsedExtraFields = extraFields ? JSON.parse(extraFields) : {};
    for (const [key, value] of Object.entries(parsedExtraFields)) {
      argsToPass.push("--field", `"${key}: ${value}"`);
    }

    // ✅ Add role if present
    if (role && typeof role === "string") {
      argsToPass.push("--role", role);
    }

    console.log(`📌 [DEBUG] [startTemplate] Final Args to Pass:`, argsToPass);

    // ✅ Ensure the correct function is called
    if (type === "miniboss") {
      await startMinibossGiveaway(message, argsToPass);
    } else {
      await startCustomGiveaway(message, argsToPass);
    }
  } catch (error) {
    console.error("❌ Error starting giveaway from template:", error);
    return message.reply("❌ Failed to start the saved giveaway. Please check logs.");
  }
}