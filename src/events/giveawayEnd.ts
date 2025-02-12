import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { Op } from 'sequelize';

export async function handleGiveawayEnd(client: Client) {
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const expiredGiveaways = await Giveaway.findAll({
      where: { endsAt: { [Op.lte]: currentTime } }
    });

    if (expiredGiveaways.length === 0) return;

    for (const giveaway of expiredGiveaways) {
      console.log(`🏁 Ending Giveaway ID: ${giveaway.id}`);

      if (!giveaway.guildId) {
        console.warn(`⚠️ Giveaway ${giveaway.id} is missing guildId. Skipping.`);
        continue;
      }

      const guild = client.guilds.cache.get(giveaway.guildId);
      if (!guild) {
        console.error(`❌ Guild not found for Giveaway ID ${giveaway.id}`);
        continue;
      }

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) {
        console.error(`❌ Giveaway ${giveaway.id} - Channel not found!`);
        continue;
      }

      let giveawayMessage;
      if (!giveaway.messageId) {
        console.warn(`⚠️ Giveaway messageId is missing for ID ${giveaway.id}.`);
        continue;
      }

      try {
        giveawayMessage = await channel.messages.fetch(giveaway.messageId);
      } catch (error) {
        console.warn(`⚠️ Giveaway message not found for ID ${giveaway.messageId}. Skipping update.`);
        continue;
      }

      let participants: string[] = [];
      try {
        participants = JSON.parse(giveaway.participants);
      } catch (error) {
        console.error(`❌ Error parsing participants for Giveaway ${giveaway.id}:`, error);
      }

      if (participants.length < giveaway.winnerCount) {
        console.log(`❌ Not enough participants for Giveaway ID: ${giveaway.id}. No winners selected.`);
        await giveaway.destroy();
        continue;
      }

      const shuffledParticipants = participants.sort(() => Math.random() - 0.5);
      const winners = shuffledParticipants.slice(0, giveaway.winnerCount).map(id => `<@${id}>`).join(', ');

      await channel.send(`🎉 **Giveaway Ended!** **${giveaway.title}**\n🏆 **Winners:** ${winners}`);

      await giveaway.destroy();
    }
  } catch (error) {
    console.error("❌ Critical Error in `handleGiveawayEnd()`:", error);
  }
}