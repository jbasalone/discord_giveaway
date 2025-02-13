import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { Giveaway } from '../models/Giveaway';
import { Op } from 'sequelize';

export async function handleGiveawayEnd(client: Client) {
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    console.log(`🔍 Checking expired giveaways at timestamp ${currentTime}`);

    const expiredGiveaways = await Giveaway.findAll({
      where: { endsAt: { [Op.lte]: currentTime } },
    });

    console.log(`✅ Found ${expiredGiveaways.length} expired giveaways.`);

    if (expiredGiveaways.length === 0) {
      console.log("✅ No expired giveaways to process.");
      return;
    }

    for (const giveaway of expiredGiveaways) {
      if (!giveaway.guildId || !giveaway.channelId || !giveaway.messageId) {
        console.warn(`⚠️ Skipping giveaway due to missing fields: ${JSON.stringify(giveaway, null, 2)}`);
        continue;
      }

      const guild = client.guilds.cache.get(giveaway.guildId);
      if (!guild) {
        console.error(`❌ Guild not found for Giveaway ID ${giveaway.id}`);
        continue;
      }

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) {
        console.error(`❌ Channel not found for Giveaway ID ${giveaway.id}`);
        continue;
      }

      let giveawayMessage: Message;
      try {
        giveawayMessage = await channel.messages.fetch(giveaway.messageId);
        console.log(`✅ Successfully fetched giveaway message for ID ${giveaway.id}: ${giveaway.messageId}`);
      } catch (error) {
        console.warn(`⚠️ Giveaway message not found for ID ${giveaway.messageId}. Skipping update.`);
        continue;
      }

      let participants: string[] = JSON.parse(giveaway.participants || "[]");
      let winners = participants.length >= giveaway.winnerCount
          ? participants.slice(0, giveaway.winnerCount).map(id => `<@${id}>`).join(', ')
          : "No winners.";

      // ✅ Update Embed
      const embed = EmbedBuilder.from(giveawayMessage.embeds[0])
          .setFields([
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: winners, inline: true },
            { name: "⏳ Status", value: "🛑 Ended!", inline: true }
          ])
          .setColor("Red");

      await giveawayMessage.edit({ embeds: [embed] });

      await giveaway.destroy();
    }
  } catch (error) {
    console.error("❌ Critical Error in `handleGiveawayEnd()`:", error);
  }
}