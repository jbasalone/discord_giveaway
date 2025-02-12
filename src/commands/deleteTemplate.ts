import { Message } from 'discord.js';
import { SavedGiveaway } from '../models/SavedGiveaway';

export async function execute(message: Message, args: string[]) {

  const templateName = args.shift();
  if (!templateName) return message.reply("❌ Please provide a template name.");

  const deleted = await SavedGiveaway.destroy({ where: { guildId: message.guild!.id, name: templateName } });

  if (deleted) {
    message.reply(`✅ Giveaway template **${templateName}** has been deleted.`);
  } else {
    message.reply(`❌ No saved template found with name **${templateName}**.`);
  }
}