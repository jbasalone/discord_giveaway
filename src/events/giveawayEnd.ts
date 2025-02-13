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
      if (!giveaway.get("guildId") || !giveaway.get("channelId") || !giveaway.get("messageId")) {
        console.warn(`⚠️ Skipping giveaway due to missing fields: ${JSON.stringify(giveaway, null, 2)}`);
        continue;
      }

      const guild = client.guilds.cache.get(giveaway.get("guildId"));
      if (!guild) {
        console.error(`❌ Guild not found for Giveaway ID ${giveaway.get("id")}`);
        continue;
      }

      const channel = guild.channels.cache.get(giveaway.get("channelId")) as TextChannel;
      if (!channel) {
        console.error(`❌ Channel not found for Giveaway ID ${giveaway.get("id")}`);
        continue;
      }

      let giveawayMessage: Message;
      try {
        giveawayMessage = await channel.messages.fetch(giveaway.get("messageId"));
        console.log(`✅ Successfully fetched giveaway message for ID ${giveaway.get("id")}: ${giveaway.get("messageId")}`);
      } catch (error) {
        console.warn(`⚠️ Giveaway message not found for ID ${giveaway.get("messageId")}. Skipping update.`);
        continue;
      }

      let participants: string[] = JSON.parse(giveaway.get("participants") || "[]");
      let winners = "No winners.";
      if (participants.length >= giveaway.get("winnerCount")) {
        // Shuffle and select winners
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        winners = shuffledParticipants.slice(0, giveaway.get("winnerCount")).map(id => `<@${id}>`).join(', ');
      }

      // ✅ Update Embed to Indicate Giveaway has Ended
      const embed = EmbedBuilder.from(giveawayMessage.embeds[0])
          .setFields([
            { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
            { name: "🏆 Winners", value: winners, inline: true },
            { name: "⏳ Status", value: "🛑 Ended!", inline: true }
          ])
          .setColor("Red");

      await giveawayMessage.edit({ embeds: [embed] });

      // ✅ Announce the winners
      if (participants.length > 0) {
        await channel.send(`🎉 **Giveaway Ended!** **${giveaway.get("title")}**\n🏆 **Winners:** ${winners}`);
      } else {
        await channel.send(`🎉 **Giveaway Ended!** **${giveaway.get("title")}**\n⚠️ No participants joined.`);
      }

      // ✅ Delete giveaway from database after processing
      await Giveaway.destroy({ where: { id: giveaway.get("id") } });
      console.log(`✅ Giveaway ${giveaway.get("id")} successfully deleted.`);
    }
  } catch (error) {
    console.error("❌ Critical Error in `handleGiveawayEnd()`:", error);
  }
}