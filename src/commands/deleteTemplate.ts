import { Message } from 'discord.js';
import { getGiveaway } from '../utils/getGiveaway';

export async function execute(message: Message, args: string[]) {
  if (!message.member?.permissions.has("ManageMessages")) {
    return message.reply("❌ You need `Manage Messages` permission to delete a giveaway.");
  }

  if (args.length < 1) {
    return message.reply("❌ Usage: `!ga delete <giveawayID>` - Delete an active giveaway.");
  }

  const giveawayId = args[0];

  let giveaway = await getGiveaway(giveawayId);
  if (!giveaway) {
    return message.reply("❌ Giveaway not found or already ended.");
  }

  await giveaway.destroy();
  return message.reply(`✅ Giveaway **${giveaway.title}** has been deleted.`);
}