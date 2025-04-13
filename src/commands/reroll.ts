import { Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { GuildSettings } from '../models/GuildSettings';



export async function execute(message: Message, args: string[]) {
  const guildId = message.guild?.id;
  const settings = await GuildSettings.findOne({ where: { guildId } });
  const prefix = settings?.get("prefix") || "!";
  if (args.length < 1) {
    return message.reply(`❌ Usage: ${prefix} reroll <giveawayID> - Select new winners.`);
  }


  const giveawayId = args[0];

  // ✅ Fetch giveaway by ID (Ensure it exists)
  let giveaway = await Giveaway.findOne({ where: { id: giveawayId } });

  if (!giveaway) {
    return message.reply("❌ Giveaway not found or has ended.");
  }

  // ✅ Ensure participants data is parsed correctly
  let participants: string[] = [];
  try {
    participants = JSON.parse(giveaway.get("participants") || "[]");
    if (!Array.isArray(participants)) participants = [];
  } catch (error) {
    console.error(`❌ Error parsing participants for Giveaway ${giveawayId}:`, error);
    return message.reply("❌ Unable to retrieve participants.");
  }

  // ✅ Prevent reroll if there are too few participants
  if (participants.length <= giveaway.winnerCount) {
    return message.reply("⚠️ Not enough participants to reroll winners.");
  }

  // ✅ Shuffle and select new winners
  const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
  const newWinners = shuffledParticipants.slice(0, giveaway.winnerCount).map(id => `<@${id}>`).join(', ');

  return message.reply(`🎉 **Rerolled Giveaway Winners:** ${newWinners}`);
}