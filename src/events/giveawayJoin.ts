import { ButtonInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import { Giveaway } from '../models/Giveaway';

const userCooldowns = new Map<string, number>();
const cooldownTime = 10 * 1000;

export async function executeJoinLeave(interaction: ButtonInteraction) {
  try {
    if (!interaction.customId.startsWith("join-") && !interaction.customId.startsWith("leave-")) return;

    const isJoining = interaction.customId.startsWith("join-");
    const userId = interaction.user.id;
    const giveawayMessageId = interaction.customId.split("-")[1];

    console.log(`🔍 Looking up giveaway with messageId: ${giveawayMessageId}`);

    // ✅ Fetch giveaway using Sequelize (WITHOUT `raw: true`)
    let giveaway = await Giveaway.findOne({ where: { messageId: giveawayMessageId } });

    if (!giveaway) {
      console.error(`❌ Giveaway not found for message ID: ${giveawayMessageId}`);
      return await interaction.reply({ content: "❌ This giveaway has ended or is corrupted.", ephemeral: true });
    }

    // ✅ Ensure the giveaway is not expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (giveaway.get("endsAt") <= currentTime) {
      return await interaction.reply({ content: "❌ This giveaway has already ended!", ephemeral: true });
    }

    // ✅ Fetch Channel ID Properly
    const channelId = giveaway.get("channelId") ?? null;
    if (!channelId) {
      console.error(`❌ Channel ID is missing for Giveaway ID: ${giveaway.get("id")}`);
      return await interaction.reply({ content: "❌ Giveaway channel data is missing.", ephemeral: true });
    }

    // ✅ Fetch the correct Discord channel
    const channel = interaction.client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      console.error(`❌ Channel ID ${channelId} not found!`);
      return await interaction.reply({ content: "❌ This giveaway channel no longer exists.", ephemeral: true });
    }

    let giveawayMessage;
    try {
      giveawayMessage = await channel.messages.fetch(giveaway.get("messageId"));
    } catch (error) {
      console.warn(`⚠️ Giveaway message not found for ID ${giveawayMessageId}.`);
      return await interaction.reply({ content: "❌ Giveaway message was deleted or is missing.", ephemeral: true });
    }

    if (!giveawayMessage) {
      console.warn(`⚠️ Giveaway message is undefined for ID ${giveaway.get("id")}.`);
      return;
    }

    // ✅ Ensure participants are properly retrieved
    let participants: string[] = [];
    try {
      participants = JSON.parse(giveaway.get("participants") ?? "[]");
      if (!Array.isArray(participants)) participants = [];
    } catch (error) {
      console.error(`❌ Error parsing participants for Giveaway ${giveaway.get("id")}:`, error);
      participants = [];
    }

    const alreadyJoined = participants.includes(userId);

    // ✅ Apply cooldown check
    if (userCooldowns.has(userId)) {
      const lastUsed = userCooldowns.get(userId)!;
      if (Date.now() - lastUsed < cooldownTime) {
        return await interaction.reply({ content: "⚠️ Please wait before joining/leaving again!", ephemeral: true });
      }
    }
    userCooldowns.set(userId, Date.now());

    // ✅ Prevent duplicate joins and leaving non-existent entries
    if (isJoining && alreadyJoined) {
      return await interaction.reply({ content: "⚠️ You have already joined this giveaway!", ephemeral: true });
    }
    if (!isJoining && !alreadyJoined) {
      return await interaction.reply({ content: "⚠️ You are not in this giveaway!", ephemeral: true });
    }

    // ✅ Add or remove user from participants list
    if (isJoining) {
      participants.push(userId);
    } else {
      participants = participants.filter(id => id !== userId);
    }

    // ✅ Save updated participants list using Sequelize
    await Giveaway.update(
        { participants: JSON.stringify(participants) },
        { where: { messageId: giveawayMessageId } }
    );

    console.log(`✅ Updated participants for Giveaway ID: ${giveaway.get("id")}, Total: ${participants.length}`);

    // ✅ Ensure embed updates correctly
    const embed = EmbedBuilder.from(giveawayMessage.embeds[0]);
    embed.setFields([
      { name: "🎟️ Total Participants", value: `${participants.length} users`, inline: true },
      { name: "🏆 Winners", value: `${giveaway.get("winnerCount") ?? "N/A"}`, inline: true },
      { name: "⏳ Ends In", value: giveaway.get("endsAt") ? `<t:${giveaway.get("endsAt")}:R>` : "N/A", inline: true }
    ]);

    await giveawayMessage.edit({ embeds: [embed] });

    return await interaction.reply({
      content: isJoining ? "✅ You have successfully joined the giveaway!" : "✅ You have left the giveaway.",
      ephemeral: true
    });

  } catch (error) {
    console.error("❌ Error handling giveaway join/leave:", error);
    return await interaction.reply({ content: "❌ An error occurred. Please try again later.", ephemeral: true });
  }
}