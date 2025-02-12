import { Message, TextChannel } from 'discord.js';
import { Giveaway } from '../models/Giveaway';

export async function execute(message: Message, args: string[]) {
  try {
    if (args.length < 1) return message.reply("❌ Invalid usage! Example: `!ga reroll <giveaway_id>`");

    const giveawayId = parseInt(args[0], 10);
    if (isNaN(giveawayId)) return message.reply("❌ Invalid giveaway ID!");

    const giveaway = await Giveaway.findByPk(giveawayId);
    if (!giveaway) return message.reply("❌ Giveaway not found!");

    const participants: string[] = typeof giveaway.participants === "string"
        ? JSON.parse(giveaway.participants)
        : giveaway.participants;
    const winnerCount = giveaway.winnerCount || 1;

    if (participants.length === 0) {
      return message.reply("❌ No participants were found for this giveaway!");
    }

    const shuffledParticipants = participants.sort(() => Math.random() - 0.5);
    const winnerIds = shuffledParticipants.slice(0, winnerCount);

    const winnersMention = winnerIds.length > 0
        ? winnerIds.map((id: string) => `<@${id}>`).join(', ')
        : "No winners 😢";

    const channel = message.channel as TextChannel;
    await channel.send(`🔄 **Giveaway Rerolled!** **${giveaway.title}**\n🏆 **New Winners:** ${winnersMention}`);
  } catch (error) {
    console.error("❌ Error rerolling giveaway:", error);
  }
}