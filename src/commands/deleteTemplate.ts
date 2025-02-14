import { Message, PermissionsBitField } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message, args: string[]) {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return message.reply("❌ You need `Manage Messages` permission to delete a saved giveaway.");
  }

  if (args.length < 1) {
    return message.reply("❌ Usage: `!ga delete <templateID>` - Delete a saved giveaway template.");
  }

  const templateId = parseInt(args[0], 10);
  if (isNaN(templateId)) {
    return message.reply("❌ Invalid ID. Please enter a **valid template ID number**.");
  }

  try {
    // ✅ **Find Template by ID**
    const template = await SavedGiveaway.findByPk(templateId);
    if (!template) {
      return message.reply(`❌ No saved giveaway template found with ID **${templateId}**.`);
    }

    // ✅ **Delete the template**
    await template.destroy();
    return message.reply(`✅ Saved giveaway template **"${template.get("name")}"** (ID: ${templateId}) has been deleted.`);

  } catch (error) {
    console.error("❌ Error deleting saved template:", error);
    return message.reply("❌ Failed to delete the giveaway template. Please try again.");
  }
}