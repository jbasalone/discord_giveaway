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
    const template = await SavedGiveaway.findByPk(templateId);

    if (!template) {
      return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
    }

    const giveawayType = template.get("type") ?? "custom"; // Defaults to "custom"
    const isMiniboss = giveawayType === "miniboss";

    console.log(`🚀 Starting ${isMiniboss ? "Miniboss" : "Custom"} Giveaway with Template ID: ${templateId}`);

    const roleId = template.get("role") ?? null; // Get role from template (if exists)

    let argsToPass: string[] = [
      `${template.get("id")}`,
      `"${template.get("title")}"`,
      `${template.get("duration")}`,
      `${template.get("winnerCount")}`,
    ];

    const extraFields = template.get("extraFields") ? JSON.parse(template.get("extraFields") as string) : {};
    for (const [key, value] of Object.entries(extraFields)) {
      argsToPass.push("--field", `"${key}: ${value}"`);
    }

// ✅ Append Role ID as a Flag if It Exists
    if (roleId && typeof roleId === "string") {
      argsToPass.push("--role", roleId);
    }

    if (isMiniboss) {
      await startMinibossGiveaway(message, argsToPass);
    } else {
      await startCustomGiveaway(message, argsToPass);
    }

  } catch (error) {
    console.error("❌ Error starting giveaway from template:", error);
    return message.reply("❌ Failed to start the saved giveaway. Please check logs.");
  }
}