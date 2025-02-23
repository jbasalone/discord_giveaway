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
  console.log("🔍 [DEBUG] Template ID:", templateId);

  if (isNaN(templateId)) {
    return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
  }

  try {
    const savedGiveaway = await SavedGiveaway.findByPk(templateId);
    if (!savedGiveaway) {
      return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
    }

    // ✅ Extract values correctly
    const templateData = savedGiveaway.get();
    const {
      id,
      title,
      duration,
      winnerCount,
      type,
      role,
      extraFields
    } = templateData;

    console.log(`🚀 Starting ${type === "miniboss" ? "Miniboss" : "Custom"} Giveaway with Template ID: ${templateId}`);

    // ✅ **Ensure Correct Extraction of Values**
    let parsedDuration = Number(duration);
    let parsedWinnerCount = Number(winnerCount);

    // 🚨 **Fix Winner Count Handling**
    if (isNaN(parsedWinnerCount) || parsedWinnerCount <= 0) {
      console.warn(`⚠️ [DEBUG] Invalid winnerCount (${parsedWinnerCount}) detected! Defaulting to 1.`);
      parsedWinnerCount = 1;
    }

    // 🚨 **Debugging Winner Count Value**
    console.log(`🎯 [DEBUG] Extracted Values -> Title: ${title}, Duration: ${parsedDuration}, WinnerCount: ${parsedWinnerCount}`);

    // ✅ **Ensure Correct Order of Arguments**
    let argsToPass: string[] = [
      String(id),               // Giveaway ID
      `"${title}"`,             // Title
      String(parsedDuration),   // Duration
      String(parsedWinnerCount) // Winner Count
    ];

    // ✅ **Extract Extra Fields**
    const parsedExtraFields = extraFields ? JSON.parse(extraFields) : {};
    for (const [key, value] of Object.entries(parsedExtraFields)) {
      argsToPass.push("--field", `"${key}: ${value}"`);
    }

    // ✅ **Append Role ID as a Flag if It Exists**
    if (role && typeof role === "string") {
      argsToPass.push("--role", role);
    }

    console.log(`📌 [DEBUG] Final Args to Pass:`, argsToPass);
    console.log(`🚀 [DEBUG] Final Values Before Execution: Duration=${parsedDuration}, WinnerCount=${parsedWinnerCount}`);

    // ✅ **Ensure Correct Giveaway Function is Called**
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